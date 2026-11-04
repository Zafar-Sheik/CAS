import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";

export const metadata: Metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  await requirePermission("purchases:write");
  return (
    <div>
      <PageHeader title="New supplier" back={{ href: "/creditors", label: "Creditors" }} />
      <ContactForm kind="supplier" />
    </div>
  );
}
