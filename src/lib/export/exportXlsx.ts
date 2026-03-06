import type { ComputeQuoteOutput, JobInputs, QuoteComponent, Settings, SupplierCompareTable } from "../calc/types";

interface ExportInput {
  settings: Settings;
  jobInputs: JobInputs;
  components: QuoteComponent[];
  results: ComputeQuoteOutput;
  supplierCompare: SupplierCompareTable[];
}

function buildSummaryRows(results: ComputeQuoteOutput, jobName: string) {
  return results.per_qty.map((row) => ({
    "Job Name": jobName,
    Quantity: row.qty,
    Status: row.status,
    "Total Cost (MYR)": row.totals.cost_total_myr,
    "Unit Cost (MYR/pc)": row.totals.unit_cost_myr,
    "Total Price (MYR)": row.totals.sell_total_myr,
    "Unit Price (MYR/pc)": row.totals.unit_price_myr,
    "Total Profit (MYR)": row.totals.profit_total_myr,
    "Overall Margin %": row.totals.overall_margin_pct,
    "Margin Excl Pass-through %": row.totals.margin_ex_pass_through_pct,
    Warnings: row.warnings.join(" | "),
  }));
}

function buildBreakdownRows(results: ComputeQuoteOutput, jobName: string) {
  const rows: Array<Record<string, unknown>> = [];

  results.per_qty.forEach((qtyResult) => {
    if (qtyResult.status !== "OK") {
      rows.push({
        "Job Name": jobName,
        Quantity: qtyResult.qty,
        Component: "N/A",
        Supplier: "N/A",
        "Cost (MYR)": null,
        "Sell (MYR)": null,
        "Profit (MYR)": null,
        Tag: "N/A",
        code_qty: qtyResult.derived.code_qty,
        total_weight: qtyResult.derived.total_weight,
        area_m2: qtyResult.derived.area_m2,
      });
      return;
    }

    qtyResult.lines.forEach((line) => {
      rows.push({
        "Job Name": jobName,
        Quantity: qtyResult.qty,
        Component: line.component_name,
        Supplier: line.supplier_name ?? "",
        "Cost (MYR)": line.cost_myr,
        "Sell (MYR)": line.sell_myr,
        "Profit (MYR)": line.profit_myr,
        Tag: line.tag,
        code_qty: qtyResult.derived.code_qty,
        total_weight: qtyResult.derived.total_weight,
        area_m2: qtyResult.derived.area_m2,
      });
    });
  });

  return rows;
}

function buildSupplierCompareRows(tables: SupplierCompareTable[]) {
  const rows: Array<Record<string, unknown>> = [];

  tables.forEach((table) => {
    table.rows.forEach((row) => {
      const base: Record<string, unknown> = {
        Component: table.component_name,
        Quantity: row.qty,
        "Best Supplier Option": row.bestSupplierOptionId ?? "N/A",
      };

      table.supplierHeaders.forEach((header) => {
        base[header.supplier_name] = row.costsBySupplier[header.supplier_option_id] ?? null;
      });

      rows.push(base);
    });
  });

  return rows;
}

function buildWarningsRows(results: ComputeQuoteOutput) {
  return results.warnings.map((warning) => ({
    Quantity: warning.qty,
    Component: warning.component_id,
    SupplierOption: warning.supplier_option_id ?? "",
    Message: warning.message,
  }));
}

function buildSettingsRows(settings: Settings, jobInputs: JobInputs) {
  return [
    {
      job_name: jobInputs.job_name,
      width_mm: jobInputs.width_mm,
      height_mm: jobInputs.height_mm,
      quantity_scenarios: jobInputs.quantity_scenarios.join(", "),
      rmb_per_myr: settings.rmb_per_myr,
      weight_factor: settings.weight_factor,
      buffer_pct: settings.buffer_pct,
      intl_rm_per_kg: settings.intl_rm_per_kg,
      kood_fee_myr_per_code: settings.kood_fee_myr_per_code,
      qdots_fee_rmb_per_code: settings.qdots_fee_rmb_per_code,
      sst_margin_mode: settings.sst_margin_mode,
      pass_through_name_list: settings.pass_through_name_list.join(", "),
      margin_name_list: settings.margin_name_list.join(", "),
      money_decimals: settings.formatting.money_decimals,
      unit_decimals: settings.formatting.unit_decimals,
      percent_decimals: settings.formatting.percent_decimals,
      weight_decimals: settings.formatting.weight_decimals,
    },
  ];
}

function addSheet(XLSX: typeof import("xlsx"), wb: import("xlsx").WorkBook, name: string, rows: Array<Record<string, unknown>>) {
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Empty: "" }]);
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as import("xlsx").WorkSheet["!freeze"];
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export async function exportQuoteToXlsx(input: ExportInput): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const jobName = input.jobInputs.job_name?.trim() || "Untitled Quote";

  addSheet(XLSX, wb, "Summary", buildSummaryRows(input.results, jobName));
  addSheet(XLSX, wb, "Breakdown", buildBreakdownRows(input.results, jobName));
  addSheet(XLSX, wb, "Supplier Compare", buildSupplierCompareRows(input.supplierCompare));
  addSheet(XLSX, wb, "Warnings", buildWarningsRows(input.results));
  addSheet(XLSX, wb, "Settings", buildSettingsRows(input.settings, input.jobInputs));

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const filename = `quote_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

  XLSX.writeFile(wb, filename);
}
