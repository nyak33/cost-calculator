import type { QtyResult } from "../../lib/calc/types";
import { formatInteger, formatNumber } from "../../lib/format/numberFormat";

type Props = {
  rows: QtyResult[];
  moneyDecimals: number;
  unitDecimals: number;
  percentDecimals: number;
  selectedQty?: number;
  onSelectQty?: (qty: number) => void;
  showChosenSuppliers?: boolean;
  renderChosenSuppliers?: (row: QtyResult) => string;
};

export function SummaryTable({
  rows,
  moneyDecimals,
  unitDecimals,
  percentDecimals,
  selectedQty,
  onSelectQty,
  showChosenSuppliers = false,
  renderChosenSuppliers,
}: Props) {
  return (
    <div className="table-scroll">
      <table className="table summary-table">
        <thead>
          <tr>
            <th>Quantity</th>
            {showChosenSuppliers ? <th>Chosen Suppliers</th> : null}
            <th className="num">Total Cost (MYR)</th>
            <th className="num">Unit Cost (MYR/pc)</th>
            <th className="num">Total Price (MYR)</th>
            <th className="num">Unit Price (MYR/pc)</th>
            <th className="num">Total Profit (MYR)</th>
            <th className="num">Overall Margin %</th>
            <th className="num">Margin Excl Pass-through %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const title = row.warnings.join("\n");
            const isSelected = selectedQty === row.qty;

            return (
              <tr
                key={row.qty}
                className={`${row.status === "NA" ? "na-row" : ""} ${isSelected ? "selected-row" : ""}`}
                title={title}
                onClick={() => onSelectQty?.(row.qty)}
                role={onSelectQty ? "button" : undefined}
              >
                <td>{formatInteger(row.qty)}</td>
                {showChosenSuppliers ? <td>{renderChosenSuppliers ? renderChosenSuppliers(row) : "-"}</td> : null}
                <td className="num">{formatNumber(row.totals.cost_total_myr, moneyDecimals)}</td>
                <td className="num">{formatNumber(row.totals.unit_cost_myr, unitDecimals)}</td>
                <td className="num">{formatNumber(row.totals.sell_total_myr, moneyDecimals)}</td>
                <td className="num">{formatNumber(row.totals.unit_price_myr, unitDecimals)}</td>
                <td className="num">{formatNumber(row.totals.profit_total_myr, moneyDecimals)}</td>
                <td className="num">{formatNumber(row.totals.overall_margin_pct, percentDecimals)}</td>
                <td className="num">{formatNumber(row.totals.margin_ex_pass_through_pct, percentDecimals)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
