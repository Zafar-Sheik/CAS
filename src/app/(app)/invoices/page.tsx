import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, FilterChips, EmptyState, ListRow, Pagination, buildHref } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { SearchBox } from "@/components/ui/search-box";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { str, pageNum, PAGE_SIZE } from "@/lib/params";
import type { Prisma } from "@/generated/prisma/client";
import Link from "next/link";

export const metadata: Metadata = { title: "Invoices" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Drafts" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const filter = str(sp, "status") ?? "all";
  const page = pageNum(sp);
  const today = new Date(new Date().toDateString());

  const statusWhere: Record<string, Prisma.InvoiceWhereInput> = {
    all: {},
    unpaid: { status: { in: ["ISSUED", "PARTIAL"] } },
    overdue: { status: { in: ["ISSUED", "PARTIAL"] }, dueDate: { lt: today } },
    draft: { status: "DRAFT" },
    paid: { status: "PAID" },
    void: { status: "VOID" },
  };
  const where: Prisma.InvoiceWhereInput = {
    ...(statusWhere[filter] ?? {}),
    ...(q ? { OR: [{ number: { contains: q } }, { reference: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
  };
  const [rows, count, unpaidAgg] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { customer: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.invoice.count({ where }),
    db.invoice.aggregate({ where: { status: { in: ["ISSUED", "PARTIAL"] } }, _sum: { total: true, amountPaid: true }, _count: true }),
  ]);
  const owing = toNumber(unpaidAgg._sum.total) - toNumber(unpaidAgg._sum.amountPaid);
  const href = (p: Record<string, string | undefined>) => buildHref("/invoices", { q, status: filter === "all" ? undefined : filter, ...p });

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={`${unpaidAgg._count} unpaid · ${formatMoney(owing)} owing to you`}
        actions={
          can(user.role, "sales:write") ? (
            <LinkButton href="/invoices/new" variant="primary">
              <Plus /> New invoice
            </LinkButton>
          ) : null
        }
      />
      <div className="mb-4 space-y-3">
        <SearchBox placeholder="Search number, customer or reference" />
        <FilterChips options={FILTERS} active={filter} hrefFor={(v) => href({ status: v === "all" ? undefined : v, page: undefined })} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q || filter !== "all" ? "No invoices match" : "No invoices yet"}
          description={q || filter !== "all" ? "Try a different search or filter." : "Create your first invoice to start getting paid."}
          action={can(user.role, "sales:write") ? <LinkButton href="/invoices/new"><Plus /> New invoice</LinkButton> : null}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y md:hidden">
            {rows.map((i) => (
              <ListRow
                key={i.id}
                href={`/invoices/${i.id}`}
                title={i.customer.name}
                subtitle={`${i.status === "DRAFT" ? "Draft" : i.number} · ${formatDate(i.issueDate)}`}
                right={formatMoney(i.total)}
                rightSub={<StatusBadge status={i.status} dueDate={i.dueDate} />}
              />
            ))}
          </div>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Due</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Owing</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((i) => (
                <tr key={i.id} className="group hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/invoices/${i.id}`} className="group-hover:text-accent">
                      {i.status === "DRAFT" ? "Draft" : i.number}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{i.customer.name}</div>
                    {i.project ? <div className="text-xs text-muted-foreground">{i.project.name}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(i.issueDate)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(i.dueDate)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={i.status} dueDate={i.dueDate} />
                  </td>
                  <td className="px-3 py-3 text-right tabular">{formatMoney(i.total)}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular">
                    {["ISSUED", "PARTIAL"].includes(i.status) ? formatMoney(toNumber(i.total) - toNumber(i.amountPaid)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination page={page} pageCount={Math.ceil(count / PAGE_SIZE)} hrefFor={(p) => href({ page: String(p) })} />
    </div>
  );
}
