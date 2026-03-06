import { Link, Navigate, Route, Routes } from "react-router-dom";

import { ExportPage } from "../pages/ExportPage";
import { ManualPage } from "../pages/ManualPage";
import { QuoteBuilderPage } from "../pages/QuoteBuilderPage";
import { ResultsPage } from "../pages/ResultsPage";
import { SettingsPage } from "../pages/SettingsPage";

export function AppRouter() {
  return (
    <div>
      <nav className="top-nav">
        <Link to="/">Quote Builder</Link>
        <Link to="/results">Results</Link>
        <Link to="/settings">Settings</Link>
        <Link to="/export">Export</Link>
        <Link to="/manual">Manual</Link>
      </nav>

      <Routes>
        <Route path="/" element={<QuoteBuilderPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/manual" element={<ManualPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
