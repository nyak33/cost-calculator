import { describe, expect, it } from "vitest";

import { defaultComponents, defaultJobInputs, defaultSettings } from "../constants/defaults";
import { computeQuote } from "../lib/calc/computeQuote";
import { buildFormulaDependencyGraph, detectCycle, topoSort } from "../lib/calc/cycleDetection";
import { computeDerived } from "../lib/calc/derived";
import { validateFormulaExpression } from "../lib/calc/formulaEngine";
import type { QuoteComponent } from "../lib/calc/types";

describe("computeDerived", () => {
  it("applies safe ceil for code_qty without off-by-one", () => {
    const derived = computeDerived(defaultJobInputs, defaultSettings, 50000);
    expect(derived.code_qty).toBe(55000);
  });
});

describe("computeQuote", () => {
  it("keeps kood profit locked to zero", () => {
    const components: QuoteComponent[] = [
      {
        component_id: "comp_kood",
        template_key: "kood_fee",
        name: "Kood Fee",
        enabled: true,
        tag: "MARGIN",
        margin_pct: 40,
        type: "FORMULA_BUILDER",
        formula_builder: {
          expression: "10",
          parameters: [],
        },
        special_rule: "MARGIN_LOCKED_0_TOGGLEABLE",
      },
    ];

    const output = computeQuote({
      settings: defaultSettings,
      job: { ...defaultJobInputs, quantity_scenarios: [50000] },
      components,
    });

    const row = output.per_qty[0];
    expect(row.status).toBe("OK");
    expect(row.lines[0]?.sell_myr).toBe(row.lines[0]?.cost_myr);
    expect(row.lines[0]?.profit_myr).toBe(0);
  });

  it("returns NA when exact tier qty is missing", () => {
    const component: QuoteComponent = {
      component_id: "comp_print",
      template_key: "printing",
      name: "Printing",
      enabled: true,
      tag: "MARGIN",
      margin_pct: 30,
      type: "TIER_TOTAL_MUST_MATCH",
      supplier_options: [
        {
          supplier_option_id: "sup_1",
          supplier_name: "Supplier A",
          tiers: [{ qty: 100000, price: 1000, currency: "MYR", sst_pct: 6 }],
        },
      ],
    };

    const output = computeQuote({
      settings: defaultSettings,
      job: { ...defaultJobInputs, quantity_scenarios: [50000] },
      components: [component],
    });

    expect(output.per_qty[0]?.status).toBe("NA");
    expect(output.warnings.some((warning) => warning.message.includes("missing exact tier"))).toBe(true);
  });

  it("optimizer picks cheaper supplier option", () => {
    const output = computeQuote({
      settings: defaultSettings,
      job: { ...defaultJobInputs, quantity_scenarios: [50000] },
      components: [defaultComponents[0]],
    });

    expect(output.per_qty[0]?.status).toBe("OK");
    expect(output.per_qty[0]?.chosen_suppliers.comp_printing).toBe("supD_print");
  });

  it("computes margin metrics with pass-through separation", () => {
    const components: QuoteComponent[] = [
      {
        component_id: "comp_margin",
        template_key: "printing",
        name: "Printing",
        enabled: true,
        tag: "MARGIN",
        margin_pct: 50,
        type: "FORMULA_BUILDER",
        formula_builder: { expression: "100", parameters: [] },
      },
      {
        component_id: "comp_pt",
        template_key: "sample",
        name: "Sample",
        enabled: true,
        tag: "PASS_THROUGH",
        margin_pct: 0,
        type: "FORMULA_BUILDER",
        formula_builder: { expression: "50", parameters: [] },
      },
    ];

    const output = computeQuote({
      settings: defaultSettings,
      job: { ...defaultJobInputs, quantity_scenarios: [1000] },
      components,
    });

    const row = output.per_qty[0];
    expect(row.status).toBe("OK");
    expect(row.totals.overall_margin_pct).not.toBe(row.totals.margin_ex_pass_through_pct);
  });

  it("handles SST mode differences", () => {
    const component: QuoteComponent = {
      component_id: "comp_print",
      template_key: "printing",
      name: "Printing",
      enabled: true,
      tag: "MARGIN",
      margin_pct: 20,
      type: "TIER_TOTAL_MUST_MATCH",
      supplier_options: [
        {
          supplier_option_id: "sup_1",
          supplier_name: "Supplier A",
          tiers: [{ qty: 50000, price: 1400, currency: "MYR", sst_pct: 6 }],
        },
      ],
    };

    const applyMode = computeQuote({
      settings: { ...defaultSettings, sst_margin_mode: "apply_margin" },
      job: { ...defaultJobInputs, quantity_scenarios: [50000] },
      components: [component],
    });

    const passMode = computeQuote({
      settings: { ...defaultSettings, sst_margin_mode: "pass_through" },
      job: { ...defaultJobInputs, quantity_scenarios: [50000] },
      components: [component],
    });

    expect(applyMode.per_qty[0]?.totals.sell_total_myr).not.toBe(passMode.per_qty[0]?.totals.sell_total_myr);
  });
});

describe("formula parser safety", () => {
  it("rejects disallowed symbols/functions", () => {
    const result = validateFormulaExpression("pow(qty,2) + globalThis", []);
    expect(result.ok).toBe(false);
  });
});

describe("component reference graph", () => {
  it("supports valid topological order", () => {
    const components: QuoteComponent[] = [
      {
        component_id: "a",
        template_key: "a",
        name: "A",
        enabled: true,
        tag: "MARGIN",
        margin_pct: 10,
        type: "FORMULA_BUILDER",
        formula_builder: { expression: "10", parameters: [] },
      },
      {
        component_id: "b",
        template_key: "b",
        name: "B",
        enabled: true,
        tag: "MARGIN",
        margin_pct: 10,
        type: "FORMULA_BUILDER",
        formula_builder: { expression: 'comp("a").cost + 5', parameters: [] },
      },
    ];

    const { graph } = buildFormulaDependencyGraph(components);
    const cycle = detectCycle(graph);
    const sorted = topoSort(graph);

    expect(cycle).toBeNull();
    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
  });

  it("detects circular reference", () => {
    const components: QuoteComponent[] = [
      {
        component_id: "a",
        template_key: "a",
        name: "A",
        enabled: true,
        tag: "MARGIN",
        margin_pct: 10,
        type: "FORMULA_BUILDER",
        formula_builder: { expression: 'comp("b").cost + 1', parameters: [] },
      },
      {
        component_id: "b",
        template_key: "b",
        name: "B",
        enabled: true,
        tag: "MARGIN",
        margin_pct: 10,
        type: "FORMULA_BUILDER",
        formula_builder: { expression: 'comp("a").cost + 1', parameters: [] },
      },
    ];

    const { graph } = buildFormulaDependencyGraph(components);
    const cycle = detectCycle(graph);

    expect(cycle).not.toBeNull();
    expect(cycle?.join(" -> ")).toContain("a");
    expect(cycle?.join(" -> ")).toContain("b");
  });
});
