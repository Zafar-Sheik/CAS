import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { toDateInput } from "@/lib/utils";
import type { DocumentInitial, PickerItem } from "@/components/documents/document-editor";
import type { Prisma } from "@/generated/prisma/client";

export async function getEditorData(kind: "invoice" | "quote" | "bill") {
  const [settings, items, parties, projects, categories] = await Promise.all([
    db.companySettings.findUniqueOrThrow({ where: { id: 1 } }),
    db.item.findMany({ where: { active: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    kind === "bill"
      ? db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, termsDays: true } })
      : db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, termsDays: true } }),
    kind === "bill"
      ? Promise.resolve([])
      : db.project.findMany({ where: { status: { in: ["ACTIVE", "ON_HOLD"] } }, select: { id: true, name: true, customerId: true }, orderBy: { name: "asc" } }),
    kind === "bill"
      ? db.bill.findMany({ distinct: ["category"], select: { category: true }, where: { category: { not: null } } })
      : Promise.resolve([]),
  ]);
  const pickerItems: PickerItem[] = items.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    type: i.type,
    unit: i.unit,
    sellPrice: toNumber(i.sellPrice),
    costPrice: toNumber(i.costPrice),
    vatRate: toNumber(i.vatRate),
    qtyOnHand: toNumber(i.qtyOnHand),
  }));
  return {
    defaultVat: toNumber(settings.defaultVatRate),
    items: pickerItems,
    parties,
    projects,
    categories: (categories as { category: string | null }[]).map((c) => c.category!).filter(Boolean),
  };
}

type LineRow = {
  itemId: string | null;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountPct: Prisma.Decimal;
  vatRate: Prisma.Decimal;
};

export function toInitialLines(lines: LineRow[]): DocumentInitial["lines"] {
  return lines.map((l) => ({
    itemId: l.itemId,
    description: l.description,
    quantity: String(toNumber(l.quantity)),
    unitPrice: String(toNumber(l.unitPrice)),
    discountPct: String(toNumber(l.discountPct)),
    vatRate: String(toNumber(l.vatRate)),
  }));
}

export { toDateInput };
