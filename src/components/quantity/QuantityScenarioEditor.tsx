import { useState } from "react";

import { FormattedNumberInput } from "../numeric/FormattedNumberInput";

type Props = {
  quantities: number[];
  onChange: (values: number[]) => void;
  shouldConfirmRemove?: (qty: number) => boolean;
};

const presets = [10000, 50000, 100000, 150000, 200000];
const presetSet = [50000, 100000, 150000];

export function QuantityScenarioEditor({ quantities, onChange, shouldConfirmRemove }: Props) {
  const [draftQty, setDraftQty] = useState(0);

  const setAt = (index: number, value: number) => {
    const normalized = Math.max(0, Math.floor(value));
    const existsElsewhere = quantities.some((qty, idx) => idx !== index && qty === normalized);
    if (existsElsewhere) {
      return;
    }

    const next = [...quantities];
    next[index] = normalized;
    onChange(next);
  };

  const removeAt = (index: number) => {
    const qty = quantities[index];
    if (shouldConfirmRemove?.(qty)) {
      const proceed = window.confirm(
        `Quantity ${qty.toLocaleString()} appears in tier tables. Remove it anyway?`,
      );
      if (!proceed) {
        return;
      }
    }

    onChange(quantities.filter((_, idx) => idx !== index));
  };

  const addRow = (value?: number) => {
    const normalized = Math.max(0, Math.floor(value ?? draftQty));
    if (quantities.includes(normalized)) {
      return;
    }
    onChange([...quantities, normalized]);
  };

  const addPreset = (value: number) => {
    if (quantities.includes(value)) {
      return;
    }
    onChange([...quantities, value]);
  };

  const addPresetSet = () => {
    const merged = [...quantities];
    presetSet.forEach((qty) => {
      if (!merged.includes(qty)) {
        merged.push(qty);
      }
    });
    onChange(merged);
  };

  const clearAll = () => {
    const proceed = window.confirm("Clear all quantity scenarios?");
    if (!proceed) {
      return;
    }
    onChange([]);
  };

  return (
    <section className="card">
      <div className="row between wrap">
        <h3>Quantity Scenarios</h3>
        <div className="row wrap">
          <button type="button" onClick={addPresetSet}>
            Add 50k/100k/150k
          </button>
          <button type="button" onClick={clearAll}>
            Clear All
          </button>
        </div>
      </div>

      <div className="preset-row">
        {presets.map((value) => (
          <button key={value} type="button" onClick={() => addPreset(value)}>
            {value.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="row wrap top-gap quantity-inline-add">
        <FormattedNumberInput
          value={draftQty}
          onChange={(value) => setDraftQty(Math.max(0, Math.floor(value)))}
          integerOnly
          className="input"
        />
        <button type="button" onClick={() => addRow()}>
          Add Quantity
        </button>
      </div>

      {quantities.map((qty, index) => (
        <div className="row" key={`qty-row-${index}`}>
          <FormattedNumberInput
            value={qty}
            onChange={(value) => setAt(index, value)}
            integerOnly
            className="input"
          />
          <button type="button" onClick={() => removeAt(index)}>
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
