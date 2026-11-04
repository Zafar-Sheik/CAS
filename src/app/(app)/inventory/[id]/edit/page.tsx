import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { PageHeader } from "@/components/ui/page";
import { ItemForm } from "@/components/inventory/item-form";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage(props: PageProps<"/inventory/[id]/edit">) {
  await requirePermission("inventory:write");
  const { id } = await props.params;
  const [i, cats] = await Promise.all([
    db.item.findUnique({ where: { id } }),
    db.item.findMany({ distinct: ["category"], select: { category: true }, where: { category: { not: null } } }),
  ]);
  if (!i) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${i.name}`} back={{ href: `/inventory/${id}`, label: "Back" }} />
      <ItemForm
        categories={cats.map((c) => c.category!)}
        defaultVat={toNumber(i.vatRate)}
        initial={{
          ...i,
          costPrice: toNumber(i.costPrice),
          sellPrice: toNumber(i.sellPrice),
          vatRate: toNumber(i.vatRate),
          reorderLevel: toNumber(i.reorderLevel),
        }}
      />
    </div>
  );
}
