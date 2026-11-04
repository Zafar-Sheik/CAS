import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, HandCoins, Pencil, Printer, FileSignature } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, DetailList } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { QuickContact } from "@/components/contacts/quick-contact";
import { ArchiveButton } from "@/components/contacts/archive-button";
import { ReversePaymentButton } from "@/components/documents/actions";
import { agingOf, customerBalances, outstanding } from "@/server/queries";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage(props: PageProps<"/debtors/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      invoices: { orderBy: { issueDate: "desc" }, take: 50 },
      receipts: { orderBy: { date: "desc" }, take: 30, include: { allocations: true } },
      projects: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();
  const bal = (await customerBalances()).get(c.id) ?? { balance: 0, overdue: 0 };
  const open = c.invoices.filter((i) => ["ISSUED", "PARTIAL"].includes(i.status));
  const aging = agingOf(open);
  const writer = can(user.role, "sales:write");
  const limit = toNumber(c.creditLimit);

  return (
    <div>
      <PageHeader
        back={{ href: "/debtors", label: "Debtors" }}
        eyebrow={c.code}
        title={c.name}
        description={c.contactName ?? undefined}
        actions={
          <>
            {writer ? (
              <>
                <LinkButton variant="accent" href={`/debtors/receive?customer=${c.id}`}>
                  <HandCoins /> Receive payment
                </LinkButton>
                <LinkButton variant="secondary" href={`/invoices/new?customer=${c.id}`}>
                  <FileText /> Invoice
                </LinkButton>
                <LinkButton variant="secondary" href={`/quotes/new?customer=${c.id}`}>
                  <FileSignature /> Quote
                </LinkButton>
              </>
            ) : null}
            <LinkButton variant="secondary" href={`/print/statement/${c.id}`} target="_blank">
              <Printer /> Statement
            </LinkButton>
            {writer ? (
              <>
                <LinkButton variant="ghost" href={`/debtors/${c.id}/edit`}>
                  <Pencil /> Edit
                </LinkButton>
                <ArchiveButton kind="customer" id={c.id} active={c.active} />
              </>
            ) : null}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="mt-1 text-xl font-semibold tabular">{formatMoney(bal.balance)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Overdue</div>
              <div className={`mt-1 text-xl font-semibold tabular ${bal.overdue > 0 ? "text-danger" : ""}`}>{formatMoney(bal.overdue)}</div>
            </Card>
            <Card className="col-span-2 p-4 sm:col-span-1">
              <div className="text-xs text-muted-foreground">Credit limit</div>
              <div className="mt-1 flex items-center gap-2 text-xl font-semibold tabular">
                {limit ? formatMoney(limit) : "None"}
                {limit && bal.balance > limit ? <Badge tone="warning">Over</Badge> : null}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Invoices" description={`${open.length} open`} />
            <div className="mt-2 divide-y">
              {c.invoices.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                c.invoices.map((i) => (
                  <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{i.status === "DRAFT" ? "Draft" : i.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(i.issueDate)} · due {formatDate(i.dueDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular">{formatMoney(["ISSUED", "PARTIAL"].includes(i.status) ? outstanding(i) : i.total)}</div>
                      <StatusBadge status={i.status} dueDate={i.dueDate} />
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="h-2" />
          </Card>

          <Card>
            <CardHeader title="Payments received" />
            <div className="mt-2 divide-y">
              {c.receipts.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                c.receipts.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{r.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(r.date)} · {r.method}
                        {r.reference ? ` · ${r.reference}` : ""}
                      </div>
                    </div>
                    <div className="font-semibold text-success tabular">{formatMoney(r.amount)}</div>
                    {can(user.role, "documents:void") ? <ReversePaymentButton id={r.id} kind="receipt" number={r.number} /> : null}
                  </div>
                ))
              )}
            </div>
            <div className="h-2" />
          </Card>
        </div>

        <div className="space-y-5">
          <QuickContact phone={c.phone} email={c.email} />
          <Card>
            <CardBody>
              <DetailList
                items={[
                  { label: "Phone", value: c.phone },
                  { label: "Email", value: c.email },
                  { label: "VAT number", value: c.vatNumber },
                  { label: "Terms", value: `${c.termsDays} days` },
                  { label: "Address", value: c.address ? <span className="whitespace-pre-line">{c.address}</span> : null },
                  { label: "Status", value: c.active ? "Active" : "Archived" },
                ]}
              />
              {c.notes ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">{c.notes}</p> : null}
            </CardBody>
          </Card>
          {open.length ? (
            <Card>
              <CardHeader title="Aging" />
              <CardBody>
                <DetailList items={aging.map((a) => ({ label: `${a.bucket} days`, value: formatMoney(a.amount) }))} />
              </CardBody>
            </Card>
          ) : null}
          {c.projects.length ? (
            <Card>
              <CardHeader title="Projects" />
              <div className="mt-2 divide-y">
                {c.projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/50">
                    <span className="font-medium">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
              <div className="h-2" />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
