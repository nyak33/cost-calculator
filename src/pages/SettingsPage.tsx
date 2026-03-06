import { FormattedNumberInput } from "../components/numeric/FormattedNumberInput";
import { useQuoteStore } from "../store/useQuoteStore";

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SettingsPage() {
  const { settings, updateSettings, resetDefaults } = useQuoteStore();

  return (
    <main className="page">
      <h1>Settings</h1>

      <section className="card">
        <h3>Currency</h3>
        <div className="settings-grid settings-grid-1">
          <div className="settings-field">
            <div className="settings-label">Exchange rate (1 MYR = X RMB)</div>
            <FormattedNumberInput
              value={settings.rmb_per_myr}
              onChange={(value) => updateSettings({ rmb_per_myr: Math.max(0.0001, value) })}
              decimalScale={6}
              className="input settings-control"
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Production Assumptions</h3>
        <div className="settings-grid settings-grid-2">
          <div className="settings-field">
            <div className="settings-label">Weight factor</div>
            <FormattedNumberInput
              value={settings.weight_factor}
              onChange={(value) => updateSettings({ weight_factor: Math.max(0, value) })}
              decimalScale={6}
              className="input settings-control"
            />
          </div>
          <div className="settings-field">
            <div className="settings-label">Buffer %</div>
            <FormattedNumberInput
              value={settings.buffer_pct}
              onChange={(value) => updateSettings({ buffer_pct: Math.max(0, Math.min(100, value)) })}
              decimalScale={2}
              className="input settings-control"
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Fees</h3>
        <div className="settings-grid settings-grid-3">
          <div className="settings-field">
            <div className="settings-label">Intl RM per KG</div>
            <FormattedNumberInput
              value={settings.intl_rm_per_kg}
              onChange={(value) => updateSettings({ intl_rm_per_kg: Math.max(0, value) })}
              decimalScale={4}
              className="input settings-control"
            />
          </div>
          <div className="settings-field">
            <div className="settings-label">Kood Fee MYR per code</div>
            <FormattedNumberInput
              value={settings.kood_fee_myr_per_code}
              onChange={(value) => updateSettings({ kood_fee_myr_per_code: Math.max(0, value) })}
              decimalScale={6}
              className="input settings-control"
            />
          </div>
          <div className="settings-field">
            <div className="settings-label">Qdots Fee RMB per code</div>
            <FormattedNumberInput
              value={settings.qdots_fee_rmb_per_code}
              onChange={(value) => updateSettings({ qdots_fee_rmb_per_code: Math.max(0, value) })}
              decimalScale={6}
              className="input settings-control"
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Tax / SST</h3>
        <div className="settings-grid settings-grid-1">
          <div className="settings-field">
            <div className="settings-label">SST Margin Mode</div>
            <select
              className="input settings-control settings-select"
              value={settings.sst_margin_mode}
              onChange={(event) => updateSettings({ sst_margin_mode: event.target.value as "apply_margin" | "pass_through" })}
            >
              <option value="apply_margin">Apply margin on SST (default)</option>
              <option value="pass_through">SST pass-through (no profit)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Tagging Rules</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Values (comma separated)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pass-through Name List</td>
              <td>
                <input
                  className="input settings-tag-input"
                  value={settings.pass_through_name_list.join(", ")}
                  onChange={(event) => updateSettings({ pass_through_name_list: splitTags(event.target.value) })}
                />
              </td>
            </tr>
            <tr>
              <td>Margin Name List</td>
              <td>
                <input
                  className="input settings-tag-input"
                  value={settings.margin_name_list.join(", ")}
                  onChange={(event) => updateSettings({ margin_name_list: splitTags(event.target.value) })}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Formatting</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Decimals</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Money decimals</td>
              <td>
                <FormattedNumberInput
                  value={settings.formatting.money_decimals}
                  onChange={(value) => updateSettings({ formatting: { ...settings.formatting, money_decimals: Math.max(0, Math.floor(value)) } })}
                  integerOnly
                  className="input settings-decimal-input"
                />
              </td>
            </tr>
            <tr>
              <td>Unit decimals</td>
              <td>
                <FormattedNumberInput
                  value={settings.formatting.unit_decimals}
                  onChange={(value) => updateSettings({ formatting: { ...settings.formatting, unit_decimals: Math.max(0, Math.floor(value)) } })}
                  integerOnly
                  className="input settings-decimal-input"
                />
              </td>
            </tr>
            <tr>
              <td>Percent decimals</td>
              <td>
                <FormattedNumberInput
                  value={settings.formatting.percent_decimals}
                  onChange={(value) => updateSettings({ formatting: { ...settings.formatting, percent_decimals: Math.max(0, Math.floor(value)) } })}
                  integerOnly
                  className="input settings-decimal-input"
                />
              </td>
            </tr>
            <tr>
              <td>Weight decimals</td>
              <td>
                <FormattedNumberInput
                  value={settings.formatting.weight_decimals}
                  onChange={(value) => updateSettings({ formatting: { ...settings.formatting, weight_decimals: Math.max(0, Math.floor(value)) } })}
                  integerOnly
                  className="input settings-decimal-input"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="settings-actions">
        <button type="button" onClick={resetDefaults}>
          Reset to defaults
        </button>
      </div>
    </main>
  );
}
