import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LinesCard, SummaryCard } from "@/components/documents/document-view";
import { QuoteActions, InlineLink } from "@/components/documents/actions";
import { getSettings } from "@/server/queries";
import { shareTextFor } from "@/server/share";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Quote" };

export default async function QuotePage(props: PageProps<"/quotes/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const [q, settings] = await Promise.all([
    db.quote.findUnique({
      where: { id },
      include: {
        customer: true,
        project: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: "asc" }, include: { item: { select: { sku: true, unit: true } } } },
      },
    }),
    getSettings(),
  ]);
  if (!q) notFound();
  const expired = q.expiryDate < new Date() && ["DRAFT", "SENT"].includes(q.status);
  return (
    <div>
      <PageHeader
        back={{ href: "/quotes", label: "Quotes" }}
        eyebrow="Quotation"
        title={
          <span className="flex items-center gap-3">
            {q.number} <StatusBadge status={q.status} />
          </span>
        }
        description={expired ? <span className="font-medium text-warning">Expired {formatDate(q.expiryDate)}</span> : undefined}
        actions={
          <QuoteActions
            id={q.id}
            status={q.status}
            canWrite={can(user.role, "sales:write")}
            invoiceId={q.invoiceId}
            title={`Quote ${q.number}`}
            shareText={shareTextFor({ kind: "Quote", number: q.number, total: q.total, date: q.expiryDate, dueLabel: "Valid until" }, settings)}
          />
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="order-2 space-y-5 lg:order-1">
          <LinesCard lines={q.lines} />
          {q.notes ? (
            <Card>
              <CardBody>
                <div className="mb-1 text-sm font-semibold">Notes</div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{q.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="order-1 lg:order-2">
          <SummaryCard
            party={q.customer.name}
            partyHref={`/debtors/${q.customer.id}`}
            details={[
              { label: "Quote date", value: formatDate(q.issueDate) },
              { label: "Valid until", value: formatDate(q.expiryDate) },
              ...(q.reference ? [{ label: "Reference", value: q.reference }] : []),
              ...(q.project ? [{ label: "Project", value: <InlineLink href={`/projects/${q.project.id}`}>{q.project.name}</InlineLink> }] : []),
            ]}
            subtotal={q.subtotal}
            vat={q.vatTotal}
            total={q.total}
          />
        </div>
      </div>
    </div>
  );
}
