import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/server/queries";
import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  await requirePermission("sales:write");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="New customer" back={{ href: "/debtors", label: "Debtors" }} />
      <ContactForm kind="customer" initial={{ termsDays: s.paymentTermDays }} />
    </div>
  );
}
