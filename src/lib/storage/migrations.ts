import { SCHEMA_VERSION, defaultComponents, defaultJobInputs, defaultSettings } from "../../constants/defaults";
import type { JobInputs, QuoteComponent, Settings } from "../calc/types";
import { componentsSchema, jobInputsSchema, settingsSchema } from "./schema";

function parseJson<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function migrateSettings(input: unknown): Settings {
  const base = settingsSchema.safeParse(input);
  if (base.success) {
    return {
      ...base.data,
      schema_version: SCHEMA_VERSION,
    };
  }

  return defaultSettings;
}

function migrateJobInputs(input: unknown): JobInputs {
  const base = jobInputsSchema.safeParse(input);
  if (base.success) {
    return {
      ...defaultJobInputs,
      ...base.data,
    };
  }

  return defaultJobInputs;
}

function migrateComponents(input: unknown): QuoteComponent[] {
  const base = componentsSchema.safeParse(input);
  if (base.success) {
    return base.data.map((component) => {
      if (!component.formula_builder) {
        return component;
      }

      const currentMeta = component.formula_builder.ui_meta;
      if (currentMeta) {
        return component;
      }

      return {
        ...component,
        formula_builder: {
          ...component.formula_builder,
          ui_meta: {
            mode: component.formula_builder.expression.trim() ? "ADVANCED" : "SIMPLE",
          },
        },
      };
    });
  }

  return defaultComponents;
}

export function loadPersistedState(keys: {
  settings: string;
  jobInputs: string;
  components: string;
}): {
  settings: Settings;
  jobInputs: JobInputs;
  components: QuoteComponent[];
} {
  const settingsRaw = parseJson(localStorage.getItem(keys.settings));
  const jobInputsRaw = parseJson(localStorage.getItem(keys.jobInputs));
  const componentsRaw = parseJson(localStorage.getItem(keys.components));

  const settings = migrateSettings(settingsRaw);
  const jobInputs = migrateJobInputs(jobInputsRaw);
  const components = migrateComponents(componentsRaw);

  return {
    settings,
    jobInputs,
    components,
  };
}
