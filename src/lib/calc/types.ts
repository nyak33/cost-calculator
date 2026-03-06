export type Currency = "MYR" | "RMB";

export type TagType = "PASS_THROUGH" | "MARGIN";

export type ComponentType =
  | "TIER_TOTAL_MUST_MATCH"
  | "FORMULA_BUILDER"
  | "TIER_TOTAL_MUST_MATCH_OR_FORMULA";

export type SstMarginMode = "apply_margin" | "pass_through";

export interface Settings {
  schema_version: number;
  rmb_per_myr: number;
  weight_factor: number;
  buffer_pct: number;
  intl_rm_per_kg: number;
  kood_fee_myr_per_code: number;
  qdots_fee_rmb_per_code: number;
  sst_margin_mode: SstMarginMode;
  pass_through_name_list: string[];
  margin_name_list: string[];
  formatting: {
    money_decimals: number;
    unit_decimals: number;
    percent_decimals: number;
    weight_decimals: number;
  };
}

export interface JobInputs {
  job_name: string;
  width_mm: number;
  height_mm: number;
  quantity_scenarios: number[];
}

export interface TierEntry {
  qty: number;
  price: number;
  currency: Currency;
  sst_pct: number;
  note?: string;
}

export interface SupplierOption {
  supplier_option_id: string;
  supplier_name: string;
  tiers: TierEntry[];
}

export interface FormulaParameter {
  name: string;
  value: number;
  currency: Currency;
}

export type FormulaEditorMode = "SIMPLE" | "ADVANCED";

export type SimpleTemplateKey =
  | "FIXED"
  | "PER_QTY"
  | "PER_1000"
  | "PER_CODE"
  | "PER_KG"
  | "PER_KG_PLUS1"
  | "PER_M2"
  | "PCT_OF_COMPONENT_COST";

export interface SimpleBuilderState {
  template_key: SimpleTemplateKey;
  rounding?: "NONE" | "ROUND_UP_1000";
  rate?: number;
  rate_currency?: Currency;
  value?: number;
  value_currency?: Currency;
  percent?: number;
  target_component_id?: string;
  min_charge_enabled?: boolean;
  min_charge?: number;
  min_charge_currency?: Currency;
  setup_fee_enabled?: boolean;
  setup_fee?: number;
  setup_fee_currency?: Currency;
}

export interface FormulaBuilderUiMeta {
  mode: FormulaEditorMode;
  simple_state?: SimpleBuilderState;
  last_applied_hash?: string;
}

export interface FormulaBuilder {
  expression: string;
  parameters: FormulaParameter[];
  ui_meta?: FormulaBuilderUiMeta;
}

export interface ComponentTemplate {
  template_key: string;
  default_name: string;
  type: ComponentType;
  allowed_types?: ComponentType[];
  default_tag: TagType;
  default_margin_pct: number;
  supports_multiple_suppliers?: boolean;
  supports_sst?: boolean;
  special_rule?: "MARGIN_LOCKED_0_TOGGLEABLE";
}

export interface QuoteComponent {
  component_id: string;
  template_key: string;
  name: string;
  enabled: boolean;
  tag: TagType;
  margin_pct: number;
  type: ComponentType;
  supplier_options?: SupplierOption[];
  formula_builder?: FormulaBuilder;
  special_rule?: "MARGIN_LOCKED_0_TOGGLEABLE";
}

export interface ComputeQuoteInput {
  settings: Settings;
  job: JobInputs;
  components: QuoteComponent[];
}

export interface QtyDerived {
  area_m2: number;
  weight_per_piece: number;
  total_weight: number;
  code_qty: number;
}

export interface CostLine {
  component_id: string;
  component_name: string;
  supplier_name: string | null;
  tag: TagType;
  cost_myr: number;
  sell_myr: number;
  profit_myr: number;
  is_sst_pass_through?: boolean;
}

export interface QtyResult {
  qty: number;
  status: "OK" | "NA";
  warnings: string[];
  derived: QtyDerived;
  chosen_suppliers: Record<string, string | null>;
  totals: {
    cost_total_myr: number | null;
    sell_total_myr: number | null;
    profit_total_myr: number | null;
    pass_through_sell_total_myr: number | null;
    overall_margin_pct: number | null;
    margin_ex_pass_through_pct: number | null;
    unit_cost_myr: number | null;
    unit_price_myr: number | null;
  };
  lines: CostLine[];
}

export interface QuoteWarning {
  qty: number;
  component_id: string;
  supplier_option_id?: string;
  message: string;
}

export interface ComputeQuoteOutput {
  per_qty: QtyResult[];
  warnings: QuoteWarning[];
}

export interface FormulaContext {
  qty: number;
  code_qty: number;
  area_m2: number;
  total_weight: number;
  fx: number;
}

export interface FormulaEvalResult {
  ok: boolean;
  value?: number;
  error?: string;
  references: string[];
}

export interface ComponentEvalResult {
  ok: boolean;
  cost_myr?: number;
  supplier_option_id?: string | null;
  supplier_name?: string | null;
  warning?: string;
  sst_pass_through_myr?: number;
}

export interface SupplierCompareRow {
  qty: number;
  costsBySupplier: Record<string, number | null>;
  bestSupplierOptionId: string | null;
}

export interface SupplierCompareTable {
  component_id: string;
  component_name: string;
  supplierHeaders: Array<{ supplier_option_id: string; supplier_name: string }>;
  rows: SupplierCompareRow[];
}
