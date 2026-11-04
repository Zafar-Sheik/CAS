import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { outstanding } from "@/server/queries";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { PaymentForm } from "@/components/documents/payment-form";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "Pay supplier" };

export default async function PaySupplierPage(props: PageProps<"/creditors/pay">) {
  await requirePermission("purchases:write");
  const sp = await props.searchParams;
  const [suppliers, open] = await Promise.all([
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.bill.findMany({ where: { status: { in: ["POSTED", "PARTIAL"] } }, orderBy: { dueDate: "asc" } }),
  ]);
  const supplierId = str(sp, "supplier");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Pay supplier" description="Money out to a creditor" back={{ href: "/creditors", label: "Creditors" }} />
      <Card className="p-4 md:p-6">
        <PaymentForm
          kind="supplier"
          parties={suppliers}
          initialPartyId={suppliers.some((s) => s.id === supplierId) ? supplierId : undefined}
          openDocs={open.map((d) => ({ id: d.id, number: d.number, partyId: d.supplierId, dueDate: d.dueDate.toISOString(), outstanding: outstanding(d) }))}
        />
      </Card>
    </div>
  );
}
