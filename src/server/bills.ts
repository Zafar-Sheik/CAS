"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { billSchema, type BillInput } from "@/lib/validation";
import { toNumber, formatMoney, lineNetCents } from "@/lib/money";
import { run, UserError, type ActionResult } from "./action";
import { buildLines, draftNumber } from "./documents";
import { z } from "zod";

const refresh = () => revalidatePath("/", "layout");

export async function saveBill(input: BillInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("purchases:write");
    const data = billSchema.parse(input);
    if (data.dueDate < data.issueDate) throw new UserError("The due date can't be before the bill date.");
    const { rows, ...totals } = buildLines(data.lines);
    const fields = {
      supplierId: data.supplierId,
      supplierRef: data.supplierRef,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      category: data.category,
      notes: data.notes,
      ...totals,
    };
    const id = await db.$transaction(async (tx) => {
      if (data.id) {
        const existing = await tx.bill.findUnique({ where: { id: data.id } });
        if (!existing) throw new UserError("Bill not found.");
        if (existing.status !== "DRAFT") throw new UserError("Only draft bills can be edited.");
        await tx.billLine.deleteMany({ where: { billId: data.id } });
        await tx.bill.update({ where: { id: data.id }, data: { ...fields, lines: { create: rows } } });
        await audit(tx, {
          userId: user.id,
          action: "bill.update",
          entity: "bill",
          entityId: data.id,
          summary: `Updated draft bill (${formatMoney(totals.total)})`,
        });
        return data.id;
      }
      const bill = await tx.bill.create({
        data: { ...fields, number: draftNumber(), createdById: user.id, lines: { create: rows } },
      });
      await audit(tx, {
        userId: user.id,
        action: "bill.create",
        entity: "bill",
        entityId: bill.id,
        summary: `Captured supplier bill (${formatMoney(totals.total)})`,
      });
      return bill.id;
    });
    refresh();
    return { ok: true, data: { id }, message: "Bill saved" };
  });
}

/** Posting a bill puts it in creditors and receives any stock lines at weighted-average cost. */
export async function postBill(id: string): Promise<ActionResult<{ number: string }>> {
  return run(async () => {
    const user = await assertPermission("purchases:write");
    z.string().min(1).parse(id);
    const number = await db.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({ where: { id }, include: { lines: { include: { item: true } } } });
      if (!bill) throw new UserError("Bill not found.");
      if (bill.status !== "DRAFT") throw new UserError("This bill is already posted.");
      const number = await nextNumber(tx, "nextBillNo");
      for (const line of bill.lines) {
        if (!line.item || line.item.type !== "STOCK") continue;
        const qty = toNumber(line.quantity);
        const unitCost =
          qty !== 0
            ? lineNetCents({
                quantity: qty,
                unitPrice: toNumber(line.unitPrice),
                discountPct: toNumber(line.discountPct),
                vatRate: 0,
              }) /
              100 /
              qty
            : 0;
        const oldQty = Math.max(0, toNumber(line.item.qtyOnHand));
        const oldCost = toNumber(line.item.costPrice);
        const newCost =
          qty > 0 && oldQty + qty > 0 ? (oldQty * oldCost + qty * unitCost) / (oldQty + qty) : oldCost;
        const updated = await tx.item.update({
          where: { id: line.item.id },
          data: { qtyOnHand: { increment: qty }, costPrice: Math.round(newCost * 100) / 100 },
        });
        await tx.stockMovement.create({
          data: {
            itemId: line.item.id,
            type: qty >= 0 ? "PURCHASE" : "RETURN_OUT",
            quantity: qty,
            unitCost: Math.round(unitCost * 100) / 100,
            balance: updated.qtyOnHand,
            reference: number,
            userId: user.id,
          },
        });
      }
      await tx.bill.update({ where: { id }, data: { number, status: "POSTED", postedAt: new Date() } });
      await audit(tx, {
        userId: user.id,
        action: "bill.post",
        entity: "bill",
        entityId: id,
        summary: `Posted ${number} for ${formatMoney(bill.total)}`,
      });
      return number;
    });
    refresh();
    return { ok: true, data: { number }, message: `Bill ${number} posted` };
  });
}

export async function voidBill(id: string, reason: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("documents:void");
    const why = z.string().trim().min(3, "Give a reason").max(500).parse(reason);
    await db.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({ where: { id }, include: { lines: { include: { item: true } } } });
      if (!bill) throw new UserError("Bill not found.");
      if (bill.status === "DRAFT") throw new UserError("Delete the draft instead.");
      if (bill.status === "VOID") throw new UserError("Already void.");
      if (toNumber(bill.amountPaid) > 0) throw new UserError("This bill has payments. Reverse them first.");
      for (const line of bill.lines) {
        if (!line.item || line.item.type !== "STOCK") continue;
        const qty = toNumber(line.quantity);
        const updated = await tx.item.update({
          where: { id: line.item.id },
          data: { qtyOnHand: { decrement: qty } },
        });
        await tx.stockMovement.create({
          data: {
            itemId: line.item.id,
            type: "VOID_REVERSAL",
            quantity: -qty,
            unitCost: line.unitPrice,
            balance: updated.qtyOnHand,
            reference: bill.number,
            note: "Bill voided",
            userId: user.id,
          },
        });
      }
      await tx.bill.update({ where: { id }, data: { status: "VOID", voidedAt: new Date() } });
      await audit(tx, {
        userId: user.id,
        action: "bill.void",
        entity: "bill",
        entityId: id,
        summary: `Voided ${bill.number}: ${why}`,
      });
    });
    refresh();
    return { ok: true, message: "Bill voided" };
  });
}

export async function deleteDraftBill(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("purchases:write");
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) throw new UserError("Bill not found.");
    if (bill.status !== "DRAFT") throw new UserError("Only drafts can be deleted. Void it instead.");
    await db.$transaction(async (tx) => {
      await tx.bill.delete({ where: { id } });
      await audit(tx, { userId: user.id, action: "bill.delete", entity: "bill", entityId: id, summary: "Deleted draft bill" });
    });
    refresh();
    return { ok: true, message: "Draft deleted" };
  });
}
