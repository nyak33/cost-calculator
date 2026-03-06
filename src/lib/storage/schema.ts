import { z } from "zod";

import type { ComponentType, Currency, SstMarginMode, TagType } from "../calc/types";

const currencySchema = z.union([z.literal("MYR"), z.literal("RMB")]) satisfies z.ZodType<Currency>;
const tagSchema = z.union([z.literal("PASS_THROUGH"), z.literal("MARGIN")]) satisfies z.ZodType<TagType>;
const typeSchema = z.union([
  z.literal("TIER_TOTAL_MUST_MATCH"),
  z.literal("FORMULA_BUILDER"),
  z.literal("TIER_TOTAL_MUST_MATCH_OR_FORMULA"),
]) satisfies z.ZodType<ComponentType>;
const sstSchema = z.union([z.literal("apply_margin"), z.literal("pass_through")]) satisfies z.ZodType<SstMarginMode>;

export const tierEntrySchema = z.object({
  qty: z.number(),
  price: z.number(),
  currency: currencySchema,
  sst_pct: z.number(),
  note: z.string().optional(),
});

export const supplierOptionSchema = z.object({
  supplier_option_id: z.string(),
  supplier_name: z.string(),
  tiers: z.array(tierEntrySchema),
});

export const formulaParameterSchema = z.object({
  name: z.string(),
  value: z.number(),
  currency: currencySchema,
});

const simpleTemplateKeySchema = z.union([
  z.literal("FIXED"),
  z.literal("PER_QTY"),
  z.literal("PER_1000"),
  z.literal("PER_CODE"),
  z.literal("PER_KG"),
  z.literal("PER_KG_PLUS1"),
  z.literal("PER_M2"),
  z.literal("PCT_OF_COMPONENT_COST"),
]);

const formulaEditorModeSchema = z.union([z.literal("SIMPLE"), z.literal("ADVANCED")]);

const simpleBuilderStateSchema = z.object({
  template_key: simpleTemplateKeySchema,
  rounding: z.union([z.literal("NONE"), z.literal("ROUND_UP_1000")]).optional(),
  rate: z.number().optional(),
  rate_currency: currencySchema.optional(),
  value: z.number().optional(),
  value_currency: currencySchema.optional(),
  percent: z.number().optional(),
  target_component_id: z.string().optional(),
  min_charge_enabled: z.boolean().optional(),
  min_charge: z.number().optional(),
  min_charge_currency: currencySchema.optional(),
  setup_fee_enabled: z.boolean().optional(),
  setup_fee: z.number().optional(),
  setup_fee_currency: currencySchema.optional(),
});

const formulaBuilderUiMetaSchema = z.object({
  mode: formulaEditorModeSchema,
  simple_state: simpleBuilderStateSchema.optional(),
  last_applied_hash: z.string().optional(),
});

export const formulaBuilderSchema = z.object({
  expression: z.string(),
  parameters: z.array(formulaParameterSchema),
  ui_meta: formulaBuilderUiMetaSchema.optional(),
});

export const settingsSchema = z.object({
  schema_version: z.number().int(),
  rmb_per_myr: z.number(),
  weight_factor: z.number(),
  buffer_pct: z.number(),
  intl_rm_per_kg: z.number(),
  kood_fee_myr_per_code: z.number(),
  qdots_fee_rmb_per_code: z.number(),
  sst_margin_mode: sstSchema,
  pass_through_name_list: z.array(z.string()),
  margin_name_list: z.array(z.string()),
  formatting: z.object({
    money_decimals: z.number().int(),
    unit_decimals: z.number().int(),
    percent_decimals: z.number().int(),
    weight_decimals: z.number().int(),
  }),
});

export const jobInputsSchema = z.object({
  job_name: z.string().default("Untitled Quote"),
  width_mm: z.number(),
  height_mm: z.number(),
  quantity_scenarios: z.array(z.number().int()),
});

export const componentSchema = z.object({
  component_id: z.string(),
  template_key: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  tag: tagSchema,
  margin_pct: z.number(),
  type: typeSchema,
  supplier_options: z.array(supplierOptionSchema).optional(),
  formula_builder: formulaBuilderSchema.optional(),
  special_rule: z.literal("MARGIN_LOCKED_0_TOGGLEABLE").optional(),
});

export const componentsSchema = z.array(componentSchema);
