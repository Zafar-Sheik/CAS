import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage(props: PageProps<"/debtors/[id]/edit">) {
  await requirePermission("sales:write");
  const { id } = await props.params;
  const c = await db.customer.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${c.name}`} back={{ href: `/debtors/${id}`, label: "Back" }} />
      <ContactForm kind="customer" initial={{ ...c, creditLimit: toNumber(c.creditLimit) }} />
    </div>
  );
}
