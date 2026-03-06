import { create } from "zustand";

import { buildComponentFromTemplate, SCHEMA_VERSION, STORAGE_KEYS, defaultComponents, defaultJobInputs, defaultSettings } from "../constants/defaults";
import { buildSupplierCompareTables, computeQuote } from "../lib/calc/computeQuote";
import { buildFormulaDependencyGraph, detectCycle } from "../lib/calc/cycleDetection";
import { detectMissingParameterNames, validateFormulaExpression } from "../lib/calc/formulaEngine";
import { buildExpressionAndParameters, hashFormulaDraft, suggestedSimpleState } from "../lib/calc/simpleFormulaTemplates";
import type {
  ComputeQuoteOutput,
  FormulaBuilderUiMeta,
  FormulaParameter,
  JobInputs,
  QuoteComponent,
  Settings,
  SupplierOption,
  TierEntry,
} from "../lib/calc/types";
import { loadPersistedState } from "../lib/storage/migrations";
import { clampMarginPct } from "../lib/validation/rules";

interface FormulaDraft {
  expression: string;
  parameters: FormulaParameter[];
  ui_meta?: FormulaBuilderUiMeta;
  dirty: boolean;
}

interface UiState {
  activeResultsTab: "summary" | "breakdown" | "warnings" | "compare";
  formulaDrafts: Record<string, FormulaDraft>;
  formulaDraftErrors: Record<string, string | null>;
}

interface QuoteStoreState {
  settings: Settings;
  jobInputs: JobInputs;
  components: QuoteComponent[];
  results: ComputeQuoteOutput;
  supplierCompare: ReturnType<typeof buildSupplierCompareTables>;
  ui: UiState;
  setActiveResultsTab: (tab: UiState["activeResultsTab"]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateJobInputs: (patch: Partial<JobInputs>) => void;
  setQuantityScenarios: (values: number[]) => void;
  addComponentFromTemplate: (templateKey: string) => void;
  addCustomFormulaComponent: () => void;
  removeComponent: (componentId: string) => void;
  updateComponent: (componentId: string, patch: Partial<QuoteComponent>) => void;
  setComponentType: (componentId: string, type: QuoteComponent["type"]) => void;
  addSupplierOption: (componentId: string) => void;
  removeSupplierOption: (componentId: string, supplierOptionId: string) => void;
  updateSupplierOption: (componentId: string, supplierOptionId: string, patch: Partial<SupplierOption>) => void;
  bulkUpdateSupplierTiers: (
    updates: Array<{ componentId: string; supplierOptionId: string; tiers: TierEntry[] }>,
  ) => void;
  addTierRow: (componentId: string, supplierOptionId: string) => void;
  removeTierRow: (componentId: string, supplierOptionId: string, tierIndex: number) => void;
  updateTierRow: (componentId: string, supplierOptionId: string, tierIndex: number, patch: Partial<TierEntry>) => void;
  initFormulaDraft: (componentId: string) => void;
  updateFormulaDraft: (
    componentId: string,
    patch: Partial<{ expression: string; parameters: FormulaParameter[]; ui_meta: FormulaBuilderUiMeta }>,
  ) => void;
  applyFormulaDraft: (componentId: string) => void;
  discardFormulaDraft: (componentId: string) => void;
  autoCreateDraftParameters: (componentId: string) => void;
  resetDefaults: () => void;
  recompute: () => void;
}

function buildResults(settings: Settings, jobInputs: JobInputs, components: QuoteComponent[]) {
  const results = computeQuote({ settings, job: jobInputs, components });
  const supplierCompare = buildSupplierCompareTables({ settings, job: jobInputs, components });

  return { results, supplierCompare };
}

function enforceKoodRule(component: QuoteComponent): QuoteComponent {
  if (component.special_rule === "MARGIN_LOCKED_0_TOGGLEABLE") {
    return {
      ...component,
      margin_pct: 0,
    };
  }

  return component;
}

function sanitizeScenarios(values: number[]): number[] {
  const normalized = values.filter((value) => Number.isInteger(value) && value >= 0);
  return Array.from(new Set(normalized));
}

function defaultEditorMode(component: QuoteComponent): FormulaBuilderUiMeta["mode"] {
  const expression = component.formula_builder?.expression?.trim() ?? "";
  return expression ? "ADVANCED" : "SIMPLE";
}

function buildDraftFromComponent(component: QuoteComponent, settings: Settings): FormulaDraft {
  const formula = component.formula_builder ?? {
    expression: "",
    parameters: [],
  };

  const uiMeta: FormulaBuilderUiMeta = formula.ui_meta ?? {
    mode: defaultEditorMode(component),
  };

  if (!formula.expression.trim() && !uiMeta.simple_state) {
    const simple = suggestedSimpleState(component, settings);
    const generated = buildExpressionAndParameters(simple);

    return {
      expression: generated.ok ? generated.expression ?? "" : "",
      parameters: generated.ok ? generated.parameters ?? [] : [],
      ui_meta: {
        ...uiMeta,
        mode: "SIMPLE",
        simple_state: simple,
      },
      dirty: false,
    };
  }

  return {
    expression: formula.expression,
    parameters: formula.parameters,
    ui_meta: uiMeta,
    dirty: false,
  };
}

function ensureFormulaBuilder(component: QuoteComponent): QuoteComponent {
  if (component.formula_builder) {
    return component;
  }

  return {
    ...component,
    formula_builder: {
      expression: "",
      parameters: [],
      ui_meta: {
        mode: "SIMPLE",
      },
    },
  };
}

const persisted =
  typeof window !== "undefined"
    ? loadPersistedState({
        settings: STORAGE_KEYS.settings,
        jobInputs: STORAGE_KEYS.jobInputs,
        components: STORAGE_KEYS.components,
      })
    : {
        settings: defaultSettings,
        jobInputs: defaultJobInputs,
        components: defaultComponents,
      };

const seededSettings: Settings = {
  ...defaultSettings,
  ...persisted.settings,
  schema_version: SCHEMA_VERSION,
};

const seededJobInputs: JobInputs = {
  ...defaultJobInputs,
  ...persisted.jobInputs,
  quantity_scenarios: sanitizeScenarios(persisted.jobInputs.quantity_scenarios),
};

const seededComponents: QuoteComponent[] = persisted.components.map(enforceKoodRule);
const seededComputed = buildResults(seededSettings, seededJobInputs, seededComponents);

export const useQuoteStore = create<QuoteStoreState>((set, get) => ({
  settings: seededSettings,
  jobInputs: seededJobInputs,
  components: seededComponents,
  results: seededComputed.results,
  supplierCompare: seededComputed.supplierCompare,
  ui: {
    activeResultsTab: "summary",
    formulaDrafts: {},
    formulaDraftErrors: {},
  },

  setActiveResultsTab: (tab) => {
    set((state) => ({
      ui: { ...state.ui, activeResultsTab: tab },
    }));
  },

  updateSettings: (patch) => {
    set((state) => {
      const settings = {
        ...state.settings,
        ...patch,
        schema_version: SCHEMA_VERSION,
      };
      const computed = buildResults(settings, state.jobInputs, state.components);
      return {
        settings,
        ...computed,
      };
    });
  },

  updateJobInputs: (patch) => {
    set((state) => {
      const jobInputs = {
        ...state.jobInputs,
        ...patch,
      };
      const computed = buildResults(state.settings, jobInputs, state.components);
      return {
        jobInputs,
        ...computed,
      };
    });
  },

  setQuantityScenarios: (values) => {
    set((state) => {
      const jobInputs = {
        ...state.jobInputs,
        quantity_scenarios: sanitizeScenarios(values),
      };
      const computed = buildResults(state.settings, jobInputs, state.components);
      return {
        jobInputs,
        ...computed,
      };
    });
  },

  addComponentFromTemplate: (templateKey) => {
    set((state) => {
      const components = [...state.components, buildComponentFromTemplate(templateKey, state.components.length)].map(enforceKoodRule);
      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  addCustomFormulaComponent: () => {
    set((state) => {
      const custom: QuoteComponent = {
        component_id: `comp_custom_${Date.now()}_${state.components.length}`,
        template_key: `custom_${Date.now()}`,
        name: "Custom Formula",
        enabled: true,
        tag: "MARGIN",
        margin_pct: 20,
        type: "FORMULA_BUILDER",
        formula_builder: {
          expression: "",
          parameters: [],
          ui_meta: {
            mode: "SIMPLE",
          },
        },
      };

      const components = [...state.components, custom].map(enforceKoodRule);
      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  removeComponent: (componentId) => {
    set((state) => {
      const components = state.components.filter((component) => component.component_id !== componentId);
      const computed = buildResults(state.settings, state.jobInputs, components);
      const nextDrafts = { ...state.ui.formulaDrafts };
      const nextErrors = { ...state.ui.formulaDraftErrors };
      delete nextDrafts[componentId];
      delete nextErrors[componentId];

      return {
        components,
        ...computed,
        ui: {
          ...state.ui,
          formulaDrafts: nextDrafts,
          formulaDraftErrors: nextErrors,
        },
      };
    });
  },

  updateComponent: (componentId, patch) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        const next: QuoteComponent = {
          ...component,
          ...patch,
          margin_pct: patch.margin_pct !== undefined ? clampMarginPct(patch.margin_pct) : component.margin_pct,
        };

        return enforceKoodRule(next);
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  setComponentType: (componentId, type) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        if (type === "FORMULA_BUILDER") {
          return ensureFormulaBuilder({
            ...component,
            type,
          });
        }

        return {
          ...component,
          type,
          supplier_options:
            component.supplier_options && component.supplier_options.length > 0
              ? component.supplier_options
              : [
                  {
                    supplier_option_id: `sup_${Date.now()}_0`,
                    supplier_name: "Supplier 1",
                    tiers: [],
                  },
                ],
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  addSupplierOption: (componentId) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        const options = component.supplier_options ?? [];
        return {
          ...component,
          supplier_options: [
            ...options,
            {
              supplier_option_id: `sup_${component.component_id}_${Date.now()}_${options.length}`,
              supplier_name: `Supplier ${options.length + 1}`,
              tiers: [],
            },
          ],
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  removeSupplierOption: (componentId, supplierOptionId) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        return {
          ...component,
          supplier_options: (component.supplier_options ?? []).filter((option) => option.supplier_option_id !== supplierOptionId),
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  updateSupplierOption: (componentId, supplierOptionId, patch) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        return {
          ...component,
          supplier_options: (component.supplier_options ?? []).map((option) =>
            option.supplier_option_id === supplierOptionId ? { ...option, ...patch } : option,
          ),
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  bulkUpdateSupplierTiers: (updates) => {
    if (updates.length === 0) {
      return;
    }

    set((state) => {
      const updatesByKey = new Map<string, TierEntry[]>();
      updates.forEach((item) => {
        updatesByKey.set(`${item.componentId}::${item.supplierOptionId}`, item.tiers);
      });

      const components = state.components.map((component) => {
        const nextOptions = (component.supplier_options ?? []).map((option) => {
          const tiers = updatesByKey.get(`${component.component_id}::${option.supplier_option_id}`);
          if (!tiers) {
            return option;
          }
          return {
            ...option,
            tiers,
          };
        });

        if (!component.supplier_options) {
          return component;
        }

        return {
          ...component,
          supplier_options: nextOptions,
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  addTierRow: (componentId, supplierOptionId) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        return {
          ...component,
          supplier_options: (component.supplier_options ?? []).map((option) => {
            if (option.supplier_option_id !== supplierOptionId) {
              return option;
            }

            return {
              ...option,
              tiers: [...option.tiers, { qty: 0, price: 0, currency: "MYR" as const, sst_pct: 0, note: "" }],
            };
          }),
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  removeTierRow: (componentId, supplierOptionId, tierIndex) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        return {
          ...component,
          supplier_options: (component.supplier_options ?? []).map((option) => {
            if (option.supplier_option_id !== supplierOptionId) {
              return option;
            }

            return {
              ...option,
              tiers: option.tiers.filter((_, index) => index !== tierIndex),
            };
          }),
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  updateTierRow: (componentId, supplierOptionId, tierIndex, patch) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.component_id !== componentId) {
          return component;
        }

        return {
          ...component,
          supplier_options: (component.supplier_options ?? []).map((option) => {
            if (option.supplier_option_id !== supplierOptionId) {
              return option;
            }

            return {
              ...option,
              tiers: option.tiers.map((tier, index) => (index === tierIndex ? { ...tier, ...patch } : tier)),
            };
          }),
        };
      });

      const computed = buildResults(state.settings, state.jobInputs, components);
      return {
        components,
        ...computed,
      };
    });
  },

  initFormulaDraft: (componentId) => {
    set((state) => {
      if (state.ui.formulaDrafts[componentId]) {
        return {};
      }

      const component = state.components.find((item) => item.component_id === componentId);
      if (!component) {
        return {};
      }

      const draft = buildDraftFromComponent(component, state.settings);
      return {
        ui: {
          ...state.ui,
          formulaDrafts: {
            ...state.ui.formulaDrafts,
            [componentId]: draft,
          },
          formulaDraftErrors: {
            ...state.ui.formulaDraftErrors,
            [componentId]: null,
          },
        },
      };
    });
  },

  updateFormulaDraft: (componentId, patch) => {
    set((state) => {
      const component = state.components.find((item) => item.component_id === componentId);
      if (!component) {
        return {};
      }

      const currentDraft = state.ui.formulaDrafts[componentId] ?? buildDraftFromComponent(component, state.settings);
      const nextUiMeta = patch.ui_meta ? { ...(currentDraft.ui_meta ?? { mode: defaultEditorMode(component) }), ...patch.ui_meta } : currentDraft.ui_meta;

      const nextDraft: FormulaDraft = {
        ...currentDraft,
        ...(patch.expression !== undefined ? { expression: patch.expression } : {}),
        ...(patch.parameters !== undefined ? { parameters: patch.parameters } : {}),
        ...(nextUiMeta ? { ui_meta: nextUiMeta } : {}),
        dirty: true,
      };

      return {
        ui: {
          ...state.ui,
          formulaDrafts: {
            ...state.ui.formulaDrafts,
            [componentId]: nextDraft,
          },
          formulaDraftErrors: {
            ...state.ui.formulaDraftErrors,
            [componentId]: null,
          },
        },
      };
    });
  },

  applyFormulaDraft: (componentId) => {
    set((state) => {
      const component = state.components.find((item) => item.component_id === componentId);
      if (!component) {
        return {};
      }

      const draft = state.ui.formulaDrafts[componentId] ?? buildDraftFromComponent(component, state.settings);
      const nextErrors = { ...state.ui.formulaDraftErrors };

      const expression = draft.expression.trim();
      const parameters = draft.parameters;

      if (!expression) {
        nextErrors[componentId] = "Expression cannot be empty";
        return {
          ui: {
            ...state.ui,
            formulaDraftErrors: nextErrors,
          },
        };
      }

      const validation = validateFormulaExpression(expression, parameters);
      if (!validation.ok) {
        nextErrors[componentId] = validation.error ?? "Invalid expression";
        return {
          ui: {
            ...state.ui,
            formulaDraftErrors: nextErrors,
          },
        };
      }

      const uiMeta = {
        ...(draft.ui_meta ?? { mode: defaultEditorMode(component) }),
        last_applied_hash: hashFormulaDraft(expression, parameters),
      } satisfies FormulaBuilderUiMeta;

      const tentativeComponents = state.components.map((item) => {
        if (item.component_id !== componentId) {
          return item;
        }

        return {
          ...item,
          formula_builder: {
            expression,
            parameters,
            ui_meta: uiMeta,
          },
        } satisfies QuoteComponent;
      });

      const { graph } = buildFormulaDependencyGraph(tentativeComponents);
      const cycle = detectCycle(graph);
      if (cycle) {
        nextErrors[componentId] = `Cycle detected: ${cycle.join(" -> ")}`;
        return {
          ui: {
            ...state.ui,
            formulaDraftErrors: nextErrors,
          },
        };
      }

      nextErrors[componentId] = null;
      const computed = buildResults(state.settings, state.jobInputs, tentativeComponents);
      return {
        components: tentativeComponents,
        ...computed,
        ui: {
          ...state.ui,
          formulaDrafts: {
            ...state.ui.formulaDrafts,
            [componentId]: {
              ...draft,
              expression,
              parameters,
              ui_meta: uiMeta,
              dirty: false,
            },
          },
          formulaDraftErrors: nextErrors,
        },
      };
    });
  },

  discardFormulaDraft: (componentId) => {
    set((state) => {
      const component = state.components.find((item) => item.component_id === componentId);
      if (!component) {
        return {};
      }

      const draft = buildDraftFromComponent(component, state.settings);
      return {
        ui: {
          ...state.ui,
          formulaDrafts: {
            ...state.ui.formulaDrafts,
            [componentId]: draft,
          },
          formulaDraftErrors: {
            ...state.ui.formulaDraftErrors,
            [componentId]: null,
          },
        },
      };
    });
  },

  autoCreateDraftParameters: (componentId) => {
    set((state) => {
      const component = state.components.find((item) => item.component_id === componentId);
      if (!component) {
        return {};
      }

      const currentDraft = state.ui.formulaDrafts[componentId] ?? buildDraftFromComponent(component, state.settings);
      const detection = detectMissingParameterNames(currentDraft.expression, currentDraft.parameters);
      const nextErrors = { ...state.ui.formulaDraftErrors };

      if (!detection.ok) {
        nextErrors[componentId] = detection.error ?? "Unable to parse expression";
        return {
          ui: {
            ...state.ui,
            formulaDraftErrors: nextErrors,
          },
        };
      }

      const missing = detection.names ?? [];
      if (missing.length === 0) {
        nextErrors[componentId] = null;
        return {
          ui: {
            ...state.ui,
            formulaDraftErrors: nextErrors,
          },
        };
      }

      const nextDraft: FormulaDraft = {
        ...currentDraft,
        parameters: [
          ...currentDraft.parameters,
          ...missing.map((name) => ({
            name,
            value: 0,
            currency: "MYR" as const,
          })),
        ],
        dirty: true,
      };

      nextErrors[componentId] = null;
      return {
        ui: {
          ...state.ui,
          formulaDrafts: {
            ...state.ui.formulaDrafts,
            [componentId]: nextDraft,
          },
          formulaDraftErrors: nextErrors,
        },
      };
    });
  },

  resetDefaults: () => {
    const settings = defaultSettings;
    const jobInputs = defaultJobInputs;
    const components = defaultComponents;
    const computed = buildResults(settings, jobInputs, components);
    set({
      settings,
      jobInputs,
      components,
      ...computed,
      ui: {
        activeResultsTab: "summary",
        formulaDrafts: {},
        formulaDraftErrors: {},
      },
    });
  },

  recompute: () => {
    const state = get();
    const computed = buildResults(state.settings, state.jobInputs, state.components);
    set(computed);
  },
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedSettingsRef: Settings | null = null;
let lastSavedJobInputsRef: JobInputs | null = null;
let lastSavedComponentsRef: QuoteComponent[] | null = null;

if (typeof window !== "undefined") {
  useQuoteStore.subscribe((state) => {
    const settingsChanged = state.settings !== lastSavedSettingsRef;
    const jobChanged = state.jobInputs !== lastSavedJobInputsRef;
    const componentsChanged = state.components !== lastSavedComponentsRef;

    if (!settingsChanged && !jobChanged && !componentsChanged) {
      return;
    }

    lastSavedSettingsRef = state.settings;
    lastSavedJobInputsRef = state.jobInputs;
    lastSavedComponentsRef = state.components;

    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
      localStorage.setItem(STORAGE_KEYS.jobInputs, JSON.stringify(state.jobInputs));
      localStorage.setItem(STORAGE_KEYS.components, JSON.stringify(state.components));
    }, 300);
  });
}
