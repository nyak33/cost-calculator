import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ComponentCard } from "../components/components/ComponentCard";
import { FormattedNumberInput } from "../components/numeric/FormattedNumberInput";
import { QuantityScenarioEditor } from "../components/quantity/QuantityScenarioEditor";
import { componentTemplates } from "../constants/defaults";
import { useQuoteStore } from "../store/useQuoteStore";

export function QuoteBuilderPage() {
  const [templateToAdd, setTemplateToAdd] = useState(componentTemplates[0]?.template_key ?? "printing");
  const [openByComponent, setOpenByComponent] = useState<Record<string, boolean>>({});
  const [supplierTabByComponent, setSupplierTabByComponent] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const location = useLocation();
  const hashTargetComponentId = location.hash ? location.hash.replace("#", "") : "";

  const {
    settings,
    jobInputs,
    components,
    results,
    ui,
    updateJobInputs,
    setQuantityScenarios,
    addComponentFromTemplate,
    addCustomFormulaComponent,
    removeComponent,
    updateComponent,
    setComponentType,
    addSupplierOption,
    removeSupplierOption,
    updateSupplierOption,
    addTierRow,
    removeTierRow,
    updateTierRow,
    initFormulaDraft,
    updateFormulaDraft,
    applyFormulaDraft,
    discardFormulaDraft,
    autoCreateDraftParameters,
    setActiveResultsTab,
  } = useQuoteStore();

  const warningByComponent = useMemo(() => {
    const map = new Map<string, string[]>();
    results.warnings.forEach((warning) => {
      if (!map.has(warning.component_id)) {
        map.set(warning.component_id, []);
      }
      map.get(warning.component_id)?.push(warning.message);
    });
    return map;
  }, [results.warnings]);

  const warningComponentIds = useMemo(
    () => new Set(results.warnings.map((warning) => warning.component_id)),
    [results.warnings],
  );

  const getComponentOpen = (componentId: string, index: number) => {
    if (hashTargetComponentId && hashTargetComponentId === componentId) {
      return true;
    }

    const stored = openByComponent[componentId];
    if (stored !== undefined) {
      return stored;
    }
    return warningComponentIds.has(componentId) || index === 0;
  };

  const toggleComponent = (componentId: string, currentOpen: boolean) => {
    setOpenByComponent((prev) => ({
      ...prev,
      [componentId]: !currentOpen,
    }));
  };

  const openComponent = (componentId: string) => {
    setOpenByComponent((prev) => ({
      ...prev,
      [componentId]: true,
    }));
  };

  const expandAll = () => {
    setOpenByComponent(Object.fromEntries(components.map((component) => [component.component_id, true])));
  };

  const collapseAll = () => {
    setOpenByComponent(Object.fromEntries(components.map((component) => [component.component_id, false])));
  };

  const expandWarningsOnly = () => {
    setOpenByComponent(
      Object.fromEntries(
        components.map((component) => [component.component_id, warningComponentIds.has(component.component_id)]),
      ),
    );
  };

  const jumpToComponent = (componentId: string) => {
    openComponent(componentId);
    setTimeout(() => {
      const target = document.getElementById(componentId);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const shouldConfirmRemoveQty = (qty: number) => {
    return components.some((component) =>
      (component.supplier_options ?? []).some((option) => option.tiers.some((tier) => tier.qty === qty)),
    );
  };

  return (
    <main className="page quote-page quote-builder-only">
      <div className="quote-layout">
        <section className="builder-pane">
          <div className="card">
            <div className="row between wrap">
              <div>
                <h1>Quote Builder</h1>
                <p className="hint">Build quote here, open Results tab for full analysis.</p>
              </div>
              <div className="row wrap">
                <Link to="/results" className="nav-action-link">
                  Results
                </Link>
                <Link to="/settings" className="nav-action-link">
                  Settings
                </Link>
                <Link to="/export" className="nav-action-link">
                  Export
                </Link>
                <Link to="/manual" className="nav-action-link">
                  Manual
                </Link>
              </div>
            </div>
          </div>

          <section className="card">
            <h3>Production Inputs</h3>
            <div className="settings-field">
              <div className="settings-label">Job Name</div>
              <input
                type="text"
                className="input settings-control"
                value={jobInputs.job_name}
                onChange={(event) => updateJobInputs({ job_name: event.target.value })}
                placeholder="Enter quote/job name"
              />
            </div>
            <div className="settings-grid settings-grid-2">
              <div className="settings-field">
                <div className="settings-label">Label width (mm)</div>
                <FormattedNumberInput
                  value={jobInputs.width_mm}
                  onChange={(value) =>
                    updateJobInputs({ width_mm: Math.max(0, Math.floor(value)) })
                  }
                  integerOnly
                  className="input settings-control"
                />
              </div>
              <div className="settings-field">
                <div className="settings-label">Label height (mm)</div>
                <FormattedNumberInput
                  value={jobInputs.height_mm}
                  onChange={(value) =>
                    updateJobInputs({ height_mm: Math.max(0, Math.floor(value)) })
                  }
                  integerOnly
                  className="input settings-control"
                />
              </div>
            </div>

            <div className="info-strip top-gap">
              <span>
                area_m2 per piece: {((jobInputs.width_mm / 1000) * (jobInputs.height_mm / 1000)).toFixed(6)}
              </span>
              <span>
                weight_per_piece: {(((jobInputs.width_mm / 1000) * (jobInputs.height_mm / 1000)) * settings.weight_factor).toFixed(settings.formatting.weight_decimals)}
              </span>
            </div>
          </section>

          <QuantityScenarioEditor
            quantities={jobInputs.quantity_scenarios}
            onChange={setQuantityScenarios}
            shouldConfirmRemove={shouldConfirmRemoveQty}
          />

          <section className="card">
            <h3>Components Overview</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Suppliers</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {components.map((component) => {
                  const hasWarnings =
                    (warningByComponent.get(component.component_id)?.length ?? 0) > 0;
                  const hasFormulaError = Boolean(ui.formulaDraftErrors[component.component_id]);
                  const isTierMode =
                    component.type === "TIER_TOTAL_MUST_MATCH" ||
                    (component.type === "TIER_TOTAL_MUST_MATCH_OR_FORMULA" &&
                      (component.supplier_options?.length ?? 0) > 0);
                  const status = hasFormulaError
                    ? "Formula error"
                    : hasWarnings
                      ? "Missing tiers"
                      : "OK";
                  const statusClass = hasFormulaError ? "error" : hasWarnings ? "warn" : "ok";
                  const supplierCount = component.supplier_options?.length ?? 0;

                  return (
                    <tr key={`overview-${component.component_id}`}>
                      <td>{component.name}</td>
                      <td>
                        {isTierMode ? "Tier" : "Formula"}
                      </td>
                      <td>
                        <span className={`status-pill ${statusClass}`}>{status}</span>
                      </td>
                      <td>{supplierCount}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            openComponent(component.component_id);
                            jumpToComponent(component.component_id);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card">
            <div className="row between wrap">
              <h3>Component Editor</h3>
              <div className="row wrap">
                <button type="button" onClick={expandAll}>
                  Expand All
                </button>
                <button type="button" onClick={collapseAll}>
                  Collapse All
                </button>
                <button type="button" onClick={expandWarningsOnly}>
                  Expand Warnings Only
                </button>
              </div>
            </div>

            <div className="row wrap top-gap">
              <select
                className="input"
                value={templateToAdd}
                onChange={(event) => setTemplateToAdd(event.target.value)}
              >
                {componentTemplates.map((template) => (
                  <option key={template.template_key} value={template.template_key}>
                    {template.default_name}
                  </option>
                ))}
              </select>

              <button type="button" onClick={() => addComponentFromTemplate(templateToAdd)}>
                Add Component
              </button>

              <button type="button" onClick={addCustomFormulaComponent}>
                Add Custom Formula Component
              </button>
            </div>
          </section>

          <section className="components-stack">
            {components.map((component, index) => {
              const currentOpen = getComponentOpen(component.component_id, index);
              const selectedSupplierOptionId =
                supplierTabByComponent[component.component_id] ??
                component.supplier_options?.[0]?.supplier_option_id;

              return (
                <ComponentCard
                  key={component.component_id}
                  component={component}
                  quantities={jobInputs.quantity_scenarios}
                  allComponents={components}
                  perQtyResults={results.per_qty}
                  settings={settings}
                  jobInputs={jobInputs}
                  selectedSupplierOptionId={selectedSupplierOptionId}
                  formulaError={ui.formulaDraftErrors[component.component_id]}
                  formulaDraft={ui.formulaDrafts[component.component_id]}
                  warnings={warningByComponent.get(component.component_id) ?? []}
                  isOpen={currentOpen}
                  onToggleOpen={() => toggleComponent(component.component_id, currentOpen)}
                  onOpenCompare={() => {
                    setActiveResultsTab("compare");
                    sessionStorage.setItem("ccv2.compare_component", component.component_id);
                    navigate("/results");
                  }}
                  onSelectSupplier={(supplierOptionId) =>
                    setSupplierTabByComponent((prev) => ({
                      ...prev,
                      [component.component_id]: supplierOptionId,
                    }))
                  }
                  onRemove={() => removeComponent(component.component_id)}
                  onUpdate={(patch) => {
                    openComponent(component.component_id);
                    updateComponent(component.component_id, patch);
                  }}
                  onSetType={(type) => {
                    openComponent(component.component_id);
                    setComponentType(component.component_id, type);
                  }}
                  onAddSupplier={() => {
                    openComponent(component.component_id);
                    addSupplierOption(component.component_id);
                  }}
                  onRemoveSupplier={(supplierOptionId) => {
                    openComponent(component.component_id);
                    removeSupplierOption(component.component_id, supplierOptionId);
                  }}
                  onUpdateSupplier={(supplierOptionId, patch) => {
                    openComponent(component.component_id);
                    updateSupplierOption(component.component_id, supplierOptionId, patch);
                  }}
                  onAddTier={(supplierOptionId) => {
                    openComponent(component.component_id);
                    addTierRow(component.component_id, supplierOptionId);
                  }}
                  onRemoveTier={(supplierOptionId, tierIndex) => {
                    openComponent(component.component_id);
                    removeTierRow(component.component_id, supplierOptionId, tierIndex);
                  }}
                  onUpdateTier={(supplierOptionId, tierIndex, patch) => {
                    openComponent(component.component_id);
                    updateTierRow(component.component_id, supplierOptionId, tierIndex, patch);
                  }}
                  onInitFormulaDraft={initFormulaDraft}
                  onUpdateFormulaDraft={(componentId, patch) => {
                    openComponent(componentId);
                    updateFormulaDraft(componentId, patch);
                  }}
                  onApplyFormulaDraft={(componentId) => {
                    openComponent(componentId);
                    applyFormulaDraft(componentId);
                  }}
                  onDiscardFormulaDraft={(componentId) => {
                    openComponent(componentId);
                    discardFormulaDraft(componentId);
                  }}
                  onAutoCreateFormulaParams={(componentId) => {
                    openComponent(componentId);
                    autoCreateDraftParameters(componentId);
                  }}
                />
              );
            })}
          </section>
        </section>
      </div>
    </main>
  );
}
