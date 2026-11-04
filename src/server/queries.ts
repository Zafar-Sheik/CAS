import "server-only";
import { db } from "@/lib/db";
import { toCents, fromCents, toNumber } from "@/lib/money";
import { daysBetween } from "@/lib/utils";

export const AGING_BUCKETS = ["Current", "1–30", "31–60", "61–90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

function bucketFor(dueDate: Date, today = new Date()): AgingBucket {
  const late = daysBetween(dueDate, today);
  if (late <= 0) return "Current";
  if (late <= 30) return "1–30";
  if (late <= 60) return "31–60";
  if (late <= 90) return "61–90";
  return "90+";
}

type OpenDoc = { dueDate: Date; total: unknown; amountPaid: unknown };

export function agingOf(docs: OpenDoc[]) {
  const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  for (const d of docs) {
    const due = toCents(d.total as number) - toCents(d.amountPaid as number);
    if (due > 0) buckets[bucketFor(d.dueDate)] += due;
  }
  return AGING_BUCKETS.map((b) => ({ bucket: b, amount: fromCents(buckets[b]) }));
}

export const outstanding = (d: { total: unknown; amountPaid: unknown }) =>
  fromCents(toCents(d.total as number) - toCents(d.amountPaid as number));

export async function getSettings() {
  return db.companySettings.findUniqueOrThrow({ where: { id: 1 } });
}

/** Customer balances: open invoices less unallocated receipts (credit on account). */
export async function customerBalances() {
  const [open, receipts] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIAL"] } },
      select: { customerId: true, total: true, amountPaid: true, dueDate: true },
    }),
    db.receipt.findMany({ select: { customerId: true, amount: true, allocations: { select: { amount: true } } } }),
  ]);
  const map = new Map<string, { balance: number; overdue: number }>();
  const today = new Date();
  for (const inv of open) {
    const cur = map.get(inv.customerId) ?? { balance: 0, overdue: 0 };
    const due = toCents(inv.total) - toCents(inv.amountPaid);
    cur.balance += due;
    if (inv.dueDate < today) cur.overdue += due;
    map.set(inv.customerId, cur);
  }
  for (const r of receipts) {
    const unallocated = toCents(r.amount) - r.allocations.reduce((s, a) => s + toCents(a.amount), 0);
    if (unallocated <= 0) continue;
    const cur = map.get(r.customerId) ?? { balance: 0, overdue: 0 };
    cur.balance -= unallocated;
    map.set(r.customerId, cur);
  }
  return new Map([...map].map(([k, v]) => [k, { balance: fromCents(v.balance), overdue: fromCents(v.overdue) }]));
}

export async function supplierBalances() {
  const [open, payments] = await Promise.all([
    db.bill.findMany({
      where: { status: { in: ["POSTED", "PARTIAL"] } },
      select: { supplierId: true, total: true, amountPaid: true, dueDate: true },
    }),
    db.supplierPayment.findMany({ select: { supplierId: true, amount: true, allocations: { select: { amount: true } } } }),
  ]);
  const map = new Map<string, { balance: number; overdue: number }>();
  const today = new Date();
  for (const b of open) {
    const cur = map.get(b.supplierId) ?? { balance: 0, overdue: 0 };
    const due = toCents(b.total) - toCents(b.amountPaid);
    cur.balance += due;
    if (b.dueDate < today) cur.overdue += due;
    map.set(b.supplierId, cur);
  }
  for (const p of payments) {
    const unallocated = toCents(p.amount) - p.allocations.reduce((s, a) => s + toCents(a.amount), 0);
    if (unallocated <= 0) continue;
    const cur = map.get(p.supplierId) ?? { balance: 0, overdue: 0 };
    cur.balance -= unallocated;
    map.set(p.supplierId, cur);
  }
  return new Map([...map].map(([k, v]) => [k, { balance: fromCents(v.balance), overdue: fromCents(v.overdue) }]));
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export async function getDashboard() {
  const now = new Date();
  const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [sales, purchases, receipts, openInvoices, openBills, items, recentInvoices, projects, quotes, recentActivity] =
    await Promise.all([
      db.invoice.findMany({
        where: { status: { in: ["ISSUED", "PARTIAL", "PAID"] }, issueDate: { gte: start12 } },
        select: { issueDate: true, subtotal: true, customerId: true, customer: { select: { name: true } } },
      }),
      db.bill.findMany({
        where: { status: { in: ["POSTED", "PARTIAL", "PAID"] }, issueDate: { gte: start12 } },
        select: { issueDate: true, subtotal: true },
      }),
      db.receipt.findMany({ where: { date: { gte: start12 } }, select: { date: true, amount: true } }),
      db.invoice.findMany({
        where: { status: { in: ["ISSUED", "PARTIAL"] } },
        select: { id: true, number: true, dueDate: true, total: true, amountPaid: true, customer: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      }),
      db.bill.findMany({
        where: { status: { in: ["POSTED", "PARTIAL"] } },
        select: { id: true, number: true, dueDate: true, total: true, amountPaid: true, supplier: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      }),
      db.item.findMany({
        where: { active: true, type: "STOCK" },
        select: { id: true, sku: true, name: true, qtyOnHand: true, reorderLevel: true, costPrice: true, unit: true },
      }),
      db.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          amountPaid: true,
          issueDate: true,
          dueDate: true,
          customer: { select: { name: true } },
        },
      }),
      db.project.groupBy({ by: ["stage"], where: { status: "ACTIVE" }, _count: true, _sum: { feeValue: true } }),
      db.quote.findMany({
        where: { status: { in: ["SENT", "ACCEPTED"] } },
        select: { total: true, status: true },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        where: { NOT: { action: "auth.sign_in" } },
        select: { id: true, summary: true, createdAt: true, action: true, user: { select: { name: true } } },
      }),
    ]);

  // Monthly series
  const months: { key: string; label: string; sales: number; purchases: number; received: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleString("en-ZA", { month: "short" }), sales: 0, purchases: 0, received: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const s of sales) {
    const m = byKey.get(monthKey(s.issueDate));
    if (m) m.sales += toNumber(s.subtotal);
  }
  for (const p of purchases) {
    const m = byKey.get(monthKey(p.issueDate));
    if (m) m.purchases += toNumber(p.subtotal);
  }
  for (const r of receipts) {
    const m = byKey.get(monthKey(r.date));
    if (m) m.received += toNumber(r.amount);
  }
  months.forEach((m) => {
    m.sales = Math.round(m.sales);
    m.purchases = Math.round(m.purchases);
    m.received = Math.round(m.received);
  });

  const salesThisMonth = sales.filter((s) => s.issueDate >= startMonth).reduce((a, s) => a + toNumber(s.subtotal), 0);
  const salesLastMonth = sales
    .filter((s) => s.issueDate >= startPrevMonth && s.issueDate < startMonth)
    .reduce((a, s) => a + toNumber(s.subtotal), 0);

  const debtorsTotal = openInvoices.reduce((a, d) => a + outstanding(d), 0);
  const overdueInvoices = openInvoices.filter((d) => d.dueDate < now);
  const creditorsTotal = openBills.reduce((a, d) => a + outstanding(d), 0);
  const billsDueSoon = openBills.filter((b) => daysBetween(now, b.dueDate) <= 7);

  const stockValue = items.reduce((a, i) => a + Math.max(0, toNumber(i.qtyOnHand)) * toNumber(i.costPrice), 0);
  const lowStock = items
    .filter((i) => toNumber(i.qtyOnHand) <= toNumber(i.reorderLevel))
    .sort((a, b) => toNumber(a.qtyOnHand) - toNumber(b.qtyOnHand));

  const topCustomers = [...sales.reduce((map, s) => {
    const cur = map.get(s.customerId) ?? { name: s.customer.name, value: 0 };
    cur.value += toNumber(s.subtotal);
    map.set(s.customerId, cur);
    return map;
  }, new Map<string, { name: string; value: number }>()).values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const STAGES = ["DISCOVERY", "CONCEPT", "DEVELOPMENT", "DELIVERY"] as const;
  const pipeline = STAGES.map((stage) => {
    const row = projects.find((p) => p.stage === stage);
    return { stage, count: row?._count ?? 0, fee: toNumber(row?._sum.feeValue) };
  });

  return {
    months,
    kpis: {
      salesThisMonth,
      salesLastMonth,
      debtorsTotal,
      overdueTotal: overdueInvoices.reduce((a, d) => a + outstanding(d), 0),
      overdueCount: overdueInvoices.length,
      creditorsTotal,
      billsDueSoonTotal: billsDueSoon.reduce((a, d) => a + outstanding(d), 0),
      billsDueSoonCount: billsDueSoon.length,
      stockValue,
      lowStockCount: lowStock.length,
      openQuotesTotal: quotes.reduce((a, q) => a + toNumber(q.total), 0),
      openQuotesCount: quotes.length,
      receivedThisMonth: months[11].received,
    },
    debtorsAging: agingOf(openInvoices),
    creditorsAging: agingOf(openBills),
    overdueInvoices: overdueInvoices.slice(0, 5).map((d) => ({
      id: d.id,
      number: d.number,
      customer: d.customer.name,
      daysLate: daysBetween(d.dueDate, now),
      amount: outstanding(d),
    })),
    billsDueSoon: billsDueSoon.slice(0, 5).map((b) => ({
      id: b.id,
      number: b.number,
      supplier: b.supplier.name,
      dueInDays: daysBetween(now, b.dueDate),
      amount: outstanding(b),
    })),
    lowStock: lowStock.slice(0, 6).map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      qty: toNumber(i.qtyOnHand),
      reorder: toNumber(i.reorderLevel),
      unit: i.unit,
    })),
    recentInvoices: recentInvoices.map((i) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      customer: i.customer.name,
      total: toNumber(i.total),
      outstanding: outstanding(i),
      issueDate: i.issueDate,
      dueDate: i.dueDate,
    })),
    topCustomers,
    pipeline,
    recentActivity,
  };
}
