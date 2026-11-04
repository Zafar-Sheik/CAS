"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { paymentSchema, type PaymentInput } from "@/lib/validation";
import { toCents, fromCents, formatMoney } from "@/lib/money";
import { run, UserError, type ActionResult } from "./action";

const refresh = () => revalidatePath("/", "layout");

type OpenDoc = { id: string; number: string; total: unknown; amountPaid: unknown };

/** Works out how a payment spreads over open documents (explicit, or oldest first). */
function allocate(amountCents: number, open: OpenDoc[], explicit?: { documentId: string; amount: number }[]) {
  const outstanding = new Map(open.map((d) => [d.id, toCents(d.total as number) - toCents(d.amountPaid as number)]));
  const result: { id: string; cents: number }[] = [];
  if (explicit && explicit.length) {
    let sum = 0;
    for (const a of explicit) {
      const cents = toCents(a.amount);
      if (cents <= 0) continue;
      const due = outstanding.get(a.documentId);
      if (due === undefined) throw new UserError("A selected document is not open for payment.");
      if (cents > due) throw new UserError("An allocation is more than the amount owing.");
      sum += cents;
      result.push({ id: a.documentId, cents });
    }
    if (sum > amountCents) throw new UserError("Allocations add up to more than the payment.");
    return result;
  }
  let left = amountCents;
  for (const d of open) {
    if (left <= 0) break;
    const due = outstanding.get(d.id) ?? 0;
    if (due <= 0) continue;
    const take = Math.min(due, left);
    result.push({ id: d.id, cents: take });
    left -= take;
  }
  return result;
}

const statusAfter = (totalCents: number, paidCents: number) =>
  paidCents >= totalCents ? "PAID" : paidCents > 0 ? "PARTIAL" : null;

// ── Customer receipts (debtors) ─────────────────────────────

export async function createReceipt(input: PaymentInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    const data = paymentSchema.parse(input);
    const amountCents = toCents(data.amount);
    const id = await db.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: data.partyId } });
      if (!customer) throw new UserError("Customer not found.");
      const open = await tx.invoice.findMany({
        where: { customerId: customer.id, status: { in: ["ISSUED", "PARTIAL"] } },
        orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
      });
      const allocations = allocate(amountCents, open, data.allocations);
      const number = await nextNumber(tx, "nextReceiptNo");
      const receipt = await tx.receipt.create({
        data: {
          number,
          customerId: customer.id,
          date: data.date,
          amount: fromCents(amountCents),
          method: data.method,
          reference: data.reference,
          notes: data.notes,
          createdById: user.id,
          allocations: { create: allocations.map((a) => ({ invoiceId: a.id, amount: fromCents(a.cents) })) },
        },
      });
      for (const a of allocations) {
        const inv = open.find((d) => d.id === a.id)!;
        const paid = toCents(inv.amountPaid) + a.cents;
        await tx.invoice.update({
          where: { id: inv.id },
          data: { amountPaid: fromCents(paid), status: statusAfter(toCents(inv.total), paid) ?? inv.status },
        });
      }
      await audit(tx, {
        userId: user.id,
        action: "receipt.create",
        entity: "receipt",
        entityId: receipt.id,
        summary: `${number}: ${formatMoney(data.amount)} from ${customer.name}`,
      });
      return receipt.id;
    });
    refresh();
    return { ok: true, data: { id }, message: "Payment received" };
  });
}

export async function reverseReceipt(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("documents:void");
    await db.$transaction(async (tx) => {
      const r = await tx.receipt.findUnique({ where: { id }, include: { allocations: { include: { invoice: true } } } });
      if (!r) throw new UserError("Receipt not found.");
      for (const a of r.allocations) {
        const paid = Math.max(0, toCents(a.invoice.amountPaid) - toCents(a.amount));
        await tx.invoice.update({
          where: { id: a.invoiceId },
          data: { amountPaid: fromCents(paid), status: paid > 0 ? "PARTIAL" : "ISSUED" },
        });
      }
      await tx.receipt.delete({ where: { id } });
      await audit(tx, {
        userId: user.id,
        action: "receipt.reverse",
        entity: "receipt",
        entityId: id,
        summary: `Reversed ${r.number} (${formatMoney(r.amount)})`,
      });
    });
    refresh();
    return { ok: true, message: "Receipt reversed" };
  });
}

// ── Supplier payments (creditors) ───────────────────────────

export async function createSupplierPayment(input: PaymentInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("purchases:write");
    const data = paymentSchema.parse(input);
    const amountCents = toCents(data.amount);
    const id = await db.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: data.partyId } });
      if (!supplier) throw new UserError("Supplier not found.");
      const open = await tx.bill.findMany({
        where: { supplierId: supplier.id, status: { in: ["POSTED", "PARTIAL"] } },
        orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
      });
      const allocations = allocate(amountCents, open, data.allocations);
      const number = await nextNumber(tx, "nextPaymentNo");
      const payment = await tx.supplierPayment.create({
        data: {
          number,
          supplierId: supplier.id,
          date: data.date,
          amount: fromCents(amountCents),
          method: data.method,
          reference: data.reference,
          notes: data.notes,
          createdById: user.id,
          allocations: { create: allocations.map((a) => ({ billId: a.id, amount: fromCents(a.cents) })) },
        },
      });
      for (const a of allocations) {
        const bill = open.find((d) => d.id === a.id)!;
        const paid = toCents(bill.amountPaid) + a.cents;
        await tx.bill.update({
          where: { id: bill.id },
          data: { amountPaid: fromCents(paid), status: statusAfter(toCents(bill.total), paid) ?? bill.status },
        });
      }
      await audit(tx, {
        userId: user.id,
        action: "supplier_payment.create",
        entity: "supplier_payment",
        entityId: payment.id,
        summary: `${number}: paid ${formatMoney(data.amount)} to ${supplier.name}`,
      });
      return payment.id;
    });
    refresh();
    return { ok: true, data: { id }, message: "Payment recorded" };
  });
}

export async function reverseSupplierPayment(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("documents:void");
    await db.$transaction(async (tx) => {
      const p = await tx.supplierPayment.findUnique({
        where: { id },
        include: { allocations: { include: { bill: true } } },
      });
      if (!p) throw new UserError("Payment not found.");
      for (const a of p.allocations) {
        const paid = Math.max(0, toCents(a.bill.amountPaid) - toCents(a.amount));
        await tx.bill.update({
          where: { id: a.billId },
          data: { amountPaid: fromCents(paid), status: paid > 0 ? "PARTIAL" : "POSTED" },
        });
      }
      await tx.supplierPayment.delete({ where: { id } });
      await audit(tx, {
        userId: user.id,
        action: "supplier_payment.reverse",
        entity: "supplier_payment",
        entityId: id,
        summary: `Reversed ${p.number} (${formatMoney(p.amount)})`,
      });
    });
    refresh();
    return { ok: true, message: "Payment reversed" };
  });
}
