"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { invoiceSchema, quoteSchema, type InvoiceInput, type QuoteInput } from "@/lib/validation";
import { toNumber, formatMoney } from "@/lib/money";
import { run, UserError, type ActionResult } from "./action";
import { buildLines, draftNumber } from "./documents";
import { z } from "zod";

const refresh = () => revalidatePath("/", "layout");

// ── Invoices ────────────────────────────────────────────────

export async function saveInvoice(input: InvoiceInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    const data = invoiceSchema.parse(input);
    if (data.dueDate < data.issueDate) throw new UserError("The due date can't be before the invoice date.");
    const { rows, ...totals } = buildLines(data.lines);

    const id = await db.$transaction(async (tx) => {
      if (data.id) {
        const existing = await tx.invoice.findUnique({ where: { id: data.id } });
        if (!existing) throw new UserError("Invoice not found.");
        if (existing.status !== "DRAFT") throw new UserError("Only draft invoices can be edited.");
        await tx.invoiceLine.deleteMany({ where: { invoiceId: data.id } });
        await tx.invoice.update({
          where: { id: data.id },
          data: {
            customerId: data.customerId,
            projectId: data.projectId,
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            reference: data.reference,
            notes: data.notes,
            ...totals,
            lines: { create: rows },
          },
        });
        await audit(tx, {
          userId: user.id,
          action: "invoice.update",
          entity: "invoice",
          entityId: data.id,
          summary: `Updated draft ${existing.number} (${formatMoney(totals.total)})`,
        });
        return data.id;
      }
      const created = await tx.invoice.create({
        data: {
          number: draftNumber(),
          customerId: data.customerId,
          projectId: data.projectId,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          reference: data.reference,
          notes: data.notes,
          ...totals,
          createdById: user.id,
          lines: { create: rows },
        },
      });
      await audit(tx, {
        userId: user.id,
        action: "invoice.create",
        entity: "invoice",
        entityId: created.id,
        summary: `Created draft invoice (${formatMoney(totals.total)})`,
      });
      return created.id;
    });
    refresh();
    return { ok: true, data: { id }, message: "Invoice saved" };
  });
}

export async function issueInvoice(id: string): Promise<ActionResult<{ number: string }>> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    z.string().min(1).parse(id);
    const number = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id }, include: { lines: { include: { item: true } } } });
      if (!inv) throw new UserError("Invoice not found.");
      if (inv.status !== "DRAFT") throw new UserError("This invoice has already been issued.");
      const settings = await tx.companySettings.findUniqueOrThrow({ where: { id: 1 } });
      const number = await nextNumber(tx, "nextInvoiceNo");

      for (const line of inv.lines) {
        if (!line.item || line.item.type !== "STOCK") continue;
        const qty = toNumber(line.quantity);
        const updated = await tx.item.update({
          where: { id: line.item.id },
          data: { qtyOnHand: { decrement: qty } },
        });
        const balance = toNumber(updated.qtyOnHand);
        if (balance < 0 && !settings.allowNegativeStock) {
          throw new UserError(
            `Not enough stock for ${line.item.name}: ${toNumber(line.item.qtyOnHand)} on hand, ${qty} needed.`,
          );
        }
        await tx.stockMovement.create({
          data: {
            itemId: line.item.id,
            type: qty >= 0 ? "SALE" : "RETURN_IN",
            quantity: -qty,
            unitCost: line.item.costPrice,
            balance,
            reference: number,
            userId: user.id,
          },
        });
      }

      await tx.invoice.update({
        where: { id },
        data: { number, status: "ISSUED", issuedAt: new Date() },
      });
      await audit(tx, {
        userId: user.id,
        action: "invoice.issue",
        entity: "invoice",
        entityId: id,
        summary: `Issued ${number} for ${formatMoney(inv.total)}`,
      });
      return number;
    });
    refresh();
    return { ok: true, data: { number }, message: `Invoice ${number} issued` };
  });
}

export async function voidInvoice(id: string, reason: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("documents:void");
    const why = z.string().trim().min(3, "Give a reason").max(500).parse(reason);
    await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id }, include: { lines: { include: { item: true } } } });
      if (!inv) throw new UserError("Invoice not found.");
      if (inv.status === "VOID") throw new UserError("Already void.");
      if (inv.status === "DRAFT") throw new UserError("Delete the draft instead.");
      if (toNumber(inv.amountPaid) > 0)
        throw new UserError("This invoice has payments. Reverse the receipts first.");
      for (const line of inv.lines) {
        if (!line.item || line.item.type !== "STOCK") continue;
        const qty = toNumber(line.quantity);
        const updated = await tx.item.update({
          where: { id: line.item.id },
          data: { qtyOnHand: { increment: qty } },
        });
        await tx.stockMovement.create({
          data: {
            itemId: line.item.id,
            type: "VOID_REVERSAL",
            quantity: qty,
            unitCost: line.item.costPrice,
            balance: updated.qtyOnHand,
            reference: inv.number,
            note: "Invoice voided",
            userId: user.id,
          },
        });
      }
      await tx.invoice.update({
        where: { id },
        data: { status: "VOID", voidedAt: new Date(), voidReason: why },
      });
      await audit(tx, {
        userId: user.id,
        action: "invoice.void",
        entity: "invoice",
        entityId: id,
        summary: `Voided ${inv.number}: ${why}`,
      });
    });
    refresh();
    return { ok: true, message: "Invoice voided" };
  });
}

export async function deleteDraftInvoice(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id } });
      if (!inv) throw new UserError("Invoice not found.");
      if (inv.status !== "DRAFT") throw new UserError("Only drafts can be deleted. Void it instead.");
      await tx.quote.updateMany({ where: { invoiceId: id }, data: { invoiceId: null, status: "ACCEPTED" } });
      await tx.invoice.delete({ where: { id } });
      await audit(tx, {
        userId: user.id,
        action: "invoice.delete",
        entity: "invoice",
        entityId: id,
        summary: `Deleted draft ${inv.number}`,
      });
    });
    refresh();
    return { ok: true, message: "Draft deleted" };
  });
}

// ── Quotes ──────────────────────────────────────────────────

export async function saveQuote(input: QuoteInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    const data = quoteSchema.parse(input);
    const { rows, ...totals } = buildLines(data.lines);
    const id = await db.$transaction(async (tx) => {
      const fields = {
        customerId: data.customerId,
        projectId: data.projectId,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        reference: data.reference,
        notes: data.notes,
        ...totals,
      };
      if (data.id) {
        const existing = await tx.quote.findUnique({ where: { id: data.id } });
        if (!existing) throw new UserError("Quote not found.");
        if (existing.status === "CONVERTED") throw new UserError("This quote is already invoiced.");
        await tx.quoteLine.deleteMany({ where: { quoteId: data.id } });
        await tx.quote.update({ where: { id: data.id }, data: { ...fields, lines: { create: rows } } });
        await audit(tx, {
          userId: user.id,
          action: "quote.update",
          entity: "quote",
          entityId: data.id,
          summary: `Updated ${existing.number}`,
        });
        return data.id;
      }
      const number = await nextNumber(tx, "nextQuoteNo");
      const q = await tx.quote.create({
        data: { ...fields, number, createdById: user.id, lines: { create: rows } },
      });
      await audit(tx, {
        userId: user.id,
        action: "quote.create",
        entity: "quote",
        entityId: q.id,
        summary: `Created ${number} (${formatMoney(totals.total)})`,
      });
      return q.id;
    });
    refresh();
    return { ok: true, data: { id }, message: "Quote saved" };
  });
}

export async function setQuoteStatus(
  id: string,
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED",
): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    z.enum(["DRAFT", "SENT", "ACCEPTED", "DECLINED"]).parse(status);
    const q = await db.quote.findUnique({ where: { id } });
    if (!q) throw new UserError("Quote not found.");
    if (q.status === "CONVERTED") throw new UserError("This quote is already invoiced.");
    await db.quote.update({ where: { id }, data: { status } });
    await audit(db, {
      userId: user.id,
      action: "quote.status",
      entity: "quote",
      entityId: id,
      summary: `${q.number} marked ${status.toLowerCase()}`,
    });
    refresh();
    return { ok: true, message: `Quote marked ${status.toLowerCase()}` };
  });
}

export async function convertQuote(id: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    const invoiceId = await db.$transaction(async (tx) => {
      const q = await tx.quote.findUnique({ where: { id }, include: { lines: true, customer: true } });
      if (!q) throw new UserError("Quote not found.");
      if (q.status === "CONVERTED" || q.invoiceId) throw new UserError("This quote is already invoiced.");
      const now = new Date();
      const inv = await tx.invoice.create({
        data: {
          number: draftNumber(),
          customerId: q.customerId,
          projectId: q.projectId,
          issueDate: now,
          dueDate: new Date(now.getTime() + q.customer.termsDays * 86400000),
          reference: q.reference ?? q.number,
          notes: q.notes,
          subtotal: q.subtotal,
          vatTotal: q.vatTotal,
          total: q.total,
          createdById: user.id,
          lines: {
            create: q.lines.map((l) => ({
              itemId: l.itemId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPct: l.discountPct,
              vatRate: l.vatRate,
              lineTotal: l.lineTotal,
              sortOrder: l.sortOrder,
            })),
          },
        },
      });
      await tx.quote.update({ where: { id }, data: { status: "CONVERTED", invoiceId: inv.id } });
      await audit(tx, {
        userId: user.id,
        action: "quote.convert",
        entity: "quote",
        entityId: id,
        summary: `Converted ${q.number} to a draft invoice`,
      });
      return inv.id;
    });
    refresh();
    return { ok: true, data: { id: invoiceId }, message: "Draft invoice created from quote" };
  });
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    const q = await db.quote.findUnique({ where: { id } });
    if (!q) throw new UserError("Quote not found.");
    if (q.status === "CONVERTED") throw new UserError("Invoiced quotes can't be deleted.");
    await db.$transaction(async (tx) => {
      await tx.quote.delete({ where: { id } });
      await audit(tx, {
        userId: user.id,
        action: "quote.delete",
        entity: "quote",
        entityId: id,
        summary: `Deleted ${q.number}`,
      });
    });
    refresh();
    return { ok: true, message: "Quote deleted" };
  });
}
