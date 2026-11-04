import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LinesCard, SummaryCard, PaymentsCard } from "@/components/documents/document-view";
import { InvoiceActions, InlineLink } from "@/components/documents/actions";
import { outstanding, getSettings } from "@/server/queries";
import { shareTextFor } from "@/server/share";
import { formatDate, formatDateTime, daysBetween } from "@/lib/utils";
import { toNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage(props: PageProps<"/invoices/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const [inv, settings] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        project: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: "asc" }, include: { item: { select: { sku: true, unit: true } } } },
        allocations: { include: { receipt: true } },
      },
    }),
    getSettings(),
  ]);
  if (!inv) notFound();
  const open = await db.invoice.findMany({
    where: { customerId: inv.customerId, status: { in: ["ISSUED", "PARTIAL"] } },
    orderBy: { dueDate: "asc" },
  });
  const isDraft = inv.status === "DRAFT";
  const balance = outstanding(inv);
  const late = ["ISSUED", "PARTIAL"].includes(inv.status) ? daysBetween(inv.dueDate, new Date()) : 0;

  return (
    <div>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        eyebrow="Tax invoice"
        title={
          <span className="flex items-center gap-3">
            {isDraft ? "Draft invoice" : inv.number}
            <StatusBadge status={inv.status} dueDate={inv.dueDate} />
          </span>
        }
        description={
          late > 0 ? <span className="font-medium text-danger">{late} days overdue</span> : `Created ${formatDateTime(inv.createdAt)}`
        }
        actions={
          <InvoiceActions
            id={inv.id}
            status={inv.status}
            canWrite={can(user.role, "sales:write")}
            canVoid={can(user.role, "documents:void")}
            hasPayments={toNumber(inv.amountPaid) > 0}
            title={`Invoice ${inv.number}`}
            shareText={shareTextFor(
              { kind: "Invoice", number: inv.number, total: inv.total, balance, date: inv.dueDate, dueLabel: "Due" },
              settings,
            )}
            customer={{ id: inv.customer.id, name: inv.customer.name, code: inv.customer.code }}
            openDocs={open.map((d) => ({
              id: d.id,
              number: d.number,
              partyId: d.customerId,
              dueDate: d.dueDate.toISOString(),
              outstanding: outstanding(d),
            }))}
          />
        }
      />
      {inv.status === "VOID" ? (
        <div className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          Voided {formatDateTime(inv.voidedAt)}: {inv.voidReason}
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="order-2 space-y-5 lg:order-1">
          <LinesCard lines={inv.lines} />
          {inv.notes ? (
            <Card>
              <CardBody>
                <div className="mb-1 text-sm font-semibold">Notes</div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{inv.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="order-1 space-y-5 lg:order-2">
          <SummaryCard
            party={inv.customer.name}
            partyHref={`/debtors/${inv.customer.id}`}
            details={[
              { label: "Invoice date", value: formatDate(inv.issueDate) },
              { label: "Due date", value: formatDate(inv.dueDate) },
              ...(inv.reference ? [{ label: "Reference", value: inv.reference }] : []),
              ...(inv.project ? [{ label: "Project", value: <InlineLink href={`/projects/${inv.project.id}`}>{inv.project.name}</InlineLink> }] : []),
            ]}
            subtotal={inv.subtotal}
            vat={inv.vatTotal}
            total={inv.total}
            paid={isDraft ? undefined : inv.amountPaid}
          />
          <PaymentsCard
            title="Payments"
            payments={inv.allocations.map((a) => ({
              id: a.id,
              number: a.receipt.number,
              date: a.receipt.date,
              amount: a.amount,
              method: a.receipt.method,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
