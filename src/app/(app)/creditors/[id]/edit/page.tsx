import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";

export const metadata: Metadata = { title: "Edit supplier" };

export default async function EditSupplierPage(props: PageProps<"/creditors/[id]/edit">) {
  await requirePermission("purchases:write");
  const { id } = await props.params;
  const s = await db.supplier.findUnique({ where: { id } });
  if (!s) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${s.name}`} back={{ href: `/creditors/${id}`, label: "Back" }} />
      <ContactForm kind="supplier" initial={s} />
    </div>
  );
}
