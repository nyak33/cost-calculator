import { describe, expect, it } from "vitest";

import { defaultSettings } from "../constants/defaults";
import { detectMissingParameterNames, evaluateFormulaExpression } from "../lib/calc/formulaEngine";
import { buildExpressionAndParameters, suggestedSimpleState } from "../lib/calc/simpleFormulaTemplates";
import type { QuoteComponent, SimpleBuilderState } from "../lib/calc/types";

describe("simple formula templates", () => {
  it("builds PER_CODE expression and parameters", () => {
    const state: SimpleBuilderState = {
      template_key: "PER_CODE",
      rate: 0.0648,
      rate_currency: "MYR",
    };

    const result = buildExpressionAndParameters(state);
    expect(result.ok).toBe(true);
    expect(result.expression).toBe("rate * code_qty");
    expect(result.parameters).toEqual([{ name: "rate", value: 0.0648, currency: "MYR" }]);
  });

  it("builds PER_QTY with setup + minimum charge", () => {
    const state: SimpleBuilderState = {
      template_key: "PER_QTY",
      rate: 2,
      rate_currency: "MYR",
      setup_fee_enabled: true,
      setup_fee: 10,
      setup_fee_currency: "MYR",
      min_charge_enabled: true,
      min_charge: 120,
      min_charge_currency: "MYR",
    };

    const result = buildExpressionAndParameters(state);
    expect(result.ok).toBe(true);
    expect(result.expression).toBe("max(rate * qty + setup_fee, min_charge)");
  });

  it("injects selected component id for percentage template", () => {
    const state: SimpleBuilderState = {
      template_key: "PCT_OF_COMPONENT_COST",
      percent: 12,
      target_component_id: "comp_printing",
    };

    const result = buildExpressionAndParameters(state);
    expect(result.ok).toBe(true);
    expect(result.expression).toBe('(percent / 100) * comp("comp_printing").cost');
  });

  it("suggests Kood mapping with settings defaults", () => {
    const component = {
      component_id: "comp_kood",
      template_key: "kood_fee",
      name: "Kood Fee",
      enabled: true,
      tag: "PASS_THROUGH",
      margin_pct: 0,
      type: "FORMULA_BUILDER",
      formula_builder: { expression: "", parameters: [] },
      special_rule: "MARGIN_LOCKED_0_TOGGLEABLE",
    } satisfies QuoteComponent;

    const suggestion = suggestedSimpleState(component, defaultSettings);
    expect(suggestion.template_key).toBe("PER_CODE");
    expect(suggestion.rate_currency).toBe("MYR");
    expect(suggestion.rate).toBe(defaultSettings.kood_fee_myr_per_code);
  });
});

describe("advanced helper param detection", () => {
  it("detects missing non-built-in symbols", () => {
    const missing = detectMissingParameterNames("rate * qty + setup_fee", [{ name: "rate", value: 1, currency: "MYR" }]);
    expect(missing.ok).toBe(true);
    expect(missing.names).toEqual(["setup_fee"]);
  });

  it("keeps RMB parameter conversion in evaluator", () => {
    const result = evaluateFormulaExpression({
      expression: "rate * qty",
      parameters: [{ name: "rate", value: 1.4, currency: "RMB" }],
      context: {
        qty: 100,
        code_qty: 100,
        area_m2: 1,
        total_weight: 1,
        fx: 1.4,
      },
      fx: 1.4,
      getComponentMetric: () => 0,
    });

    expect(result.ok).toBe(true);
    expect(result.value).toBe(100);
  });
});

