"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import {
  customerSchema,
  supplierSchema,
  itemSchema,
  stockAdjustSchema,
  projectSchema,
  type CustomerInput,
  type SupplierInput,
  type ItemInput,
  type ProjectInput,
} from "@/lib/validation";
import { toNumber, formatQty } from "@/lib/money";
import { run, UserError, type ActionResult } from "./action";
import { z } from "zod";

const refresh = () => revalidatePath("/", "layout");

async function makeCode(
  name: string,
  exists: (code: string) => Promise<boolean>,
) {
  const base = (name.replace(/[^a-z]/gi, "").toUpperCase() + "XXX").slice(0, 3);
  for (let n = 1; n < 1000; n++) {
    const code = `${base}${String(n).padStart(3, "0")}`;
    if (!(await exists(code))) return code;
  }
  return `${base}${Date.now().toString(36).toUpperCase()}`;
}

// ── Customers ───────────────────────────────────────────────

export async function saveCustomer(input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    const { id, code, ...data } = customerSchema.parse(input);
    if (id) {
      await db.customer.update({ where: { id }, data: { ...data, ...(code ? { code } : {}) } });
      await audit(db, { userId: user.id, action: "customer.update", entity: "customer", entityId: id, summary: `Updated ${data.name}` });
      refresh();
      return { ok: true, data: { id }, message: "Customer saved" };
    }
    const finalCode =
      code ?? (await makeCode(data.name, async (c) => !!(await db.customer.findUnique({ where: { code: c } }))));
    const c = await db.customer.create({ data: { ...data, code: finalCode } });
    await audit(db, { userId: user.id, action: "customer.create", entity: "customer", entityId: c.id, summary: `Added ${data.name}` });
    refresh();
    return { ok: true, data: { id: c.id }, message: "Customer added" };
  });
}

export async function setCustomerActive(id: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("sales:write");
    const c = await db.customer.update({ where: { id }, data: { active: z.boolean().parse(active) } });
    await audit(db, { userId: user.id, action: "customer.active", entity: "customer", entityId: id, summary: `${c.name} ${active ? "re-activated" : "archived"}` });
    refresh();
    return { ok: true, message: active ? "Customer restored" : "Customer archived" };
  });
}

// ── Suppliers ───────────────────────────────────────────────

export async function saveSupplier(input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("purchases:write");
    const { id, code, ...data } = supplierSchema.parse(input);
    if (id) {
      await db.supplier.update({ where: { id }, data: { ...data, ...(code ? { code } : {}) } });
      await audit(db, { userId: user.id, action: "supplier.update", entity: "supplier", entityId: id, summary: `Updated ${data.name}` });
      refresh();
      return { ok: true, data: { id }, message: "Supplier saved" };
    }
    const finalCode =
      code ?? (await makeCode(data.name, async (c) => !!(await db.supplier.findUnique({ where: { code: c } }))));
    const s = await db.supplier.create({ data: { ...data, code: finalCode } });
    await audit(db, { userId: user.id, action: "supplier.create", entity: "supplier", entityId: s.id, summary: `Added ${data.name}` });
    refresh();
    return { ok: true, data: { id: s.id }, message: "Supplier added" };
  });
}

export async function setSupplierActive(id: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("purchases:write");
    const s = await db.supplier.update({ where: { id }, data: { active: z.boolean().parse(active) } });
    await audit(db, { userId: user.id, action: "supplier.active", entity: "supplier", entityId: id, summary: `${s.name} ${active ? "re-activated" : "archived"}` });
    refresh();
    return { ok: true, message: active ? "Supplier restored" : "Supplier archived" };
  });
}

// ── Items & stock ───────────────────────────────────────────

export async function saveItem(input: ItemInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("inventory:write");
    const { id, openingQty, ...data } = itemSchema.parse(input);
    if (id) {
      await db.item.update({ where: { id }, data });
      await audit(db, { userId: user.id, action: "item.update", entity: "item", entityId: id, summary: `Updated ${data.sku} ${data.name}` });
      refresh();
      return { ok: true, data: { id }, message: "Item saved" };
    }
    const item = await db.$transaction(async (tx) => {
      const qty = data.type === "STOCK" ? (openingQty ?? 0) : 0;
      const item = await tx.item.create({ data: { ...data, qtyOnHand: qty } });
      if (qty > 0) {
        await tx.stockMovement.create({
          data: { itemId: item.id, type: "OPENING", quantity: qty, unitCost: data.costPrice, balance: qty, note: "Opening balance", userId: user.id },
        });
      }
      await audit(tx, { userId: user.id, action: "item.create", entity: "item", entityId: item.id, summary: `Added ${data.sku} ${data.name}` });
      return item;
    });
    refresh();
    return { ok: true, data: { id: item.id }, message: "Item added" };
  });
}

export async function adjustStock(input: z.input<typeof stockAdjustSchema>): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("inventory:write");
    const data = stockAdjustSchema.parse(input);
    await db.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: data.itemId } });
      if (!item) throw new UserError("Item not found.");
      if (item.type !== "STOCK") throw new UserError("Services don't carry stock.");
      const current = toNumber(item.qtyOnHand);
      const delta =
        data.mode === "add" ? data.quantity : data.mode === "remove" ? -data.quantity : data.quantity - current;
      if (delta === 0) throw new UserError("Nothing to change.");
      const updated = await tx.item.update({ where: { id: item.id }, data: { qtyOnHand: { increment: delta } } });
      if (toNumber(updated.qtyOnHand) < 0) throw new UserError("Stock can't go below zero.");
      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          type: "ADJUSTMENT",
          quantity: delta,
          unitCost: data.unitCost ?? item.costPrice,
          balance: updated.qtyOnHand,
          note: data.note,
          userId: user.id,
        },
      });
      await audit(tx, {
        userId: user.id,
        action: "stock.adjust",
        entity: "item",
        entityId: item.id,
        summary: `${item.sku}: ${delta > 0 ? "+" : ""}${formatQty(delta)} (${data.note})`,
      });
    });
    refresh();
    return { ok: true, message: "Stock updated" };
  });
}

export async function setItemActive(id: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("inventory:write");
    const i = await db.item.update({ where: { id }, data: { active: z.boolean().parse(active) } });
    await audit(db, { userId: user.id, action: "item.active", entity: "item", entityId: id, summary: `${i.sku} ${active ? "re-activated" : "archived"}` });
    refresh();
    return { ok: true, message: active ? "Item restored" : "Item archived" };
  });
}

// ── Projects ────────────────────────────────────────────────

export async function saveProject(input: ProjectInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await assertPermission("projects:write");
    const { id, code, ...data } = projectSchema.parse(input);
    if (id) {
      await db.project.update({ where: { id }, data: { ...data, ...(code ? { code } : {}) } });
      await audit(db, { userId: user.id, action: "project.update", entity: "project", entityId: id, summary: `Updated ${data.name}` });
      refresh();
      return { ok: true, data: { id }, message: "Project saved" };
    }
    const year = new Date().getFullYear().toString().slice(2);
    const count = await db.project.count();
    let finalCode = code ?? `P${year}-${String(count + 1).padStart(3, "0")}`;
    while (!code && (await db.project.findUnique({ where: { code: finalCode } }))) {
      finalCode = `P${year}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }
    const p = await db.project.create({ data: { ...data, code: finalCode } });
    await audit(db, { userId: user.id, action: "project.create", entity: "project", entityId: p.id, summary: `Created ${data.name}` });
    refresh();
    return { ok: true, data: { id: p.id }, message: "Project created" };
  });
}

export async function setProjectStage(
  id: string,
  stage: "DISCOVERY" | "CONCEPT" | "DEVELOPMENT" | "DELIVERY" | "COMPLETE",
): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("projects:write");
    const s = z.enum(["DISCOVERY", "CONCEPT", "DEVELOPMENT", "DELIVERY", "COMPLETE"]).parse(stage);
    const p = await db.project.update({
      where: { id },
      data: { stage: s, ...(s === "COMPLETE" ? { status: "COMPLETE" } : {}) },
    });
    await audit(db, { userId: user.id, action: "project.stage", entity: "project", entityId: id, summary: `${p.name} moved to ${s.toLowerCase()}` });
    refresh();
    return { ok: true, message: "Stage updated" };
  });
}
