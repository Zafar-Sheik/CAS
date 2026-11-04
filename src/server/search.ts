"use server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { z } from "zod";

export type SearchHit = { type: string; title: string; subtitle: string; href: string };

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const q = z.string().trim().max(80).parse(query);
  if (q.length < 2) return [];
  const contains = { contains: q };
  const [customers, suppliers, invoices, quotes, bills, items, projects] = await Promise.all([
    db.customer.findMany({ where: { OR: [{ name: contains }, { code: contains }, { email: contains }, { phone: contains }] }, take: 5 }),
    db.supplier.findMany({ where: { OR: [{ name: contains }, { code: contains }, { email: contains }] }, take: 5 }),
    db.invoice.findMany({
      where: { OR: [{ number: contains }, { reference: contains }, { customer: { name: contains } }] },
      include: { customer: { select: { name: true } } },
      orderBy: { issueDate: "desc" },
      take: 5,
    }),
    db.quote.findMany({
      where: { OR: [{ number: contains }, { customer: { name: contains } }] },
      include: { customer: { select: { name: true } } },
      take: 4,
    }),
    db.bill.findMany({
      where: { OR: [{ number: contains }, { supplierRef: contains }, { supplier: { name: contains } }] },
      include: { supplier: { select: { name: true } } },
      take: 4,
    }),
    db.item.findMany({ where: { OR: [{ name: contains }, { sku: contains }, { barcode: contains }] }, take: 5 }),
    db.project.findMany({ where: { OR: [{ name: contains }, { code: contains }] }, take: 4 }),
  ]);
  return [
    ...invoices.map((i) => ({ type: "Invoice", title: i.number, subtitle: `${i.customer.name} · ${formatMoney(i.total)}`, href: `/invoices/${i.id}` })),
    ...customers.map((c) => ({ type: "Customer", title: c.name, subtitle: c.code, href: `/debtors/${c.id}` })),
    ...items.map((i) => ({ type: "Item", title: i.name, subtitle: i.sku, href: `/inventory/${i.id}` })),
    ...quotes.map((x) => ({ type: "Quote", title: x.number, subtitle: `${x.customer.name} · ${formatMoney(x.total)}`, href: `/quotes/${x.id}` })),
    ...projects.map((p) => ({ type: "Project", title: p.name, subtitle: p.code, href: `/projects/${p.id}` })),
    ...suppliers.map((s) => ({ type: "Supplier", title: s.name, subtitle: s.code, href: `/creditors/${s.id}` })),
    ...bills.map((b) => ({ type: "Bill", title: b.number, subtitle: `${b.supplier.name} · ${formatMoney(b.total)}`, href: `/bills/${b.id}` })),
  ];
}
