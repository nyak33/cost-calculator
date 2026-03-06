import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { BreakdownTable } from "../components/results/BreakdownTable";
import { ComparePanel } from "../components/results/ComparePanel";
import { SummaryTable } from "../components/results/SummaryTable";
import { WarningsPanel } from "../components/results/WarningsPanel";
import type { QtyResult, QuoteWarning, TierEntry } from "../lib/calc/types";
import { useQuoteStore } from "../store/useQuoteStore";

export function ResultsPage() {
  const [selectedQtyState, setSelectedQtyState] = useState<number>(0);
  const [showChosenSuppliers, setShowChosenSuppliers] = useState(false);
  const [compareComponentId, setCompareComponentId] = useState<string | undefined>(() => {
    const value = sessionStorage.getItem("ccv2.compare_component") ?? undefined;
    if (value) {
      sessionStorage.removeItem("ccv2.compare_component");
    }
    return value;
  });

  const navigate = useNavigate();

  const { settings, jobInputs, components, results, supplierCompare, ui, setActiveResultsTab, updateSupplierOption, bulkUpdateSupplierTiers } =
    useQuoteStore();

  const supplierNameByOptionId = useMemo(() => {
    const map = new Map<string, string>();
    components.forEach((component) => {
      (component.supplier_options ?? []).forEach((option) => {
        map.set(option.supplier_option_id, option.supplier_name);
      });
    });
    return map;
  }, [components]);

  const componentNameById = useMemo(() => {
    const map = new Map<string, string>();
    components.forEach((component) => {
      map.set(component.component_id, component.name);
    });
    return map;
  }, [components]);

  const selectedQty = results.per_qty.some((item) => item.qty === selectedQtyState)
    ? selectedQtyState
    : (results.per_qty[0]?.qty ?? 0);

  const updatedAtLabel = new Date().toLocaleTimeString();

  const renderChosenSuppliers = (row: QtyResult) => {
    const items = Object.entries(row.chosen_suppliers)
      .filter(([, supplierId]) => Boolean(supplierId))
      .map(([componentId, supplierId]) => {
        const supplierName = supplierId ? supplierNameByOptionId.get(supplierId) ?? supplierId : "-";
        return `${componentNameById.get(componentId) ?? componentId}: ${supplierName}`;
      });

    return items.length > 0 ? items.join(" | ") : "-";
  };

  const jumpToComponent = (componentId: string) => {
    navigate(`/#${componentId}`);
  };

  const handleWarningFix = (warning: QuoteWarning) => {
    navigate(`/#${warning.component_id}`);
  };

  const autoAddMissingTier = (warning: QuoteWarning) => {
    if (warning.qty < 0 || !warning.supplier_option_id) {
      return;
    }

    const component = components.find((item) => item.component_id === warning.component_id);
    if (!component) {
      return;
    }

    const supplier = (component.supplier_options ?? []).find(
      (item) => item.supplier_option_id === warning.supplier_option_id,
    );
    if (!supplier) {
      return;
    }

    if (supplier.tiers.some((tier) => tier.qty === warning.qty)) {
      return;
    }

    const nextTiers = [
      ...supplier.tiers,
      { qty: warning.qty, price: 0, currency: "MYR" as const, sst_pct: 0, note: "" },
    ].sort((a, b) => a.qty - b.qty);

    updateSupplierOption(component.component_id, supplier.supplier_option_id, { tiers: nextTiers });
  };

  const autoAddAllMissing = () => {
    const grouped = new Map<string, Set<number>>();

    results.warnings.forEach((warning) => {
      if (warning.qty < 0 || !warning.supplier_option_id) {
        return;
      }
      const key = `${warning.component_id}::${warning.supplier_option_id}`;
      const set = grouped.get(key) ?? new Set<number>();
      set.add(warning.qty);
      grouped.set(key, set);
    });

    const updates: Array<{ componentId: string; supplierOptionId: string; tiers: TierEntry[] }> = [];

    grouped.forEach((qtySet, key) => {
      const [componentId, supplierId] = key.split("::");
      const component = components.find((item) => item.component_id === componentId);
      if (!component) {
        return;
      }

      const supplier = (component.supplier_options ?? []).find((item) => item.supplier_option_id === supplierId);
      if (!supplier) {
        return;
      }

      const existing = new Set(supplier.tiers.map((tier) => tier.qty));
      const additions = [...qtySet]
        .filter((qty) => !existing.has(qty))
        .map((qty) => ({ qty, price: 0, currency: "MYR" as const, sst_pct: 0, note: "" }));

      if (additions.length === 0) {
        return;
      }

      updates.push({
        componentId,
        supplierOptionId: supplierId,
        tiers: [...supplier.tiers, ...additions].sort((a, b) => a.qty - b.qty),
      });
    });

    if (updates.length > 0) {
      bulkUpdateSupplierTiers(updates);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <div className="results-header">
          <div>
            <h1>Results</h1>
            <p className="hint">Quote: {jobInputs.job_name?.trim() || "Untitled Quote"}</p>
            <p className="hint">Strategy: Lowest Total Cost Combination</p>
          </div>
          <div className="row wrap">
            <Link to="/" className="nav-action-link">
              Quote Builder
            </Link>
            <Link to="/export" className="nav-action-link">
              Export
            </Link>
            <Link to="/settings" className="nav-action-link">
              Settings
            </Link>
            <Link to="/manual" className="nav-action-link">
              Manual
            </Link>
          </div>
        </div>

        <div className="results-meta row between wrap top-gap">
          <span>Last updated: {updatedAtLabel}</span>
          <label className="row gap">
            <input
              type="checkbox"
              checked={showChosenSuppliers}
              onChange={(event) => setShowChosenSuppliers(event.target.checked)}
            />
            Show chosen suppliers
          </label>
        </div>

        <div className="row gap results-tabs wrap top-gap">
          <button
            type="button"
            className={ui.activeResultsTab === "summary" ? "active-tab-btn" : ""}
            onClick={() => setActiveResultsTab("summary")}
          >
            Summary of Pricing
          </button>
          <button
            type="button"
            className={ui.activeResultsTab === "breakdown" ? "active-tab-btn" : ""}
            onClick={() => setActiveResultsTab("breakdown")}
          >
            Cost Breakdown
          </button>
          <button
            type="button"
            className={ui.activeResultsTab === "warnings" ? "active-tab-btn" : ""}
            onClick={() => setActiveResultsTab("warnings")}
          >
            Warnings
          </button>
          <button
            type="button"
            className={ui.activeResultsTab === "compare" ? "active-tab-btn" : ""}
            onClick={() => setActiveResultsTab("compare")}
          >
            Compare
          </button>
        </div>

        <div className="top-gap results-tab-content">
          {ui.activeResultsTab === "summary" ? (
            <SummaryTable
              rows={results.per_qty}
              moneyDecimals={settings.formatting.money_decimals}
              unitDecimals={settings.formatting.unit_decimals}
              percentDecimals={settings.formatting.percent_decimals}
              selectedQty={selectedQty}
              onSelectQty={setSelectedQtyState}
              showChosenSuppliers={showChosenSuppliers}
              renderChosenSuppliers={renderChosenSuppliers}
            />
          ) : null}

          {ui.activeResultsTab === "breakdown" ? (
            <BreakdownTable
              rows={results.per_qty}
              selectedQty={selectedQty}
              onSelectQty={setSelectedQtyState}
              onJumpToComponent={jumpToComponent}
              moneyDecimals={settings.formatting.money_decimals}
              weightDecimals={settings.formatting.weight_decimals}
            />
          ) : null}

          {ui.activeResultsTab === "warnings" ? (
            <WarningsPanel
              warnings={results.warnings}
              onFix={handleWarningFix}
              onAutoAddMissingTier={autoAddMissingTier}
              onAutoAddAllMissing={autoAddAllMissing}
            />
          ) : null}

          {ui.activeResultsTab === "compare" ? (
            <ComparePanel
              tables={supplierCompare}
              selectedComponentId={compareComponentId}
              onSelectComponentId={setCompareComponentId}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
