import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, FileSignature, Pencil } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, DetailList } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { StageStepper } from "@/components/projects/stage-stepper";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      customer: true,
      invoices: { orderBy: { issueDate: "desc" } },
      quotes: { orderBy: { issueDate: "desc" } },
    },
  });
  if (!p) notFound();
  const live = p.invoices.filter((i) => ["ISSUED", "PARTIAL", "PAID"].includes(i.status));
  const billed = live.reduce((a, i) => a + toNumber(i.subtotal), 0);
  const received = live.reduce((a, i) => a + toNumber(i.amountPaid), 0);
  const fee = toNumber(p.feeValue);
  const writer = can(user.role, "projects:write");
  const sales = can(user.role, "sales:write");

  return (
    <div>
      <PageHeader
        back={{ href: "/projects", label: "Projects" }}
        eyebrow={p.code}
        title={
          <span className="flex items-center gap-3">
            {p.name} <StatusBadge status={p.status} />
          </span>
        }
        description={
          <Link href={`/debtors/${p.customer.id}`} className="hover:text-accent">
            {p.customer.name}
          </Link>
        }
        actions={
          <>
            {sales ? (
              <>
                <LinkButton variant="accent" href={`/invoices/new?customer=${p.customerId}&project=${p.id}`}>
                  <FileText /> Invoice stage
                </LinkButton>
                <LinkButton variant="secondary" href={`/quotes/new?customer=${p.customerId}&project=${p.id}`}>
                  <FileSignature /> Quote
                </LinkButton>
              </>
            ) : null}
            {writer ? (
              <LinkButton variant="ghost" href={`/projects/${p.id}/edit`}>
                <Pencil /> Edit
              </LinkButton>
            ) : null}
          </>
        }
      />
      <div className="mb-5">
        <StageStepper id={p.id} stage={p.stage} editable={writer} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Fee", value: fee },
              { label: "Billed", value: billed },
              { label: "Received", value: received },
            ].map((s) => (
              <Card key={s.label} className="p-3.5 md:p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-1 truncate font-semibold tabular md:text-xl">{formatMoney(s.value)}</div>
              </Card>
            ))}
          </div>
          {fee > 0 ? (
            <Card className="p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium">Fee billed</span>
                <span className="tabular text-muted-foreground">{Math.min(100, (billed / fee) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (billed / fee) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{formatMoney(Math.max(0, fee - billed))} still to bill (excl. VAT)</p>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Invoices" />
            <div className="mt-2 divide-y">
              {p.invoices.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Nothing billed yet.</p>
              ) : (
                p.invoices.map((i) => (
                  <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{i.status === "DRAFT" ? "Draft" : i.number}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(i.issueDate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular">{formatMoney(i.total)}</div>
                      <StatusBadge status={i.status} dueDate={i.dueDate} />
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="h-2" />
          </Card>
          {p.quotes.length ? (
            <Card>
              <CardHeader title="Quotes" />
              <div className="mt-2 divide-y">
                {p.quotes.map((q) => (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{q.number}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(q.issueDate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular">{formatMoney(q.total)}</div>
                      <StatusBadge status={q.status} />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="h-2" />
            </Card>
          ) : null}
        </div>
        <Card className="h-fit">
          <CardBody>
            <DetailList
              items={[
                { label: "Sector", value: p.sector },
                { label: "Location", value: p.location },
                { label: "Size", value: p.sizeM2 ? `${p.sizeM2} m²` : null },
                { label: "Started", value: p.startDate ? formatDate(p.startDate) : null },
              ]}
            />
            {p.notes ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">{p.notes}</p> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
