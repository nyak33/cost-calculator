import { useMemo, useState } from "react";

import type { CostLine, QtyResult } from "../../lib/calc/types";
import { formatNumber } from "../../lib/format/numberFormat";

type Props = {
  rows: QtyResult[];
  selectedQty?: number;
  onSelectQty?: (qty: number) => void;
  onJumpToComponent?: (componentId: string) => void;
  moneyDecimals: number;
  weightDecimals: number;
};

type ViewMode = "component" | "supplier";

function aggregateBySupplier(lines: CostLine[]) {
  const map = new Map<string, { supplier: string; cost: number; sell: number; profit: number; components: string[] }>();

  lines.forEach((line) => {
    const key = line.supplier_name ?? "(No Supplier)";
    const current = map.get(key) ?? { supplier: key, cost: 0, sell: 0, profit: 0, components: [] };
    current.cost += line.cost_myr;
    current.sell += line.sell_myr;
    current.profit += line.profit_myr;
    current.components.push(line.component_name);
    map.set(key, current);
  });

  return [...map.values()];
}

export function BreakdownTable({ rows, selectedQty, onSelectQty, onJumpToComponent, moneyDecimals, weightDecimals }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("component");

  const selectedRow = useMemo(() => {
    if (rows.length === 0) {
      return undefined;
    }

    if (selectedQty !== undefined) {
      return rows.find((row) => row.qty === selectedQty) ?? rows[0];
    }

    return rows[0];
  }, [rows, selectedQty]);

  if (!selectedRow) {
    return <p>No quantity results yet.</p>;
  }

  return (
    <div className="breakdown-panel">
      <div className="row between wrap">
        <div className="row wrap">
          <span className="component-menu-label">Selected Quantity</span>
          <select className="input" value={selectedRow.qty} onChange={(event) => onSelectQty?.(Number(event.target.value))}>
            {rows.map((row) => (
              <option key={row.qty} value={row.qty}>
                {row.qty.toLocaleString()} ({row.status})
              </option>
            ))}
          </select>
        </div>

        <div className="row wrap">
          <button type="button" onClick={() => setViewMode("component")} className={viewMode === "component" ? "active-tab-btn" : ""}>
            Group by Component
          </button>
          <button type="button" onClick={() => setViewMode("supplier")} className={viewMode === "supplier" ? "active-tab-btn" : ""}>
            Group by Supplier
          </button>
        </div>
      </div>

      <div className="info-strip top-gap">
        <span>code_qty: {selectedRow.derived.code_qty.toLocaleString()}</span>
        <span>total_weight: {formatNumber(selectedRow.derived.total_weight, weightDecimals)}</span>
        <span>area_m2: {formatNumber(selectedRow.derived.area_m2, 6)}</span>
      </div>

      {selectedRow.status === "NA" ? (
        <p className="warning top-gap">N/A due to missing/invalid component data.</p>
      ) : viewMode === "component" ? (
        <div className="table-scroll">
          <table className="table top-gap">
            <thead>
              <tr>
                <th>Component</th>
                <th>Chosen Supplier</th>
                <th className="num">Cost</th>
                <th className="num">Sell</th>
                <th className="num">Profit</th>
                <th>Tag</th>
              </tr>
            </thead>
            <tbody>
              {selectedRow.lines.map((line, index) => (
                <tr key={`${line.component_id}-${index}`} onClick={() => onJumpToComponent?.(line.component_id)}>
                  <td>{line.component_name}</td>
                  <td>{line.supplier_name ?? "-"}</td>
                  <td className="num">{formatNumber(line.cost_myr, moneyDecimals)}</td>
                  <td className="num">{formatNumber(line.sell_myr, moneyDecimals)}</td>
                  <td className="num">{formatNumber(line.profit_myr, moneyDecimals)}</td>
                  <td>{line.tag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table top-gap">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Components</th>
                <th className="num">Cost</th>
                <th className="num">Sell</th>
                <th className="num">Profit</th>
              </tr>
            </thead>
            <tbody>
              {aggregateBySupplier(selectedRow.lines).map((group) => (
                <tr key={group.supplier}>
                  <td>{group.supplier}</td>
                  <td>{Array.from(new Set(group.components)).join(", ")}</td>
                  <td className="num">{formatNumber(group.cost, moneyDecimals)}</td>
                  <td className="num">{formatNumber(group.sell, moneyDecimals)}</td>
                  <td className="num">{formatNumber(group.profit, moneyDecimals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
