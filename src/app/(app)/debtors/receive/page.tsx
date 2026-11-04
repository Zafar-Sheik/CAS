import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { outstanding } from "@/server/queries";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { PaymentForm } from "@/components/documents/payment-form";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "Receive payment" };

export default async function ReceivePage(props: PageProps<"/debtors/receive">) {
  await requirePermission("sales:write");
  const sp = await props.searchParams;
  const [customers, open] = await Promise.all([
    db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIAL"] } }, orderBy: { dueDate: "asc" } }),
  ]);
  const customerId = str(sp, "customer");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Receive payment" description="Money in from a customer" back={{ href: "/debtors", label: "Debtors" }} />
      <Card className="p-4 md:p-6">
        <PaymentForm
          kind="receipt"
          parties={customers}
          initialPartyId={customers.some((c) => c.id === customerId) ? customerId : undefined}
          openDocs={open.map((d) => ({ id: d.id, number: d.number, partyId: d.customerId, dueDate: d.dueDate.toISOString(), outstanding: outstanding(d) }))}
        />
      </Card>
    </div>
  );
}
