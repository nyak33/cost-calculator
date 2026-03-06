import { useState } from "react";

import type { QuoteComponent, SupplierOption, TierEntry } from "../../lib/calc/types";
import { FormattedNumberInput } from "../numeric/FormattedNumberInput";

type Props = {
  component: QuoteComponent;
  quantities: number[];
  selectedSupplierOptionId?: string;
  onSelectSupplier: (supplierOptionId: string) => void;
  onAddSupplier: () => void;
  onRemoveSupplier: (supplierOptionId: string) => void;
  onUpdateSupplier: (supplierOptionId: string, patch: Partial<SupplierOption>) => void;
  onAddTier: (supplierOptionId: string) => void;
  onRemoveTier: (supplierOptionId: string, tierIndex: number) => void;
  onUpdateTier: (
    supplierOptionId: string,
    tierIndex: number,
    patch: Partial<{ qty: number; price: number; currency: "MYR" | "RMB"; sst_pct: number; note: string }>,
  ) => void;
};

function sortTiers(tiers: TierEntry[]): TierEntry[] {
  return [...tiers].sort((a, b) => a.qty - b.qty);
}

export function TierEditor({
  component,
  quantities,
  selectedSupplierOptionId,
  onSelectSupplier,
  onAddSupplier,
  onRemoveSupplier,
  onUpdateSupplier,
  onAddTier,
  onRemoveTier,
  onUpdateTier,
}: Props) {
  const options = component.supplier_options ?? [];
  const [copySourceId, setCopySourceId] = useState<string>("");

  const activeSupplierId = selectedSupplierOptionId && options.some((item) => item.supplier_option_id === selectedSupplierOptionId)
    ? selectedSupplierOptionId
    : options[0]?.supplier_option_id;

  const activeSupplier = options.find((item) => item.supplier_option_id === activeSupplierId);

  const missingCountBySupplier = new Map<string, number>();
  options.forEach((option) => {
    const present = new Set(option.tiers.map((tier) => tier.qty));
    const missing = quantities.filter((qty) => !present.has(qty)).length;
    missingCountBySupplier.set(option.supplier_option_id, missing);
  });

  if (!activeSupplier) {
    return (
      <div className="tier-editor">
        <div className="row between wrap">
          <strong>Tier Pricing (Must match qty)</strong>
          <button type="button" onClick={onAddSupplier}>
            Add Supplier Option
          </button>
        </div>
        <p className="hint">Add at least one supplier option to enter tier pricing.</p>
      </div>
    );
  }

  const qtyCount = new Map<number, number>();
  activeSupplier.tiers.forEach((tier) => {
    qtyCount.set(tier.qty, (qtyCount.get(tier.qty) ?? 0) + 1);
  });

  const fillFromScenarios = () => {
    const existingByQty = new Map(activeSupplier.tiers.map((tier) => [tier.qty, tier]));
    const next = quantities.map((qty) => {
      const existing = existingByQty.get(qty);
      return (
        existing ?? {
          qty,
          price: 0,
          currency: "MYR" as const,
          sst_pct: 0,
          note: "",
        }
      );
    });

    onUpdateSupplier(activeSupplier.supplier_option_id, { tiers: sortTiers(next) });
  };

  const copyFromSupplier = () => {
    if (!copySourceId) {
      return;
    }

    const source = options.find((item) => item.supplier_option_id === copySourceId);
    if (!source) {
      return;
    }

    const copied = source.tiers.map((tier) => ({ ...tier }));
    onUpdateSupplier(activeSupplier.supplier_option_id, { tiers: sortTiers(copied) });
  };

  const missingCount = missingCountBySupplier.get(activeSupplier.supplier_option_id) ?? 0;

  return (
    <div className="tier-editor">
      <div className="row between wrap">
        <strong>Tier Pricing (Must match qty)</strong>
        <div className="row wrap">
          <button type="button" onClick={fillFromScenarios}>
            Fill tiers from Quantity Scenarios
          </button>
          <button type="button" onClick={onAddSupplier}>
            + Add Supplier
          </button>
        </div>
      </div>

      <div className="supplier-tabs" role="tablist" aria-label={`${component.name} suppliers`}>
        {options.map((option) => {
          const missing = missingCountBySupplier.get(option.supplier_option_id) ?? 0;
          const active = option.supplier_option_id === activeSupplier.supplier_option_id;

          return (
            <button
              key={option.supplier_option_id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`supplier-tab ${active ? "active" : ""}`}
              onClick={() => onSelectSupplier(option.supplier_option_id)}
            >
              <span>{option.supplier_name}</span>
              {missing > 0 ? <span className="badge-warn">{missing} missing</span> : <span className="badge-ok">OK</span>}
            </button>
          );
        })}
      </div>

      <div
        className="supplier-tab-panel"
        id={`supplier-panel-${component.component_id}-${activeSupplier.supplier_option_id}`}
      >
        <div className="row between wrap">
          <div className="row wrap">
            <span className="component-menu-label">Supplier Name</span>
            <input
              className="input supplier-name-input"
              value={activeSupplier.supplier_name}
              onChange={(event) => onUpdateSupplier(activeSupplier.supplier_option_id, { supplier_name: event.target.value })}
            />
          </div>

          <div className="row wrap">
            <select
              className="input"
              value={copySourceId}
              onChange={(event) => setCopySourceId(event.target.value)}
            >
              <option value="">Copy tiers from...</option>
              {options
                .filter((option) => option.supplier_option_id !== activeSupplier.supplier_option_id)
                .map((option) => (
                  <option key={option.supplier_option_id} value={option.supplier_option_id}>
                    {option.supplier_name}
                  </option>
                ))}
            </select>
            <button type="button" onClick={copyFromSupplier} disabled={!copySourceId}>
              Copy Tiers
            </button>
            <button type="button" onClick={() => onRemoveSupplier(activeSupplier.supplier_option_id)}>
              Remove Supplier
            </button>
          </div>
        </div>

        {missingCount > 0 ? (
          <div className="warning-box top-gap">
            <p className="warning">New scenario quantities detected. This supplier is missing {missingCount} required tiers.</p>
          </div>
        ) : null}

        <div className="required-chip-row top-gap">
          {quantities.map((qty) => {
            const present = activeSupplier.tiers.some((tier) => tier.qty === qty);
            return (
              <span
                key={qty}
                id={`required-chip-${component.component_id}-${activeSupplier.supplier_option_id}-${qty}`}
                className={`required-chip ${present ? "present" : "missing"}`}
                title={present ? "Tier exists" : "Missing tier"}
              >
                {qty.toLocaleString()}
              </span>
            );
          })}
        </div>

        <p className="hint">Must match qty exactly. Missing tiers will cause N/A for that quantity.</p>

        <table className="table top-gap">
          <thead>
            <tr>
              <th>Qty</th>
              <th>Price</th>
              <th>Currency</th>
              <th>SST %</th>
              <th>Note</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {activeSupplier.tiers.map((tier, tierIndex) => {
              const isDuplicate = (qtyCount.get(tier.qty) ?? 0) > 1;
              return (
                <tr
                  key={`${activeSupplier.supplier_option_id}-${tierIndex}`}
                  id={`tier-row-${component.component_id}-${activeSupplier.supplier_option_id}-${tier.qty}`}
                  className={isDuplicate ? "tier-row-invalid" : ""}
                >
                  <td>
                    <FormattedNumberInput
                      value={tier.qty}
                      onChange={(value) => onUpdateTier(activeSupplier.supplier_option_id, tierIndex, { qty: Math.max(0, Math.floor(value)) })}
                      integerOnly
                      className="input"
                    />
                    {isDuplicate ? <div className="error inline-error">Duplicate qty</div> : null}
                  </td>
                  <td>
                    <FormattedNumberInput
                      value={tier.price}
                      onChange={(value) => onUpdateTier(activeSupplier.supplier_option_id, tierIndex, { price: Math.max(0, value) })}
                      decimalScale={4}
                      className="input"
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      value={tier.currency}
                      onChange={(event) => onUpdateTier(activeSupplier.supplier_option_id, tierIndex, { currency: event.target.value as "MYR" | "RMB" })}
                    >
                      <option value="MYR">MYR</option>
                      <option value="RMB">RMB</option>
                    </select>
                  </td>
                  <td>
                    <FormattedNumberInput
                      value={tier.sst_pct}
                      onChange={(value) => onUpdateTier(activeSupplier.supplier_option_id, tierIndex, { sst_pct: Math.max(0, Math.min(100, value)) })}
                      decimalScale={2}
                      className="input"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={tier.note ?? ""}
                      onChange={(event) => onUpdateTier(activeSupplier.supplier_option_id, tierIndex, { note: event.target.value })}
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => onRemoveTier(activeSupplier.supplier_option_id, tierIndex)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button type="button" onClick={() => onAddTier(activeSupplier.supplier_option_id)}>
          Add Tier Row
        </button>
      </div>
    </div>
  );
}
