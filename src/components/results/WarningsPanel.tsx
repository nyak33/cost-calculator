import { useMemo } from "react";

import type { QuoteWarning } from "../../lib/calc/types";

type Props = {
  warnings: QuoteWarning[];
  onFix: (warning: QuoteWarning) => void;
  onAutoAddMissingTier?: (warning: QuoteWarning) => void;
  onAutoAddAllMissing?: () => void;
};

export function WarningsPanel({ warnings, onFix, onAutoAddMissingTier, onAutoAddAllMissing }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, QuoteWarning[]>();
    warnings.forEach((warning) => {
      const key = warning.qty >= 0 ? warning.qty.toLocaleString() : "Global";
      const list = map.get(key) ?? [];
      list.push(warning);
      map.set(key, list);
    });
    return [...map.entries()];
  }, [warnings]);

  if (warnings.length === 0) {
    return <p>No warnings.</p>;
  }

  return (
    <div>
      <div className="row between wrap">
        <strong>Actionable Warnings</strong>
        {onAutoAddAllMissing ? (
          <button type="button" onClick={onAutoAddAllMissing}>
            Auto-fill all missing tiers
          </button>
        ) : null}
      </div>

      <div className="warnings-groups top-gap">
        {grouped.map(([group, items]) => (
          <section className="warning-group" key={group}>
            <h4>Qty {group}</h4>
            <ul className="warning-list">
              {items.map((warning, index) => {
                const canAutoAdd = warning.qty >= 0 && Boolean(warning.supplier_option_id);

                return (
                  <li key={`${group}-${warning.component_id}-${warning.supplier_option_id ?? "x"}-${index}`} className="warning-item-row">
                    <span>{warning.message}</span>
                    <div className="row wrap">
                      <button type="button" onClick={() => onFix(warning)}>
                        Fix
                      </button>
                      {canAutoAdd && onAutoAddMissingTier ? (
                        <button type="button" onClick={() => onAutoAddMissingTier(warning)}>
                          Auto-add tier row
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
