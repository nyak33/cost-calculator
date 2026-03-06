export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

export function parseMaybeNumber(value: string): number {
  const raw = value.replaceAll(",", "").trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
