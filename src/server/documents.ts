import "server-only";
import { randomBytes } from "node:crypto";
import { calcTotals, lineNetCents, fromCents } from "@/lib/money";
import type { z } from "zod";
import type { lineSchema } from "@/lib/validation";

type Line = z.output<typeof lineSchema>;

/** Turns validated form lines into rows + document totals. */
export function buildLines(lines: Line[]) {
  const rows = lines.map((l, i) => ({
    itemId: l.itemId,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    vatRate: l.vatRate,
    lineTotal: fromCents(lineNetCents(l)),
    sortOrder: i,
  }));
  const totals = calcTotals(lines);
  return { rows, subtotal: totals.subtotal, vatTotal: totals.vat, total: totals.total };
}

export const draftNumber = () => `DRAFT-${randomBytes(4).toString("hex").toUpperCase()}`;
