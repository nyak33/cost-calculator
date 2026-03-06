import { clampMarginPct, isSettingsValid, validateComponents } from "../validation/rules";
import { buildFormulaDependencyGraph, detectCycle, topoSort } from "./cycleDetection";
import { computeDerived, toMyr } from "./derived";
import { evaluateFormulaExpression } from "./formulaEngine";
import { findMinCostCombination } from "./optimizer";
import type {
  ComponentEvalResult,
  ComputeQuoteInput,
  ComputeQuoteOutput,
  CostLine,
  QtyResult,
  QuoteComponent,
  QuoteWarning,
  SupplierCompareTable,
} from "./types";

interface FinancialTriple {
  cost: number;
  sell: number;
  profit: number;
}

function isTierComponent(component: QuoteComponent): boolean {
  if (component.type === "TIER_TOTAL_MUST_MATCH") {
    return true;
  }

  if (component.type === "TIER_TOTAL_MUST_MATCH_OR_FORMULA") {
    return Boolean(component.supplier_options && component.supplier_options.length > 0);
  }

  return false;
}

function applyPricing(component: QuoteComponent, cost: number): FinancialTriple {
  if (component.special_rule === "MARGIN_LOCKED_0_TOGGLEABLE") {
    return {
      cost,
      sell: cost,
      profit: 0,
    };
  }

  if (component.tag === "PASS_THROUGH") {
    return {
      cost,
      sell: cost,
      profit: 0,
    };
  }

  const marginPct = clampMarginPct(component.margin_pct);
  const sell = cost / (1 - marginPct / 100);

  return {
    cost,
    sell,
    profit: sell - cost,
  };
}

function resolveTierComponentForQty(
  component: QuoteComponent,
  qty: number,
  fx: number,
  sstMode: "apply_margin" | "pass_through",
): { candidates: ComponentEvalResult[]; warnings: QuoteWarning[] } {
  const warnings: QuoteWarning[] = [];
  const candidates: ComponentEvalResult[] = [];

  const options = component.supplier_options ?? [];

  options.forEach((option) => {
    const tier = option.tiers.find((row) => row.qty === qty);
    if (!tier) {
      warnings.push({
        qty,
        component_id: component.component_id,
        supplier_option_id: option.supplier_option_id,
        message: `${component.name} / ${option.supplier_name}: missing exact tier for qty ${qty}`,
      });
      return;
    }

    const base = toMyr(tier.price, tier.currency, fx);
    const sst = base * (tier.sst_pct / 100);

    candidates.push({
      ok: true,
      cost_myr: sstMode === "apply_margin" ? base + sst : base,
      supplier_option_id: option.supplier_option_id,
      supplier_name: option.supplier_name,
      sst_pass_through_myr: sstMode === "pass_through" ? sst : 0,
    });
  });

  return {
    candidates,
    warnings,
  };
}

function nullTotals(): QtyResult["totals"] {
  return {
    cost_total_myr: null,
    sell_total_myr: null,
    profit_total_myr: null,
    pass_through_sell_total_myr: null,
    overall_margin_pct: null,
    margin_ex_pass_through_pct: null,
    unit_cost_myr: null,
    unit_price_myr: null,
  };
}

export function computeQuote(input: ComputeQuoteInput): ComputeQuoteOutput {
  const warnings: QuoteWarning[] = [];
  const results: QtyResult[] = [];

  const settingsErrors = isSettingsValid(input.settings);
  settingsErrors.forEach((message) => {
    warnings.push({
      qty: -1,
      component_id: "settings",
      message,
    });
  });

  validateComponents(input.components).forEach((message) => {
    warnings.push({
      qty: -1,
      component_id: "validation",
      message,
    });
  });

  const enabledComponents = input.components.filter((component) => component.enabled);
  const tierComponents = enabledComponents.filter((component) => isTierComponent(component));
  const formulaComponents = enabledComponents.filter((component) => !isTierComponent(component));

  const { graph, idLookup } = buildFormulaDependencyGraph(enabledComponents);
  const cycle = detectCycle(graph);

  let formulaOrder: string[] = [];
  if (!cycle) {
    formulaOrder = topoSort(graph);
  }

  input.job.quantity_scenarios.forEach((qty) => {
    const derived = computeDerived(input.job, input.settings, qty);
    const qtyWarnings: string[] = [];

    if (cycle) {
      const cyclePath = cycle.join(" -> ");
      const warningText = `Formula cycle detected: ${cyclePath}`;
      warnings.push({
        qty,
        component_id: "formula_cycle",
        message: warningText,
      });
      results.push({
        qty,
        status: "NA",
        warnings: [warningText],
        derived,
        chosen_suppliers: {},
        totals: nullTotals(),
        lines: [],
      });
      return;
    }

    const tierGroups = tierComponents.map((component) => {
      const { candidates, warnings: tierWarnings } = resolveTierComponentForQty(
        component,
        qty,
        input.settings.rmb_per_myr,
        input.settings.sst_margin_mode,
      );

      tierWarnings.forEach((item) => {
        warnings.push(item);
        qtyWarnings.push(item.message);
      });

      return {
        component,
        candidates: candidates.filter((candidate) => candidate.ok),
      };
    });

    const missingRequired = tierGroups.filter((group) => group.candidates.length === 0);
    if (missingRequired.length > 0) {
      missingRequired.forEach((group) => {
        const message = `${group.component.name}: no supplier has exact tier for qty ${qty}`;
        warnings.push({
          qty,
          component_id: group.component.component_id,
          message,
        });
        qtyWarnings.push(message);
      });

      results.push({
        qty,
        status: "NA",
        warnings: qtyWarnings,
        derived,
        chosen_suppliers: {},
        totals: nullTotals(),
        lines: [],
      });
      return;
    }

    const optimized = findMinCostCombination(
      tierGroups.map((group) => ({
        componentId: group.component.component_id,
        candidates: group.candidates.map((candidate) => ({
          componentId: group.component.component_id,
          supplierOptionId: candidate.supplier_option_id ?? null,
          supplierName: candidate.supplier_name ?? null,
          costMyr: candidate.cost_myr ?? 0,
          sstPassThroughMyr: candidate.sst_pass_through_myr ?? 0,
        })),
      })),
    );

    if (!optimized) {
      const message = `Failed to build supplier combination for qty ${qty}`;
      warnings.push({ qty, component_id: "optimizer", message });
      results.push({
        qty,
        status: "NA",
        warnings: [...qtyWarnings, message],
        derived,
        chosen_suppliers: {},
        totals: nullTotals(),
        lines: [],
      });
      return;
    }

    const tierChoiceByComponent = new Map(optimized.selected.map((item) => [item.componentId, item]));
    const chosen_suppliers: Record<string, string | null> = {};
    const lines: CostLine[] = [];
    const metricsByComponent = new Map<string, FinancialTriple>();

    tierComponents.forEach((component) => {
      const selected = tierChoiceByComponent.get(component.component_id);
      if (!selected) {
        return;
      }

      chosen_suppliers[component.component_id] = selected.supplierOptionId;
      const priced = applyPricing(component, selected.costMyr);

      lines.push({
        component_id: component.component_id,
        component_name: component.name,
        supplier_name: selected.supplierName,
        tag: component.tag,
        cost_myr: priced.cost,
        sell_myr: priced.sell,
        profit_myr: priced.profit,
      });

      if (selected.sstPassThroughMyr > 0) {
        lines.push({
          component_id: component.component_id,
          component_name: `${component.name} SST`,
          supplier_name: selected.supplierName,
          tag: "PASS_THROUGH",
          cost_myr: selected.sstPassThroughMyr,
          sell_myr: selected.sstPassThroughMyr,
          profit_myr: 0,
          is_sst_pass_through: true,
        });
      }

      metricsByComponent.set(component.component_id, priced);
      if (!metricsByComponent.has(component.template_key)) {
        metricsByComponent.set(component.template_key, priced);
      }
    });

    const formulaById = new Map(formulaComponents.map((component) => [component.component_id, component]));
    const formulaOrderSet = new Set(formulaOrder);

    const formulaOrderedComponents = [
      ...formulaOrder.map((id) => formulaById.get(id)).filter((item): item is QuoteComponent => Boolean(item)),
      ...formulaComponents.filter((component) => !formulaOrderSet.has(component.component_id)),
    ];

    for (const component of formulaOrderedComponents) {
      chosen_suppliers[component.component_id] = null;

      const expression = component.formula_builder?.expression?.trim() ?? "";
      if (!expression) {
        const message = `${component.name}: formula expression is empty`;
        warnings.push({ qty, component_id: component.component_id, message });
        qtyWarnings.push(message);
        results.push({
          qty,
          status: "NA",
          warnings: qtyWarnings,
          derived,
          chosen_suppliers,
          totals: nullTotals(),
          lines: [],
        });
        return;
      }

      const evalResult = evaluateFormulaExpression({
        expression,
        parameters: component.formula_builder?.parameters ?? [],
        context: {
          qty,
          code_qty: derived.code_qty,
          area_m2: derived.area_m2,
          total_weight: derived.total_weight,
          fx: input.settings.rmb_per_myr,
        },
        fx: input.settings.rmb_per_myr,
        getComponentMetric: (idOrKey, metric) => {
          const resolvedId = idLookup.get(idOrKey) ?? idOrKey;
          const entry = metricsByComponent.get(resolvedId);
          if (!entry) {
            throw new Error(`Unknown component reference '${idOrKey}'`);
          }

          return metric === "cost" ? entry.cost : metric === "sell" ? entry.sell : entry.profit;
        },
      });

      if (!evalResult.ok || typeof evalResult.value !== "number") {
        const message = `${component.name}: ${evalResult.error ?? "formula evaluation failed"}`;
        warnings.push({ qty, component_id: component.component_id, message });
        qtyWarnings.push(message);
        results.push({
          qty,
          status: "NA",
          warnings: qtyWarnings,
          derived,
          chosen_suppliers,
          totals: nullTotals(),
          lines: [],
        });
        return;
      }

      const priced = applyPricing(component, evalResult.value);

      lines.push({
        component_id: component.component_id,
        component_name: component.name,
        supplier_name: null,
        tag: component.tag,
        cost_myr: priced.cost,
        sell_myr: priced.sell,
        profit_myr: priced.profit,
      });

      metricsByComponent.set(component.component_id, priced);
      if (!metricsByComponent.has(component.template_key)) {
        metricsByComponent.set(component.template_key, priced);
      }
    }

    const cost_total_myr = lines.reduce((sum, line) => sum + line.cost_myr, 0);
    const sell_total_myr = lines.reduce((sum, line) => sum + line.sell_myr, 0);
    const profit_total_myr = lines.reduce((sum, line) => sum + line.profit_myr, 0);
    const pass_through_sell_total_myr = lines
      .filter((line) => line.tag === "PASS_THROUGH")
      .reduce((sum, line) => sum + line.sell_myr, 0);

    const overall_margin_pct = sell_total_myr > 0 ? (profit_total_myr / sell_total_myr) * 100 : null;
    const denomExPassThrough = sell_total_myr - pass_through_sell_total_myr;
    const margin_ex_pass_through_pct = denomExPassThrough > 0 ? (profit_total_myr / denomExPassThrough) * 100 : null;

    results.push({
      qty,
      status: "OK",
      warnings: qtyWarnings,
      derived,
      chosen_suppliers,
      totals: {
        cost_total_myr,
        sell_total_myr,
        profit_total_myr,
        pass_through_sell_total_myr,
        overall_margin_pct,
        margin_ex_pass_through_pct,
        unit_cost_myr: qty > 0 ? cost_total_myr / qty : null,
        unit_price_myr: qty > 0 ? sell_total_myr / qty : null,
      },
      lines,
    });
  });

  return {
    per_qty: results,
    warnings,
  };
}

export function buildSupplierCompareTables(input: ComputeQuoteInput): SupplierCompareTable[] {
  const enabled = input.components.filter((component) => component.enabled && isTierComponent(component));

  return enabled
    .filter((component) => (component.supplier_options?.length ?? 0) >= 2)
    .map((component) => {
      const supplierHeaders = (component.supplier_options ?? []).map((option) => ({
        supplier_option_id: option.supplier_option_id,
        supplier_name: option.supplier_name,
      }));

      const rows = input.job.quantity_scenarios.map((qty) => {
        let bestCost = Number.POSITIVE_INFINITY;
        let bestSupplierOptionId: string | null = null;

        const costsBySupplier = (component.supplier_options ?? []).reduce<Record<string, number | null>>((acc, option) => {
          const tier = option.tiers.find((item) => item.qty === qty);
          if (!tier) {
            acc[option.supplier_option_id] = null;
            return acc;
          }

          const base = toMyr(tier.price, tier.currency, input.settings.rmb_per_myr);
          const sst = base * (tier.sst_pct / 100);
          const cost = input.settings.sst_margin_mode === "apply_margin" ? base + sst : base;

          acc[option.supplier_option_id] = cost;
          if (cost < bestCost) {
            bestCost = cost;
            bestSupplierOptionId = option.supplier_option_id;
          }

          return acc;
        }, {});

        return {
          qty,
          costsBySupplier,
          bestSupplierOptionId,
        };
      });

      return {
        component_id: component.component_id,
        component_name: component.name,
        supplierHeaders,
        rows,
      };
    });
}
