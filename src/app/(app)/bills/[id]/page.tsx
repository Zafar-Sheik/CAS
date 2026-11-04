import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LinesCard, SummaryCard, PaymentsCard } from "@/components/documents/document-view";
import { BillActions } from "@/components/documents/actions";
import { outstanding } from "@/server/queries";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Supplier bill" };

export default async function BillPage(props: PageProps<"/bills/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const b = await db.bill.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: { orderBy: { sortOrder: "asc" }, include: { item: { select: { sku: true, unit: true } } } },
      allocations: { include: { payment: true } },
    },
  });
  if (!b) notFound();
  const open = await db.bill.findMany({ where: { supplierId: b.supplierId, status: { in: ["POSTED", "PARTIAL"] } }, orderBy: { dueDate: "asc" } });
  return (
    <div>
      <PageHeader
        back={{ href: "/bills", label: "Bills" }}
        eyebrow="Supplier bill"
        title={
          <span className="flex items-center gap-3">
            {b.status === "DRAFT" ? "Draft bill" : b.number} <StatusBadge status={b.status} dueDate={b.dueDate} />
          </span>
        }
        description={`Captured ${formatDateTime(b.createdAt)}`}
        actions={
          <BillActions
            id={b.id}
            status={b.status}
            canWrite={can(user.role, "purchases:write")}
            canVoid={can(user.role, "documents:void")}
            hasPayments={toNumber(b.amountPaid) > 0}
            supplier={{ id: b.supplier.id, name: b.supplier.name, code: b.supplier.code }}
            openDocs={open.map((d) => ({ id: d.id, number: d.number, partyId: d.supplierId, dueDate: d.dueDate.toISOString(), outstanding: outstanding(d) }))}
          />
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="order-2 space-y-5 lg:order-1">
          <LinesCard lines={b.lines} />
          {b.notes ? (
            <Card>
              <CardBody>
                <div className="mb-1 text-sm font-semibold">Notes</div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{b.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="order-1 space-y-5 lg:order-2">
          <SummaryCard
            party={b.supplier.name}
            partyHref={`/creditors/${b.supplier.id}`}
            details={[
              { label: "Bill date", value: formatDate(b.issueDate) },
              { label: "Due date", value: formatDate(b.dueDate) },
              ...(b.supplierRef ? [{ label: "Their invoice no.", value: b.supplierRef }] : []),
              ...(b.category ? [{ label: "Category", value: b.category }] : []),
            ]}
            subtotal={b.subtotal}
            vat={b.vatTotal}
            total={b.total}
            paid={b.status === "DRAFT" ? undefined : b.amountPaid}
          />
          <PaymentsCard
            title="Payments"
            payments={b.allocations.map((a) => ({ id: a.id, number: a.payment.number, date: a.payment.date, amount: a.amount, method: a.payment.method }))}
          />
        </div>
      </div>
    </div>
  );
}
