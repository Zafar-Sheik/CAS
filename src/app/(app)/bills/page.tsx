import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
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

export const metadata: Metadata = { title: "Supplier bills" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Drafts" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export default async function BillsPage(props: PageProps<"/bills">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const filter = str(sp, "status") ?? "all";
  const page = pageNum(sp);
  const today = new Date(new Date().toDateString());
  const statusWhere: Record<string, Prisma.BillWhereInput> = {
    all: {},
    unpaid: { status: { in: ["POSTED", "PARTIAL"] } },
    overdue: { status: { in: ["POSTED", "PARTIAL"] }, dueDate: { lt: today } },
    draft: { status: "DRAFT" },
    paid: { status: "PAID" },
    void: { status: "VOID" },
  };
  const where: Prisma.BillWhereInput = {
    ...(statusWhere[filter] ?? {}),
    ...(q ? { OR: [{ number: { contains: q } }, { supplierRef: { contains: q } }, { supplier: { name: { contains: q } } }] } : {}),
  };
  const [rows, count] = await Promise.all([
    db.bill.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.bill.count({ where }),
  ]);
  const href = (p: Record<string, string | undefined>) => buildHref("/bills", { q, status: filter === "all" ? undefined : filter, ...p });
  return (
    <div>
      <PageHeader
        title="Supplier bills"
        description="Invoices you've received. Posting a bill adds stock and updates creditors."
        actions={can(user.role, "purchases:write") ? <LinkButton href="/bills/new"><Plus /> Capture bill</LinkButton> : null}
      />
      <div className="mb-4 space-y-3">
        <SearchBox placeholder="Search number, supplier or their ref." />
        <FilterChips options={FILTERS} active={filter} hrefFor={(v) => href({ status: v === "all" ? undefined : v, page: undefined })} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No bills here" description="Capture supplier invoices to track what you owe." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y md:hidden">
            {rows.map((b) => (
              <ListRow
                key={b.id}
                href={`/bills/${b.id}`}
                title={b.supplier.name}
                subtitle={`${b.status === "DRAFT" ? "Draft" : b.number}${b.supplierRef ? ` · ${b.supplierRef}` : ""}`}
                right={formatMoney(b.total)}
                rightSub={<StatusBadge status={b.status} dueDate={b.dueDate} />}
              />
            ))}
          </div>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-3 py-3 font-medium">Supplier</th>
                <th className="px-3 py-3 font-medium">Their ref.</th>
                <th className="px-3 py-3 font-medium">Due</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Owing</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((b) => (
                <tr key={b.id} className="group hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/bills/${b.id}`} className="group-hover:text-accent">{b.status === "DRAFT" ? "Draft" : b.number}</Link>
                  </td>
                  <td className="px-3 py-3">{b.supplier.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{b.supplierRef ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(b.dueDate)}</td>
                  <td className="px-3 py-3"><StatusBadge status={b.status} dueDate={b.dueDate} /></td>
                  <td className="px-3 py-3 text-right tabular">{formatMoney(b.total)}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular">
                    {["POSTED", "PARTIAL"].includes(b.status) ? formatMoney(toNumber(b.total) - toNumber(b.amountPaid)) : "—"}
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
