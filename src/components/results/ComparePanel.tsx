import type { SupplierCompareTable } from "../../lib/calc/types";
import { formatNumber } from "../../lib/format/numberFormat";

type Props = {
  tables: SupplierCompareTable[];
  selectedComponentId?: string;
  onSelectComponentId?: (componentId: string) => void;
};

export function ComparePanel({ tables, selectedComponentId, onSelectComponentId }: Props) {
  if (tables.length === 0) {
    return <p>No multi-supplier components to compare.</p>;
  }

  const active =
    (selectedComponentId ? tables.find((table) => table.component_id === selectedComponentId) : undefined) ??
    tables[0];

  return (
    <div>
      <div className="row wrap">
        <span className="component-menu-label">Component</span>
        <select
          className="input"
          value={active.component_id}
          onChange={(event) => onSelectComponentId?.(event.target.value)}
        >
          {tables.map((table) => (
            <option key={table.component_id} value={table.component_id}>
              {table.component_name}
            </option>
          ))}
        </select>
      </div>

      <div className="table-scroll">
        <table className="table top-gap">
          <thead>
            <tr>
              <th>Qty</th>
              {active.supplierHeaders.map((header) => (
                <th className="num" key={header.supplier_option_id}>
                  {header.supplier_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.rows.map((row) => (
              <tr key={`${active.component_id}-${row.qty}`}>
                <td>{row.qty.toLocaleString()}</td>
                {active.supplierHeaders.map((header) => {
                  const value = row.costsBySupplier[header.supplier_option_id];
                  const isBest = row.bestSupplierOptionId === header.supplier_option_id;
                  return (
                    <td
                      key={`${row.qty}-${header.supplier_option_id}`}
                      className={`num ${isBest ? "best-cell" : ""} ${value === null ? "muted-cell" : ""}`}
                      title={value === null ? "Missing tier" : ""}
                    >
                      {value === null ? "N/A" : formatNumber(value, 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
