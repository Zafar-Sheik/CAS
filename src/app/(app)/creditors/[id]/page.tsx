import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Receipt, Wallet } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, DetailList } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { QuickContact } from "@/components/contacts/quick-contact";
import { ArchiveButton } from "@/components/contacts/archive-button";
import { ReversePaymentButton } from "@/components/documents/actions";
import { supplierBalances, outstanding } from "@/server/queries";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Supplier" };

export default async function SupplierPage(props: PageProps<"/creditors/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const s = await db.supplier.findUnique({
    where: { id },
    include: { bills: { orderBy: { issueDate: "desc" }, take: 50 }, payments: { orderBy: { date: "desc" }, take: 30 } },
  });
  if (!s) notFound();
  const bal = (await supplierBalances()).get(s.id) ?? { balance: 0, overdue: 0 };
  const writer = can(user.role, "purchases:write");
  return (
    <div>
      <PageHeader
        back={{ href: "/creditors", label: "Creditors" }}
        eyebrow={s.code}
        title={s.name}
        description={s.contactName ?? undefined}
        actions={
          writer ? (
            <>
              <LinkButton variant="accent" href={`/creditors/pay?supplier=${s.id}`}>
                <Wallet /> Pay
              </LinkButton>
              <LinkButton variant="secondary" href={`/bills/new?supplier=${s.id}`}>
                <Receipt /> Capture bill
              </LinkButton>
              <LinkButton variant="ghost" href={`/creditors/${s.id}/edit`}>
                <Pencil /> Edit
              </LinkButton>
              <ArchiveButton kind="supplier" id={s.id} active={s.active} />
            </>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">You owe</div>
              <div className="mt-1 text-xl font-semibold tabular">{formatMoney(bal.balance)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Overdue</div>
              <div className={`mt-1 text-xl font-semibold tabular ${bal.overdue > 0 ? "text-danger" : ""}`}>{formatMoney(bal.overdue)}</div>
            </Card>
          </div>
          <Card>
            <CardHeader title="Bills" />
            <div className="mt-2 divide-y">
              {s.bills.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No bills yet.</p>
              ) : (
                s.bills.map((b) => (
                  <Link key={b.id} href={`/bills/${b.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{b.status === "DRAFT" ? "Draft" : b.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.supplierRef ? `${b.supplierRef} · ` : ""}
                        {formatDate(b.issueDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular">{formatMoney(["POSTED", "PARTIAL"].includes(b.status) ? outstanding(b) : b.total)}</div>
                      <StatusBadge status={b.status} dueDate={b.dueDate} />
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="h-2" />
          </Card>
          <Card>
            <CardHeader title="Payments made" />
            <div className="mt-2 divide-y">
              {s.payments.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                s.payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(p.date)} · {p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    </div>
                    <div className="font-semibold tabular">{formatMoney(p.amount)}</div>
                    {can(user.role, "documents:void") ? <ReversePaymentButton id={p.id} kind="supplier" number={p.number} /> : null}
                  </div>
                ))
              )}
            </div>
            <div className="h-2" />
          </Card>
        </div>
        <div className="space-y-5">
          <QuickContact phone={s.phone} email={s.email} />
          <Card>
            <CardBody>
              <DetailList
                items={[
                  { label: "Phone", value: s.phone },
                  { label: "Email", value: s.email },
                  { label: "VAT number", value: s.vatNumber },
                  { label: "Terms", value: `${s.termsDays} days` },
                  { label: "Address", value: s.address ? <span className="whitespace-pre-line">{s.address}</span> : null },
                  { label: "Bank details", value: s.bankDetails ? <span className="whitespace-pre-line">{s.bankDetails}</span> : null },
                ]}
              />
              {s.notes ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">{s.notes}</p> : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
