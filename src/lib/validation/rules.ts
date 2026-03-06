import type { QuoteComponent, Settings } from "../calc/types";

export function isValidQty(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function clampMarginPct(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 99.99) {
    return 99.99;
  }

  return value;
}

export function isSettingsValid(settings: Settings): string[] {
  const errors: string[] = [];

  if (!(settings.rmb_per_myr > 0)) {
    errors.push("Exchange rate must be greater than 0.");
  }

  if (settings.buffer_pct < 0 || settings.buffer_pct > 100) {
    errors.push("Buffer % must be between 0 and 100.");
  }

  return errors;
}

export function validateComponents(components: QuoteComponent[]): string[] {
  const errors: string[] = [];

  components.forEach((component) => {
    if (component.margin_pct < 0 || component.margin_pct > 99.99) {
      errors.push(`${component.name}: margin % must be between 0 and 99.99`);
    }

    if (component.supplier_options) {
      component.supplier_options.forEach((option) => {
        const seen = new Set<number>();
        option.tiers.forEach((tier) => {
          if (!Number.isInteger(tier.qty) || tier.qty < 0) {
            errors.push(`${component.name}/${option.supplier_name}: tier qty must be integer >= 0`);
          }
          if (seen.has(tier.qty)) {
            errors.push(`${component.name}/${option.supplier_name}: duplicate tier qty ${tier.qty}`);
          }
          if (tier.sst_pct < 0 || tier.sst_pct > 100) {
            errors.push(`${component.name}/${option.supplier_name}: SST % must be between 0 and 100`);
          }
          seen.add(tier.qty);
        });
      });
    }
  });

  return errors;
}
