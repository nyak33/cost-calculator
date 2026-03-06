import { exportQuoteToXlsx } from "../lib/export/exportXlsx";
import { useQuoteStore } from "../store/useQuoteStore";

export function ExportPage() {
  const { settings, components, results, supplierCompare } = useQuoteStore();

  return (
    <main className="page">
      <h1>Export</h1>
      <p>Export current quote with summary, breakdown, supplier compare, warnings, and settings snapshot.</p>
      <button
        type="button"
        onClick={async () => {
          await exportQuoteToXlsx({
            settings,
            components,
            results,
            supplierCompare,
          });
        }}
      >
        Export to Excel
      </button>
    </main>
  );
}
