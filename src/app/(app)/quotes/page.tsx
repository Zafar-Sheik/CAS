import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, FilterChips, EmptyState, ListRow, Pagination, buildHref } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { SearchBox } from "@/components/ui/search-box";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { str, pageNum, PAGE_SIZE } from "@/lib/params";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Quotes" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "CONVERTED", label: "Invoiced" },
  { value: "DECLINED", label: "Declined" },
];

export default async function QuotesPage(props: PageProps<"/quotes">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const filter = str(sp, "status") ?? "all";
  const page = pageNum(sp);
  const where: Prisma.QuoteWhereInput = {
    ...(filter !== "all" && FILTERS.some((f) => f.value === filter) ? { status: filter as Prisma.QuoteWhereInput["status"] } : {}),
    ...(q ? { OR: [{ number: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
  };
  const [rows, count] = await Promise.all([
    db.quote.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.quote.count({ where }),
  ]);
  const href = (p: Record<string, string | undefined>) => buildHref("/quotes", { q, status: filter === "all" ? undefined : filter, ...p });

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Price the job, then convert to an invoice in one tap."
        actions={can(user.role, "sales:write") ? <LinkButton href="/quotes/new"><Plus /> New quote</LinkButton> : null}
      />
      <div className="mb-4 space-y-3">
        <SearchBox placeholder="Search number or customer" />
        <FilterChips options={FILTERS} active={filter} hrefFor={(v) => href({ status: v === "all" ? undefined : v, page: undefined })} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={FileSignature} title="No quotes here" description="Quotes you create appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y md:hidden">
            {rows.map((r) => (
              <ListRow
                key={r.id}
                href={`/quotes/${r.id}`}
                title={r.customer.name}
                subtitle={`${r.number} · valid to ${formatDate(r.expiryDate)}`}
                right={formatMoney(r.total)}
                rightSub={<StatusBadge status={r.status} />}
              />
            ))}
          </div>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Valid until</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="group hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/quotes/${r.id}`} className="group-hover:text-accent">{r.number}</Link>
                  </td>
                  <td className="px-3 py-3">{r.customer.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(r.issueDate)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(r.expiryDate)}</td>
                  <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3 text-right font-semibold tabular">{formatMoney(r.total)}</td>
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
