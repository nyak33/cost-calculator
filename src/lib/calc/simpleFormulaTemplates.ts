import type {
  Currency,
  FormulaParameter,
  QuoteComponent,
  Settings,
  SimpleBuilderState,
  SimpleTemplateKey,
} from "./types";

export interface BuildExpressionResult {
  ok: boolean;
  expression?: string;
  parameters?: FormulaParameter[];
  error?: string;
}

function buildParameter(name: string, value: number | undefined, currency: Currency = "MYR"): FormulaParameter {
  return {
    name,
    value: Number.isFinite(value ?? NaN) ? (value as number) : 0,
    currency,
  };
}

function baseExpression(simple: SimpleBuilderState): BuildExpressionResult {
  switch (simple.template_key) {
    case "FIXED":
      return {
        ok: true,
        expression: "value",
        parameters: [buildParameter("value", simple.value, simple.value_currency ?? "MYR")],
      };
    case "PER_QTY":
      return {
        ok: true,
        expression: simple.rounding === "ROUND_UP_1000" ? "rate * ceil(qty / 1000)" : "rate * qty",
        parameters: [buildParameter("rate", simple.rate, simple.rate_currency ?? "MYR")],
      };
    case "PER_1000":
      return {
        ok: true,
        expression: "rate * ceil(qty / 1000)",
        parameters: [buildParameter("rate", simple.rate, simple.rate_currency ?? "MYR")],
      };
    case "PER_CODE":
      return {
        ok: true,
        expression: "rate * code_qty",
        parameters: [buildParameter("rate", simple.rate, simple.rate_currency ?? "MYR")],
      };
    case "PER_KG":
      return {
        ok: true,
        expression: "rate * total_weight",
        parameters: [buildParameter("rate", simple.rate, simple.rate_currency ?? "MYR")],
      };
    case "PER_KG_PLUS1":
      return {
        ok: true,
        expression: "rate * (total_weight + 1)",
        parameters: [buildParameter("rate", simple.rate, simple.rate_currency ?? "MYR")],
      };
    case "PER_M2":
      return {
        ok: true,
        expression: "rate * area_m2 * qty",
        parameters: [buildParameter("rate", simple.rate, simple.rate_currency ?? "MYR")],
      };
    case "PCT_OF_COMPONENT_COST":
      if (!simple.target_component_id) {
        return {
          ok: false,
          error: "Please select target component",
        };
      }
      return {
        ok: true,
        expression: `(percent / 100) * comp("${simple.target_component_id}").cost`,
        parameters: [buildParameter("percent", simple.percent, "MYR")],
      };
    default:
      return {
        ok: false,
        error: "Unsupported template",
      };
  }
}

function supportsAdjustments(templateKey: SimpleTemplateKey): boolean {
  return (
    templateKey === "PER_QTY" ||
    templateKey === "PER_1000" ||
    templateKey === "PER_CODE" ||
    templateKey === "PER_KG" ||
    templateKey === "PER_KG_PLUS1" ||
    templateKey === "PER_M2"
  );
}

export function buildExpressionAndParameters(simple: SimpleBuilderState): BuildExpressionResult {
  const base = baseExpression(simple);
  if (!base.ok || !base.expression || !base.parameters) {
    return base;
  }

  if (!supportsAdjustments(simple.template_key)) {
    return base;
  }

  const parameters = [...base.parameters];
  const rateCurrency = simple.rate_currency ?? "MYR";
  const minCurrency = simple.min_charge_currency ?? rateCurrency;
  const setupCurrency = simple.setup_fee_currency ?? rateCurrency;

  const hasSetup = Boolean(simple.setup_fee_enabled);
  const hasMinCharge = Boolean(simple.min_charge_enabled);

  let expr = base.expression;

  if (hasSetup) {
    expr = `${expr} + setup_fee`;
    parameters.push(buildParameter("setup_fee", simple.setup_fee, setupCurrency));
  }

  if (hasMinCharge) {
    expr = `max(${expr}, min_charge)`;
    parameters.push(buildParameter("min_charge", simple.min_charge, minCurrency));
  }

  return {
    ok: true,
    expression: expr,
    parameters,
  };
}

export function suggestedSimpleState(component: QuoteComponent, settings: Settings): SimpleBuilderState {
  switch (component.template_key) {
    case "kood_fee":
      return {
        template_key: "PER_CODE",
        rate: settings.kood_fee_myr_per_code,
        rate_currency: "MYR",
      };
    case "qdots":
      return {
        template_key: "PER_CODE",
        rate: settings.qdots_fee_rmb_per_code,
        rate_currency: "RMB",
      };
    case "logistics_intl":
      return {
        template_key: "PER_KG_PLUS1",
        rate: settings.intl_rm_per_kg,
        rate_currency: "MYR",
      };
    case "logistics_domestic":
      return {
        template_key: "PER_KG",
        rate: settings.intl_rm_per_kg,
        rate_currency: "MYR",
      };
    case "sample":
    case "design_fee":
    case "rush_fee":
    case "mastering":
      return {
        template_key: "FIXED",
        value: 0,
        value_currency: "MYR",
      };
    case "labour":
      return {
        template_key: "PER_QTY",
        rate: 0,
        rate_currency: "MYR",
        rounding: "NONE",
      };
    default:
      return {
        template_key: "PER_QTY",
        rate: 0,
        rate_currency: "MYR",
        rounding: "NONE",
      };
  }
}

export function hashFormulaDraft(expression: string, parameters: FormulaParameter[]): string {
  return JSON.stringify({
    expression: expression.trim(),
    parameters: parameters.map((item) => ({ name: item.name, value: item.value, currency: item.currency })),
  });
}

