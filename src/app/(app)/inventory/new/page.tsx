import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { getSettings } from "@/server/queries";
import { toNumber } from "@/lib/money";
import { PageHeader } from "@/components/ui/page";
import { ItemForm } from "@/components/inventory/item-form";

export const metadata: Metadata = { title: "New item" };

export default async function NewItemPage() {
  await requirePermission("inventory:write");
  const [s, cats] = await Promise.all([
    getSettings(),
    db.item.findMany({ distinct: ["category"], select: { category: true }, where: { category: { not: null } } }),
  ]);
  return (
    <div>
      <PageHeader title="New item" back={{ href: "/inventory", label: "Inventory" }} />
      <ItemForm categories={cats.map((c) => c.category!)} defaultVat={toNumber(s.defaultVatRate)} />
    </div>
  );
}
