import type {
  FormulaBuilderUiMeta,
  FormulaParameter,
  JobInputs,
  QtyResult,
  QuoteComponent,
  Settings,
  SupplierOption,
} from "../../lib/calc/types";
import { FormattedNumberInput } from "../numeric/FormattedNumberInput";
import { FormulaEditor } from "./FormulaEditor";
import { TierEditor } from "./TierEditor";

type Props = {
  component: QuoteComponent;
  quantities: number[];
  allComponents: QuoteComponent[];
  perQtyResults: QtyResult[];
  settings: Settings;
  jobInputs: JobInputs;
  selectedSupplierOptionId?: string;
  formulaError?: string | null;
  formulaDraft?: {
    expression: string;
    parameters: FormulaParameter[];
    ui_meta?: FormulaBuilderUiMeta;
    dirty: boolean;
  };
  warnings: string[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenCompare: () => void;
  onSelectSupplier: (supplierOptionId: string) => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<QuoteComponent>) => void;
  onSetType: (type: QuoteComponent["type"]) => void;
  onAddSupplier: () => void;
  onRemoveSupplier: (supplierOptionId: string) => void;
  onUpdateSupplier: (supplierOptionId: string, patch: Partial<SupplierOption>) => void;
  onAddTier: (supplierOptionId: string) => void;
  onRemoveTier: (supplierOptionId: string, tierIndex: number) => void;
  onUpdateTier: (
    supplierOptionId: string,
    tierIndex: number,
    patch: Partial<{ qty: number; price: number; currency: "MYR" | "RMB"; sst_pct: number; note: string }>,
  ) => void;
  onInitFormulaDraft: (componentId: string) => void;
  onUpdateFormulaDraft: (
    componentId: string,
    patch: Partial<{
      expression: string;
      parameters: FormulaParameter[];
      ui_meta: FormulaBuilderUiMeta;
    }>,
  ) => void;
  onApplyFormulaDraft: (componentId: string) => void;
  onDiscardFormulaDraft: (componentId: string) => void;
  onAutoCreateFormulaParams: (componentId: string) => void;
};

export function ComponentCard({
  component,
  quantities,
  allComponents,
  perQtyResults,
  settings,
  jobInputs,
  selectedSupplierOptionId,
  formulaError,
  formulaDraft,
  warnings,
  isOpen,
  onToggleOpen,
  onOpenCompare,
  onSelectSupplier,
  onRemove,
  onUpdate,
  onSetType,
  onAddSupplier,
  onRemoveSupplier,
  onUpdateSupplier,
  onAddTier,
  onRemoveTier,
  onUpdateTier,
  onInitFormulaDraft,
  onUpdateFormulaDraft,
  onApplyFormulaDraft,
  onDiscardFormulaDraft,
  onAutoCreateFormulaParams,
}: Props) {
  const isTier =
    component.type === "TIER_TOTAL_MUST_MATCH" ||
    (component.type === "TIER_TOTAL_MUST_MATCH_OR_FORMULA" && (component.supplier_options?.length ?? 0) > 0);

  const statusPills: Array<{ label: string; tone: "ok" | "warn" | "error" | "neutral" }> = [];

  if (formulaError) {
    statusPills.push({ label: "Formula error", tone: "error" });
  }

  if (warnings.length > 0) {
    statusPills.push({ label: `Missing tiers (${warnings.length})`, tone: "warn" });
  }

  if (statusPills.length === 0) {
    statusPills.push({ label: "OK", tone: "ok" });
  }

  if (component.tag === "PASS_THROUGH" || component.special_rule === "MARGIN_LOCKED_0_TOGGLEABLE") {
    statusPills.push({ label: "Pass-through", tone: "neutral" });
  }

  return (
    <article className="card component-card" id={component.component_id}>
      <div className="component-header-row row wrap between">
        <div className="row wrap component-main-controls">
          <button type="button" className="collapse-btn" onClick={onToggleOpen} aria-expanded={isOpen}>
            {isOpen ? "Collapse" : "Expand"}
          </button>

          <label className="row gap">
            <input
              type="checkbox"
              checked={component.enabled}
              onChange={(event) => onUpdate({ enabled: event.target.checked })}
              aria-label={`Enable ${component.name}`}
            />
            Enabled
          </label>

          <input
            className="input component-name-input"
            value={component.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            aria-label="Component name"
          />

          <span className="chip">{isTier ? "Tier" : "Formula"}</span>

          <select
            className="input"
            value={isTier ? "tier" : "formula"}
            onChange={(event) => onSetType(event.target.value === "tier" ? "TIER_TOTAL_MUST_MATCH" : "FORMULA_BUILDER")}
            aria-label="Component mode"
          >
            <option value="tier">Tier Mode</option>
            <option value="formula">Formula Mode</option>
          </select>

          <select
            className="input"
            value={component.tag}
            onChange={(event) => onUpdate({ tag: event.target.value as "PASS_THROUGH" | "MARGIN" })}
            disabled={component.special_rule === "MARGIN_LOCKED_0_TOGGLEABLE"}
            aria-label="Tag"
          >
            <option value="MARGIN">Margin</option>
            <option value="PASS_THROUGH">Pass-through</option>
          </select>

          {component.tag === "MARGIN" && component.special_rule !== "MARGIN_LOCKED_0_TOGGLEABLE" ? (
            <FormattedNumberInput
              value={component.margin_pct}
              onChange={(value) => onUpdate({ margin_pct: value })}
              decimalScale={2}
              className="input"
            />
          ) : (
            <span className="chip">Pass-through (profit=0)</span>
          )}

          {component.special_rule === "MARGIN_LOCKED_0_TOGGLEABLE" ? <span className="chip badge-neutral">0% locked</span> : null}
        </div>

        <div className="row wrap">
          {statusPills.map((pill, index) => (
            <span key={`${component.component_id}-status-${index}`} className={`status-pill ${pill.tone}`}>
              {pill.label}
            </span>
          ))}
          {isTier ? (
            <button type="button" onClick={onOpenCompare}>
              Compare
            </button>
          ) : null}
          <button type="button" onClick={onRemove}>
            Delete
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="component-body">
          {warnings.length > 0 ? (
            <div className="warning-box">
              {warnings.map((warning, index) => (
                <p className="warning" key={`${component.component_id}-warn-${index}`}>
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          {isTier ? (
            <TierEditor
              component={component}
              quantities={quantities}
              selectedSupplierOptionId={selectedSupplierOptionId}
              onSelectSupplier={onSelectSupplier}
              onAddSupplier={onAddSupplier}
              onRemoveSupplier={onRemoveSupplier}
              onUpdateSupplier={onUpdateSupplier}
              onAddTier={onAddTier}
              onRemoveTier={onRemoveTier}
              onUpdateTier={onUpdateTier}
            />
          ) : (
            <FormulaEditor
              component={component}
              quantityScenarios={quantities}
              allComponents={allComponents}
              perQtyResults={perQtyResults}
              settings={settings}
              jobInputs={jobInputs}
              formulaDraft={formulaDraft}
              formulaError={formulaError}
              onInitDraft={onInitFormulaDraft}
              onUpdateDraft={onUpdateFormulaDraft}
              onApplyDraft={onApplyFormulaDraft}
              onDiscardDraft={onDiscardFormulaDraft}
              onAutoCreateParams={onAutoCreateFormulaParams}
            />
          )}
        </div>
      ) : null}
    </article>
  );
}
