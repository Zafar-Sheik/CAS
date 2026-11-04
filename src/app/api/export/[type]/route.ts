import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { toNumber } from "@/lib/money";
import { customerBalances } from "@/server/queries";

/** Neutralises spreadsheet formula injection and quotes CSV cells. */
function cell(v: unknown) {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");

function dateParam(v: string | null, fallback: Date) {
  const d = v ? new Date(v) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/export/[type]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!can(user.role, "reports:export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { type } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const from = dateParam(sp.get("from"), new Date(new Date().getFullYear(), 0, 1));
  const to = dateParam(sp.get("to"), new Date());
  const range = { gte: from, lt: to };
  let rows: unknown[][];

  switch (type) {
    case "invoices": {
      const list = await db.invoice.findMany({ where: { issueDate: range, status: { not: "DRAFT" } }, include: { customer: true }, orderBy: { issueDate: "asc" } });
      rows = [["Number", "Date", "Due", "Customer", "Customer VAT no.", "Status", "Subtotal", "VAT", "Total", "Paid"]];
      for (const i of list) rows.push([i.number, i.issueDate, i.dueDate, i.customer.name, i.customer.vatNumber, i.status, toNumber(i.subtotal), toNumber(i.vatTotal), toNumber(i.total), toNumber(i.amountPaid)]);
      break;
    }
    case "receipts": {
      const list = await db.receipt.findMany({ where: { date: range }, include: { customer: true }, orderBy: { date: "asc" } });
      rows = [["Number", "Date", "Customer", "Method", "Reference", "Amount"]];
      for (const r of list) rows.push([r.number, r.date, r.customer.name, r.method, r.reference, toNumber(r.amount)]);
      break;
    }
    case "bills": {
      const list = await db.bill.findMany({ where: { issueDate: range, status: { not: "DRAFT" } }, include: { supplier: true }, orderBy: { issueDate: "asc" } });
      rows = [["Number", "Supplier ref.", "Date", "Due", "Supplier", "Supplier VAT no.", "Category", "Status", "Subtotal", "VAT", "Total", "Paid"]];
      for (const b of list) rows.push([b.number, b.supplierRef, b.issueDate, b.dueDate, b.supplier.name, b.supplier.vatNumber, b.category, b.status, toNumber(b.subtotal), toNumber(b.vatTotal), toNumber(b.total), toNumber(b.amountPaid)]);
      break;
    }
    case "payments": {
      const list = await db.supplierPayment.findMany({ where: { date: range }, include: { supplier: true }, orderBy: { date: "asc" } });
      rows = [["Number", "Date", "Supplier", "Method", "Reference", "Amount"]];
      for (const p of list) rows.push([p.number, p.date, p.supplier.name, p.method, p.reference, toNumber(p.amount)]);
      break;
    }
    case "stock": {
      const list = await db.item.findMany({ where: { type: "STOCK" }, orderBy: { sku: "asc" } });
      rows = [["SKU", "Name", "Category", "Unit", "On hand", "Reorder level", "Cost", "Sell", "Value at cost"]];
      for (const i of list) rows.push([i.sku, i.name, i.category, i.unit, toNumber(i.qtyOnHand), toNumber(i.reorderLevel), toNumber(i.costPrice), toNumber(i.sellPrice), Math.max(0, toNumber(i.qtyOnHand)) * toNumber(i.costPrice)]);
      break;
    }
    case "debtors": {
      const [list, bal] = await Promise.all([db.customer.findMany({ orderBy: { name: "asc" } }), customerBalances()]);
      rows = [["Code", "Name", "Email", "Phone", "Balance", "Overdue"]];
      for (const c of list) {
        const b = bal.get(c.id) ?? { balance: 0, overdue: 0 };
        rows.push([c.code, c.name, c.email, c.phone, b.balance, b.overdue]);
      }
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  await audit(db, { userId: user.id, action: "export", entity: type, summary: `Exported ${type} CSV` });
  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cas-${type}-${from.toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
