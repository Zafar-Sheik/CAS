// Money helpers. All arithmetic runs in integer cents to avoid float drift.

type Decimalish = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export const toCents = (value: Decimalish) => Math.round(toNumber(value) * 100);
export const fromCents = (cents: number) => Math.round(cents) / 100;

/** Groups digits with thin spaces, SA style. Deterministic on server and client (no ICU differences). */
function group(intPart: string) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
}

export function formatMoney(value: Decimalish) {
  const cents = Math.round(toNumber(value) * 100);
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const rand = Math.floor(abs / 100).toString();
  const c = (abs % 100).toString().padStart(2, "0");
  return `${neg ? "-" : ""}R${group(rand)}.${c}`;
}

export function formatMoneyCompact(value: Decimalish) {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (x: number) => (Math.round(x * 10) / 10).toString();
  if (abs >= 1e9) return `${sign}R${trim(abs / 1e9)}bn`;
  if (abs >= 1e6) return `${sign}R${trim(abs / 1e6)}m`;
  if (abs >= 1e3) return `${sign}R${trim(abs / 1e3)}k`;
  return `${sign}R${Math.round(abs)}`;
}

export function formatQty(value: Decimalish) {
  const n = toNumber(value);
  const rounded = Math.round(n * 1000) / 1000;
  const [i, d] = Math.abs(rounded).toString().split(".");
  return `${rounded < 0 ? "-" : ""}${group(i)}${d ? `.${d}` : ""}`;
}

export type LineInput = {
  quantity: number;
  unitPrice: number;
  discountPct: number;
  vatRate: number;
};

/** Line total excluding VAT, after discount, in cents. */
export function lineNetCents(line: LineInput) {
  const gross = Math.round(line.quantity * toCents(line.unitPrice) * 1000) / 1000;
  return Math.round(gross * (1 - (line.discountPct || 0) / 100));
}

export function calcTotals(lines: LineInput[]) {
  let subtotal = 0;
  let vat = 0;
  for (const line of lines) {
    const net = lineNetCents(line);
    subtotal += net;
    vat += Math.round((net * (line.vatRate || 0)) / 100);
  }
  return {
    subtotalCents: subtotal,
    vatCents: vat,
    totalCents: subtotal + vat,
    subtotal: fromCents(subtotal),
    vat: fromCents(vat),
    total: fromCents(subtotal + vat),
  };
}
