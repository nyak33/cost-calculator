import type { JobInputs, QtyDerived, Settings } from "./types";

export function computeDerived(job: JobInputs, settings: Settings, qty: number): QtyDerived {
  const w_m = job.width_mm / 1000;
  const h_m = job.height_mm / 1000;
  const area_m2 = w_m * h_m;
  const weight_per_piece = area_m2 * settings.weight_factor;
  const total_weight = weight_per_piece * qty;
  const rawCodeQty = qty * (1 + settings.buffer_pct / 100);
  const code_qty = Math.ceil(rawCodeQty - 1e-9);

  return {
    area_m2,
    weight_per_piece,
    total_weight,
    code_qty,
  };
}

export function toMyr(value: number, currency: "MYR" | "RMB", fx: number): number {
  if (currency === "MYR") {
    return value;
  }

  return value / fx;
}
