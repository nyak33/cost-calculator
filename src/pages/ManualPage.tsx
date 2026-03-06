import { Link } from "react-router-dom";

export function ManualPage() {
  return (
    <main className="page">
      <section className="card">
        <div className="row between wrap">
          <div>
            <h1>User Manual</h1>
            <p className="hint">Quick guide for creating quotes with multiple quantities, components, and suppliers.</p>
          </div>
          <div className="row wrap">
            <Link to="/" className="nav-action-link">
              Quote Builder
            </Link>
            <Link to="/results" className="nav-action-link">
              Results
            </Link>
            <Link to="/settings" className="nav-action-link">
              Settings
            </Link>
          </div>
        </div>
      </section>

      <section className="card manual-section">
        <h3>1. Basic Workflow</h3>
        <ol className="manual-list">
          <li>Open <strong>Quote Builder</strong>.</li>
          <li>Set label size in <strong>Production Inputs</strong>.</li>
          <li>Add your quantity scenarios (for example: 50,000 / 100,000 / 150,000).</li>
          <li>Configure components and choose mode: <strong>Tier</strong> or <strong>Formula</strong>.</li>
          <li>Open <strong>Results</strong> to review summary, breakdown, warnings, and compare tables.</li>
          <li>Use <strong>Export</strong> to download Excel.</li>
        </ol>
      </section>

      <section className="card manual-section">
        <h3>2. Component Modes</h3>
        <ul className="manual-list">
          <li>
            <strong>Tier Mode</strong>: price must match quantity exactly. If tier is missing, that quantity becomes N/A.
          </li>
          <li>
            <strong>Formula Mode</strong>: use Simple or Advanced editor and click <strong>Apply</strong> to commit changes.
          </li>
          <li>You can switch Tier/Formula back and forth anytime for each component.</li>
        </ul>
      </section>

      <section className="card manual-section">
        <h3>3. Formula Builder</h3>
        <ul className="manual-list">
          <li>
            <strong>Simple Mode</strong>: choose a template (Fixed, Per Qty, Per Code, Per KG, etc.) and fill guided fields.
          </li>
          <li>
            <strong>Advanced Mode</strong>: edit expression manually, insert variables/functions/component refs, auto-create parameters.
          </li>
          <li>Preview panel shows calculated cost/sell/profit for selected quantity before applying.</li>
        </ul>
      </section>

      <section className="card manual-section">
        <h3>4. Warnings and Fixing</h3>
        <ul className="manual-list">
          <li>Warnings tab lists missing tiers and formula issues by quantity/component.</li>
          <li>Use <strong>Fix</strong> to jump to the component.</li>
          <li>Use <strong>Auto-add missing tier</strong> or <strong>Auto-fill all missing tiers</strong> for faster setup.</li>
        </ul>
      </section>

      <section className="card manual-section">
        <h3>5. Notes</h3>
        <ul className="manual-list">
          <li>All data is saved in browser localStorage on this machine.</li>
          <li>Use <strong>Reset to defaults</strong> in Settings if needed.</li>
          <li>Currency normalization and quote calculations are handled automatically by the engine.</li>
        </ul>
      </section>
    </main>
  );
}

