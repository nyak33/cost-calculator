import type { ComponentTemplate, JobInputs, QuoteComponent, Settings } from "../lib/calc/types";

export const STORAGE_KEYS = {
  settings: "ccv2.settings",
  jobInputs: "ccv2.job_inputs",
  components: "ccv2.components",
} as const;

export const SCHEMA_VERSION = 2;

export const defaultSettings: Settings = {
  schema_version: SCHEMA_VERSION,
  rmb_per_myr: 1.4,
  weight_factor: 0.25,
  buffer_pct: 10,
  intl_rm_per_kg: 29,
  kood_fee_myr_per_code: 0.0648,
  qdots_fee_rmb_per_code: 0.03,
  sst_margin_mode: "apply_margin",
  pass_through_name_list: ["Kood Fee", "Government Tax", "Courier", "SST"],
  margin_name_list: ["Printing", "Variable Data Printing", "Finishing", "Labour", "Design Fee", "Rush Fee"],
  formatting: {
    money_decimals: 2,
    unit_decimals: 4,
    percent_decimals: 2,
    weight_decimals: 3,
  },
};

export const defaultJobInputs: JobInputs = {
  width_mm: 50,
  height_mm: 30,
  quantity_scenarios: [50000, 100000, 150000],
};

export const componentTemplates: ComponentTemplate[] = [
  {
    template_key: "printing",
    default_name: "Printing",
    type: "TIER_TOTAL_MUST_MATCH",
    default_tag: "MARGIN",
    default_margin_pct: 30,
    supports_multiple_suppliers: true,
    supports_sst: true,
  },
  {
    template_key: "variable_data_printing",
    default_name: "Variable Data Printing",
    type: "TIER_TOTAL_MUST_MATCH_OR_FORMULA",
    allowed_types: ["TIER_TOTAL_MUST_MATCH", "FORMULA_BUILDER"],
    default_tag: "MARGIN",
    default_margin_pct: 20,
    supports_multiple_suppliers: true,
    supports_sst: true,
  },
  {
    template_key: "finishing",
    default_name: "Finishing",
    type: "TIER_TOTAL_MUST_MATCH",
    default_tag: "MARGIN",
    default_margin_pct: 20,
    supports_multiple_suppliers: true,
    supports_sst: true,
  },
  {
    template_key: "labour",
    default_name: "Labour Charge",
    type: "FORMULA_BUILDER",
    default_tag: "MARGIN",
    default_margin_pct: 15,
  },
  {
    template_key: "mastering",
    default_name: "Mastering Cost",
    type: "FORMULA_BUILDER",
    default_tag: "MARGIN",
    default_margin_pct: 20,
  },
  {
    template_key: "sample",
    default_name: "Sample Cost",
    type: "FORMULA_BUILDER",
    default_tag: "PASS_THROUGH",
    default_margin_pct: 0,
  },
  {
    template_key: "logistics_intl",
    default_name: "Logistics Intl",
    type: "FORMULA_BUILDER",
    default_tag: "PASS_THROUGH",
    default_margin_pct: 0,
  },
  {
    template_key: "logistics_domestic",
    default_name: "Logistics Domestic",
    type: "FORMULA_BUILDER",
    default_tag: "PASS_THROUGH",
    default_margin_pct: 0,
  },
  {
    template_key: "kood_fee",
    default_name: "Kood Fee",
    type: "FORMULA_BUILDER",
    default_tag: "PASS_THROUGH",
    default_margin_pct: 0,
    special_rule: "MARGIN_LOCKED_0_TOGGLEABLE",
  },
  {
    template_key: "qdots",
    default_name: "Qdots",
    type: "FORMULA_BUILDER",
    default_tag: "PASS_THROUGH",
    default_margin_pct: 0,
  },
  {
    template_key: "design_fee",
    default_name: "Design Fee",
    type: "FORMULA_BUILDER",
    default_tag: "MARGIN",
    default_margin_pct: 30,
  },
  {
    template_key: "rush_fee",
    default_name: "Rush Fee",
    type: "FORMULA_BUILDER",
    default_tag: "MARGIN",
    default_margin_pct: 30,
  },
];

export const defaultComponents: QuoteComponent[] = [
  {
    component_id: "comp_printing",
    template_key: "printing",
    name: "Printing",
    enabled: true,
    tag: "MARGIN",
    margin_pct: 30,
    type: "TIER_TOTAL_MUST_MATCH",
    supplier_options: [
      {
        supplier_option_id: "supA_print",
        supplier_name: "Supplier A",
        tiers: [
          { qty: 50000, price: 25000, currency: "RMB", sst_pct: 6, note: "" },
          { qty: 100000, price: 42000, currency: "RMB", sst_pct: 6, note: "" },
        ],
      },
      {
        supplier_option_id: "supD_print",
        supplier_name: "Supplier D",
        tiers: [
          { qty: 50000, price: 23000, currency: "RMB", sst_pct: 6, note: "" },
          { qty: 100000, price: 40500, currency: "RMB", sst_pct: 6, note: "" },
        ],
      },
    ],
  },
  {
    component_id: "comp_logistics_domestic",
    template_key: "logistics_domestic",
    name: "Logistics Domestic",
    enabled: true,
    tag: "PASS_THROUGH",
    margin_pct: 0,
    type: "FORMULA_BUILDER",
    formula_builder: {
      expression: "value",
      parameters: [{ name: "value", value: 0, currency: "MYR" }],
      ui_meta: {
        mode: "SIMPLE",
        simple_state: {
          template_key: "FIXED",
          value: 0,
          value_currency: "MYR",
        },
      },
    },
  },
  {
    component_id: "comp_kood",
    template_key: "kood_fee",
    name: "Kood Fee",
    enabled: true,
    tag: "PASS_THROUGH",
    margin_pct: 0,
    type: "FORMULA_BUILDER",
    formula_builder: {
      expression: "kood_rate_myr * code_qty",
      parameters: [{ name: "kood_rate_myr", value: 0.0648, currency: "MYR" }],
    },
    special_rule: "MARGIN_LOCKED_0_TOGGLEABLE",
  },
];

export function buildComponentFromTemplate(templateKey: string, index: number): QuoteComponent {
  const template = componentTemplates.find((item) => item.template_key === templateKey);
  if (!template) {
    throw new Error(`Unknown template key: ${templateKey}`);
  }

  const isTier = template.type === "TIER_TOTAL_MUST_MATCH";
  const isLogisticsDomestic = template.template_key === "logistics_domestic";

  return {
    component_id: `comp_${template.template_key}_${Date.now()}_${index}`,
    template_key: template.template_key,
    name: template.default_name,
    enabled: true,
    tag: template.default_tag,
    margin_pct: template.default_margin_pct,
    type: template.type,
    supplier_options: isTier
      ? [
          {
            supplier_option_id: `sup_${template.template_key}_${Date.now()}_${index}`,
            supplier_name: "Supplier 1",
            tiers: [],
          },
        ]
      : undefined,
    formula_builder:
      !isTier || template.type === "TIER_TOTAL_MUST_MATCH_OR_FORMULA"
        ? {
            expression: isLogisticsDomestic ? "value" : "",
            parameters: isLogisticsDomestic ? [{ name: "value", value: 0, currency: "MYR" }] : [],
            ui_meta: {
              mode: "SIMPLE",
              ...(isLogisticsDomestic
                ? {
                    simple_state: {
                      template_key: "FIXED" as const,
                      value: 0,
                      value_currency: "MYR" as const,
                    },
                  }
                : {}),
            },
          }
        : undefined,
    special_rule: template.special_rule,
  };
}
