import { useEffect, useState } from "react";

import { computeQuote } from "../../lib/calc/computeQuote";
import { validateFormulaExpression } from "../../lib/calc/formulaEngine";
import { buildExpressionAndParameters, suggestedSimpleState } from "../../lib/calc/simpleFormulaTemplates";
import type {
  FormulaBuilderUiMeta,
  FormulaParameter,
  JobInputs,
  QtyResult,
  QuoteComponent,
  Settings,
  SimpleBuilderState,
  SimpleTemplateKey,
} from "../../lib/calc/types";
import { FormattedNumberInput } from "../numeric/FormattedNumberInput";

type FormulaDraft = {
  expression: string;
  parameters: FormulaParameter[];
  ui_meta?: FormulaBuilderUiMeta;
  dirty: boolean;
};

type DraftPatch = Partial<{ expression: string; parameters: FormulaParameter[]; ui_meta: FormulaBuilderUiMeta }>;

type Props = {
  component: QuoteComponent;
  quantityScenarios: number[];
  allComponents: QuoteComponent[];
  perQtyResults: QtyResult[];
  settings: Settings;
  jobInputs: JobInputs;
  formulaDraft?: FormulaDraft;
  formulaError?: string | null;
  onInitDraft: (componentId: string) => void;
  onUpdateDraft: (componentId: string, patch: DraftPatch) => void;
  onApplyDraft: (componentId: string) => void;
  onDiscardDraft: (componentId: string) => void;
  onAutoCreateParams: (componentId: string) => void;
};

const variableOptions: Array<{ label: string; token: string }> = [
  { label: "Quantity (qty)", token: "qty" },
  { label: "Code Quantity (code_qty)", token: "code_qty" },
  { label: "Area m^2 (area_m2)", token: "area_m2" },
  { label: "Total Weight (total_weight)", token: "total_weight" },
  { label: "FX Rate (fx)", token: "fx" },
];

const functionOptions: Array<{ label: string; token: string }> = [
  { label: "min(a,b)", token: "min(a, b)" },
  { label: "max(a,b)", token: "max(a, b)" },
  { label: "ceil(x)", token: "ceil(x)" },
  { label: "floor(x)", token: "floor(x)" },
  { label: "round(x)", token: "round(x)" },
];

const templateOptions: Array<{ key: SimpleTemplateKey; label: string }> = [
  { key: "FIXED", label: "Fixed Value" },
  { key: "PER_QTY", label: "Per Quantity" },
  { key: "PER_1000", label: "Per 1,000 pcs" },
  { key: "PER_CODE", label: "Per Code" },
  { key: "PER_KG", label: "Per KG" },
  { key: "PER_KG_PLUS1", label: "Per KG (+1kg buffer)" },
  { key: "PER_M2", label: "Per m^2 (area x qty)" },
  { key: "PCT_OF_COMPONENT_COST", label: "% of Component Cost" },
];

function defaultUiMeta(component: QuoteComponent, settings: Settings): FormulaBuilderUiMeta {
  const existing = component.formula_builder?.ui_meta;
  if (existing) {
    return existing;
  }

  const expression = component.formula_builder?.expression?.trim() ?? "";
  if (expression) {
    return {
      mode: "ADVANCED",
    };
  }

  return {
    mode: "SIMPLE",
    simple_state: suggestedSimpleState(component, settings),
  };
}

function mergeDraft(component: QuoteComponent, settings: Settings, draft?: FormulaDraft): FormulaDraft {
  if (draft) {
    return draft;
  }

  const uiMeta = defaultUiMeta(component, settings);
  const expression = component.formula_builder?.expression ?? "";
  const parameters = component.formula_builder?.parameters ?? [];

  if (!expression.trim() && uiMeta.mode === "SIMPLE" && uiMeta.simple_state) {
    const generated = buildExpressionAndParameters(uiMeta.simple_state);
    return {
      expression: generated.ok ? generated.expression ?? "" : "",
      parameters: generated.ok ? generated.parameters ?? [] : [],
      ui_meta: uiMeta,
      dirty: false,
    };
  }

  return {
    expression,
    parameters,
    ui_meta: uiMeta,
    dirty: false,
  };
}

export function FormulaEditor({
  component,
  quantityScenarios,
  allComponents,
  perQtyResults,
  settings,
  jobInputs,
  formulaDraft,
  formulaError,
  onInitDraft,
  onUpdateDraft,
  onApplyDraft,
  onDiscardDraft,
  onAutoCreateParams,
}: Props) {
  const [selectedQty, setSelectedQty] = useState(quantityScenarios[0] ?? 0);

  useEffect(() => {
    onInitDraft(component.component_id);
  }, [component.component_id, onInitDraft]);

  const draft = mergeDraft(component, settings, formulaDraft);
  const uiMeta = draft.ui_meta ?? defaultUiMeta(component, settings);
  const mode = uiMeta.mode;
  const activeSelectedQty = quantityScenarios.includes(selectedQty) ? selectedQty : (quantityScenarios[0] ?? 0);

  const simpleState = uiMeta.simple_state ?? suggestedSimpleState(component, settings);
  const generatedFromSimple = mode === "SIMPLE" ? buildExpressionAndParameters(simpleState) : null;
  const validation = validateFormulaExpression(draft.expression, draft.parameters);

  const disableApply = mode === "SIMPLE"
    ? !(generatedFromSimple?.ok && validation.ok && draft.expression.trim())
    : !(validation.ok && draft.expression.trim());

  const updateDraft = (patch: DraftPatch) => {
    onUpdateDraft(component.component_id, patch);
  };

  const applySimpleState = (nextSimpleState: SimpleBuilderState) => {
    const generated = buildExpressionAndParameters(nextSimpleState);

    updateDraft({
      ui_meta: {
        ...uiMeta,
        mode: "SIMPLE",
        simple_state: nextSimpleState,
      },
      expression: generated.ok ? generated.expression ?? "" : "",
      parameters: generated.ok ? generated.parameters ?? [] : [],
    });
  };

  const switchMode = (nextMode: "SIMPLE" | "ADVANCED") => {
    if (nextMode === mode) {
      return;
    }

    if (nextMode === "SIMPLE") {
      const hasPotentialOverwrite = mode === "ADVANCED" && draft.expression.trim() && !uiMeta.simple_state;
      if (hasPotentialOverwrite) {
        const confirmed = window.confirm("Switching to Simple mode may overwrite custom expression. Continue?");
        if (!confirmed) {
          return;
        }
      }

      const nextSimpleState = uiMeta.simple_state ?? suggestedSimpleState(component, settings);
      applySimpleState(nextSimpleState);
      return;
    }

    updateDraft({
      ui_meta: {
        ...uiMeta,
        mode: "ADVANCED",
      },
    });
  };

  const setTemplate = (templateKey: SimpleTemplateKey) => {
    const nextSimpleState: SimpleBuilderState = {
      ...simpleState,
      template_key: templateKey,
    };

    if (templateKey === "PER_QTY") {
      nextSimpleState.rounding = nextSimpleState.rounding ?? "NONE";
    }

    applySimpleState(nextSimpleState);
  };

  const updateSimpleField = (patch: Partial<SimpleBuilderState>) => {
    applySimpleState({ ...simpleState, ...patch });
  };

  const appendToken = (token: string) => {
    const base = draft.expression.trim();
    const next = base.length === 0 ? token : `${draft.expression} ${token}`;
    updateDraft({
      expression: next,
      ui_meta: {
        ...uiMeta,
        mode: "ADVANCED",
      },
    });
  };

  const updateAdvancedParam = (
    index: number,
    patch: Partial<{ name: string; value: number; currency: "MYR" | "RMB" }>,
  ) => {
    const next = draft.parameters.map((parameter, itemIndex) =>
      itemIndex === index ? { ...parameter, ...patch } : parameter,
    );
    updateDraft({
      parameters: next,
      ui_meta: {
        ...uiMeta,
        mode: "ADVANCED",
      },
    });
  };

  const removeAdvancedParam = (index: number) => {
    updateDraft({
      parameters: draft.parameters.filter((_, itemIndex) => itemIndex !== index),
      ui_meta: {
        ...uiMeta,
        mode: "ADVANCED",
      },
    });
  };

  const addAdvancedParam = () => {
    updateDraft({
      parameters: [
        ...draft.parameters,
        {
          name: `param_${draft.parameters.length + 1}`,
          value: 0,
          currency: "MYR",
        },
      ],
      ui_meta: {
        ...uiMeta,
        mode: "ADVANCED",
      },
    });
  };

  const livePreview = (() => {
    if (!activeSelectedQty) {
      return {
        status: "NA" as const,
        message: "No quantity scenario selected",
      };
    }

    if (!draft.expression.trim()) {
      return {
        status: "NA" as const,
        message: "Expression is empty",
      };
    }

    if (!draft.dirty) {
      const committedRow = perQtyResults.find((item) => item.qty === activeSelectedQty);
      if (!committedRow || committedRow.status !== "OK") {
        return {
          status: "NA" as const,
          message: committedRow?.warnings?.[0] ?? "N/A",
        };
      }

      const committedLine = committedRow.lines.find(
        (item) => item.component_id === component.component_id && !item.is_sst_pass_through,
      );

      if (!committedLine) {
        return {
          status: "NA" as const,
          message: "No line result",
        };
      }

      return {
        status: "OK" as const,
        cost: committedLine.cost_myr,
        sell: committedLine.sell_myr,
        profit: committedLine.profit_myr,
        derived: committedRow.derived,
        tag: component.tag,
      };
    }

    const previewComponents = allComponents.map((item) => {
      if (item.component_id !== component.component_id) {
        return item;
      }

      return {
        ...item,
        formula_builder: {
          expression: draft.expression,
          parameters: draft.parameters,
          ui_meta: uiMeta,
        },
      };
    });

    const preview = computeQuote({
      settings,
      job: {
        ...jobInputs,
        quantity_scenarios: [activeSelectedQty],
      },
      components: previewComponents,
    });

    const row = preview.per_qty[0];
    if (!row || row.status !== "OK") {
      return {
        status: "NA" as const,
        message: row?.warnings?.[0] ?? preview.warnings[0]?.message ?? "N/A",
      };
    }

    const line = row.lines.find((item) => item.component_id === component.component_id && !item.is_sst_pass_through);
    if (!line) {
      return {
        status: "NA" as const,
        message: "No line result",
      };
    }

    return {
      status: "OK" as const,
      cost: line.cost_myr,
      sell: line.sell_myr,
      profit: line.profit_myr,
      derived: row.derived,
      tag: component.tag,
    };
  })();

  const committedValue = (() => {
    const qtyResult = perQtyResults.find((item) => item.qty === activeSelectedQty);
    if (!qtyResult || qtyResult.status !== "OK") {
      return null;
    }

    const line = qtyResult.lines.find((item) => item.component_id === component.component_id);
    return line?.cost_myr ?? null;
  })();

  return (
    <div className="formula-editor">
      <div className="formula-toolbar row between wrap">
        <div className="mode-segment" role="group" aria-label="Formula mode">
          <button
            type="button"
            className={mode === "SIMPLE" ? "segment-btn active" : "segment-btn"}
            onClick={() => switchMode("SIMPLE")}
          >
            Simple
          </button>
          <button
            type="button"
            className={mode === "ADVANCED" ? "segment-btn active" : "segment-btn"}
            onClick={() => switchMode("ADVANCED")}
          >
            Advanced
          </button>
        </div>

        <div className="row wrap">
          <button type="button" className="primary-btn" onClick={() => onApplyDraft(component.component_id)} disabled={disableApply}>
            Apply
          </button>
          <button type="button" onClick={() => onDiscardDraft(component.component_id)}>
            Reset
          </button>
          {draft.dirty ? <span className="status-pill warn">Unsaved draft</span> : <span className="status-pill ok">Applied</span>}
        </div>
      </div>

      {mode === "SIMPLE" ? (
        <div className="simple-formula-card top-gap">
          <div className="row wrap formula-template-row">
            {templateOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`template-chip ${simpleState.template_key === option.key ? "active" : ""}`}
                onClick={() => setTemplate(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="settings-grid settings-grid-2 top-gap">
            <div className="settings-field">
              <div className="settings-label">How is this cost calculated?</div>
              <select
                className="input settings-control"
                value={simpleState.template_key}
                onChange={(event) => setTemplate(event.target.value as SimpleTemplateKey)}
              >
                {templateOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {simpleState.template_key === "PER_QTY" ? (
              <div className="settings-field">
                <div className="settings-label">Rounding</div>
                <select
                  className="input settings-control"
                  value={simpleState.rounding ?? "NONE"}
                  onChange={(event) => updateSimpleField({ rounding: event.target.value as "NONE" | "ROUND_UP_1000" })}
                >
                  <option value="NONE">No rounding</option>
                  <option value="ROUND_UP_1000">Round up by 1,000</option>
                </select>
              </div>
            ) : null}
          </div>

          {simpleState.template_key === "FIXED" ? (
            <div className="settings-grid settings-grid-2 top-gap">
              <div className="settings-field">
                <div className="settings-label">Fixed Amount</div>
                <FormattedNumberInput
                  value={simpleState.value ?? 0}
                  onChange={(value) => updateSimpleField({ value })}
                  decimalScale={6}
                  className="input settings-control"
                />
              </div>
              <div className="settings-field">
                <div className="settings-label">Currency</div>
                <select
                  className="input settings-control"
                  value={simpleState.value_currency ?? "MYR"}
                  onChange={(event) => updateSimpleField({ value_currency: event.target.value as "MYR" | "RMB" })}
                >
                  <option value="MYR">MYR</option>
                  <option value="RMB">RMB</option>
                </select>
              </div>
            </div>
          ) : null}

          {simpleState.template_key !== "FIXED" && simpleState.template_key !== "PCT_OF_COMPONENT_COST" ? (
            <div className="settings-grid settings-grid-2 top-gap">
              <div className="settings-field">
                <div className="settings-label">Rate</div>
                <FormattedNumberInput
                  value={simpleState.rate ?? 0}
                  onChange={(value) => updateSimpleField({ rate: value })}
                  decimalScale={6}
                  className="input settings-control"
                />
              </div>
              <div className="settings-field">
                <div className="settings-label">Currency</div>
                <select
                  className="input settings-control"
                  value={simpleState.rate_currency ?? "MYR"}
                  onChange={(event) => updateSimpleField({ rate_currency: event.target.value as "MYR" | "RMB" })}
                >
                  <option value="MYR">MYR</option>
                  <option value="RMB">RMB</option>
                </select>
              </div>

              <div className="settings-field">
                <label className="row gap">
                  <input
                    type="checkbox"
                    checked={Boolean(simpleState.setup_fee_enabled)}
                    onChange={(event) => updateSimpleField({ setup_fee_enabled: event.target.checked })}
                  />
                  Setup fee (optional)
                </label>
                {simpleState.setup_fee_enabled ? (
                  <div className="row wrap">
                    <FormattedNumberInput
                      value={simpleState.setup_fee ?? 0}
                      onChange={(value) => updateSimpleField({ setup_fee: value })}
                      decimalScale={6}
                      className="input settings-control"
                    />
                    <select
                      className="input"
                      value={simpleState.setup_fee_currency ?? simpleState.rate_currency ?? "MYR"}
                      onChange={(event) => updateSimpleField({ setup_fee_currency: event.target.value as "MYR" | "RMB" })}
                    >
                      <option value="MYR">MYR</option>
                      <option value="RMB">RMB</option>
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="settings-field">
                <label className="row gap">
                  <input
                    type="checkbox"
                    checked={Boolean(simpleState.min_charge_enabled)}
                    onChange={(event) => updateSimpleField({ min_charge_enabled: event.target.checked })}
                  />
                  Minimum charge (optional)
                </label>
                {simpleState.min_charge_enabled ? (
                  <div className="row wrap">
                    <FormattedNumberInput
                      value={simpleState.min_charge ?? 0}
                      onChange={(value) => updateSimpleField({ min_charge: value })}
                      decimalScale={6}
                      className="input settings-control"
                    />
                    <select
                      className="input"
                      value={simpleState.min_charge_currency ?? simpleState.rate_currency ?? "MYR"}
                      onChange={(event) => updateSimpleField({ min_charge_currency: event.target.value as "MYR" | "RMB" })}
                    >
                      <option value="MYR">MYR</option>
                      <option value="RMB">RMB</option>
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {simpleState.template_key === "PCT_OF_COMPONENT_COST" ? (
            <div className="settings-grid settings-grid-2 top-gap">
              <div className="settings-field">
                <div className="settings-label">Percent (%)</div>
                <FormattedNumberInput
                  value={simpleState.percent ?? 0}
                  onChange={(value) => updateSimpleField({ percent: Math.max(0, Math.min(100, value)) })}
                  decimalScale={2}
                  className="input settings-control"
                />
              </div>
              <div className="settings-field">
                <div className="settings-label">Which component?</div>
                <select
                  className="input settings-control"
                  value={simpleState.target_component_id ?? ""}
                  onChange={(event) => updateSimpleField({ target_component_id: event.target.value })}
                >
                  <option value="">Select component</option>
                  {allComponents
                    .filter((item) => item.component_id !== component.component_id)
                    .map((item) => (
                      <option key={item.component_id} value={item.component_id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ) : null}

          <div className="formula-expression-preview top-gap">
            <strong>Generated Expression</strong>
            <code>{draft.expression || "(empty)"}</code>
          </div>
        </div>
      ) : (
        <div className="top-gap">
          <div className="row gap wrap">
            <select className="input" onChange={(event) => event.target.value && appendToken(event.target.value)} defaultValue="">
              <option value="">Insert Variable</option>
              {variableOptions.map((item) => (
                <option key={item.token} value={item.token}>
                  {item.label}
                </option>
              ))}
            </select>

            <select className="input" onChange={(event) => event.target.value && appendToken(event.target.value)} defaultValue="">
              <option value="">Insert Function</option>
              {functionOptions.map((item) => (
                <option key={item.token} value={item.token}>
                  {item.label}
                </option>
              ))}
            </select>

            <select className="input" onChange={(event) => event.target.value && appendToken(event.target.value)} defaultValue="">
              <option value="">Insert Component Ref</option>
              {allComponents
                .filter((item) => item.component_id !== component.component_id)
                .flatMap((item) => [
                  { key: `${item.component_id}-cost`, label: `${item.name} cost`, value: `comp("${item.component_id}").cost` },
                  { key: `${item.component_id}-sell`, label: `${item.name} sell`, value: `comp("${item.component_id}").sell` },
                  { key: `${item.component_id}-profit`, label: `${item.name} profit`, value: `comp("${item.component_id}").profit` },
                ])
                .map((item) => (
                  <option key={item.key} value={item.value}>
                    {item.label}
                  </option>
                ))}
            </select>

            <button type="button" onClick={() => onAutoCreateParams(component.component_id)}>
              Auto-create parameters
            </button>
          </div>

          <textarea
            className="textarea top-gap"
            rows={5}
            value={draft.expression}
            onChange={(event) =>
              updateDraft({
                expression: event.target.value,
                ui_meta: {
                  ...uiMeta,
                  mode: "ADVANCED",
                },
              })
            }
            placeholder="Formula in MYR, e.g. rate * code_qty"
          />

          {draft.expression.trim().length === 0 ? (
            <p className="hint">Pick a template in Simple mode or type an expression here.</p>
          ) : null}

          <div className="row between top-gap">
            <strong>Parameters</strong>
            <button type="button" onClick={addAdvancedParam}>
              Add Parameter
            </button>
          </div>

          <table className="table top-gap">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th>Currency</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {draft.parameters.map((parameter, index) => (
                <tr key={`${parameter.name}-${index}`}>
                  <td>
                    <input
                      className="input"
                      value={parameter.name}
                      onChange={(event) => updateAdvancedParam(index, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <FormattedNumberInput
                      value={parameter.value}
                      onChange={(value) => updateAdvancedParam(index, { value })}
                      decimalScale={6}
                      className="input"
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      value={parameter.currency}
                      onChange={(event) => updateAdvancedParam(index, { currency: event.target.value as "MYR" | "RMB" })}
                    >
                      <option value="MYR">MYR</option>
                      <option value="RMB">RMB</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" onClick={() => removeAdvancedParam(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "SIMPLE" && generatedFromSimple && !generatedFromSimple.ok ? <p className="error top-gap">{generatedFromSimple.error}</p> : null}
      {!validation.ok ? <p className="error top-gap">{validation.error}</p> : null}
      {formulaError ? <p className="error top-gap">{formulaError}</p> : null}

      <div className="test-panel top-gap">
        <strong>Live Preview</strong>
        <div className="row wrap top-gap">
          <select className="input" value={activeSelectedQty} onChange={(event) => setSelectedQty(Number(event.target.value))}>
            {quantityScenarios.map((qty) => (
              <option key={qty} value={qty}>
                {qty.toLocaleString()}
              </option>
            ))}
          </select>
          <span className="hint">Committed formula cost: {committedValue === null ? "N/A" : committedValue.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
        </div>

        {livePreview.status === "OK" ? (
          <div className="formula-preview-grid top-gap">
            <span>Base Cost (MYR): {livePreview.cost.toLocaleString(undefined, { maximumFractionDigits: settings.formatting.money_decimals })}</span>
            {livePreview.tag === "MARGIN" ? (
              <>
                <span>Sell (MYR): {livePreview.sell.toLocaleString(undefined, { maximumFractionDigits: settings.formatting.money_decimals })}</span>
                <span>Profit (MYR): {livePreview.profit.toLocaleString(undefined, { maximumFractionDigits: settings.formatting.money_decimals })}</span>
              </>
            ) : (
              <span>Pass-through (profit = 0)</span>
            )}
            <span>code_qty: {livePreview.derived.code_qty.toLocaleString()}</span>
            <span>total_weight: {livePreview.derived.total_weight.toFixed(settings.formatting.weight_decimals)}</span>
            <span>area_m2: {livePreview.derived.area_m2.toFixed(6)}</span>
          </div>
        ) : (
          <p className="warning top-gap">{livePreview.message}</p>
        )}
      </div>
    </div>
  );
}
