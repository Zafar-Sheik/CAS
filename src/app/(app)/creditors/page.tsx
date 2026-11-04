import type { Metadata } from "next";
import { Plus, Truck, Wallet, Receipt } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, FilterChips, EmptyState, ListRow, buildHref } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBox } from "@/components/ui/search-box";
import { AgingChart } from "@/components/dashboard/charts";
import { supplierBalances, agingOf } from "@/server/queries";
import { formatMoney } from "@/lib/money";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "Creditors" };

export default async function CreditorsPage(props: PageProps<"/creditors">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const filter = str(sp, "filter") ?? "owing";
  const [suppliers, balances, open] = await Promise.all([
    db.supplier.findMany({
      where: {
        active: filter !== "archived",
        ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      orderBy: { name: "asc" },
      take: 300,
    }),
    supplierBalances(),
    db.bill.findMany({ where: { status: { in: ["POSTED", "PARTIAL"] } }, select: { dueDate: true, total: true, amountPaid: true } }),
  ]);
  const total = [...balances.values()].reduce((a, b) => a + b.balance, 0);
  const rows = suppliers
    .map((s) => ({ ...s, ...(balances.get(s.id) ?? { balance: 0, overdue: 0 }) }))
    .filter((s) => (filter === "owing" ? Math.abs(s.balance) > 0.004 : true))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const writer = can(user.role, "purchases:write");

  return (
    <div>
      <PageHeader
        title="Creditors"
        description={`${formatMoney(total)} owed to suppliers`}
        actions={
          writer ? (
            <>
              <LinkButton href="/creditors/pay" variant="accent">
                <Wallet /> Pay supplier
              </LinkButton>
              <LinkButton href="/bills/new" variant="secondary">
                <Receipt /> Capture bill
              </LinkButton>
              <LinkButton href="/creditors/new" variant="secondary">
                <Plus /> Supplier
              </LinkButton>
            </>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-4 space-y-3">
            <SearchBox placeholder="Search suppliers" />
            <FilterChips
              options={[
                { value: "owing", label: "Owed" },
                { value: "all", label: "All suppliers" },
                { value: "archived", label: "Archived" },
              ]}
              active={filter}
              hrefFor={(f) => buildHref("/creditors", { q, filter: f })}
            />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Truck} title={filter === "owing" ? "You don't owe anyone" : "No suppliers"} description="Supplier balances appear here once bills are posted." />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y">
                {rows.map((s) => (
                  <ListRow
                    key={s.id}
                    href={`/creditors/${s.id}`}
                    leading={
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                        {s.name.slice(0, 2).toUpperCase()}
                      </span>
                    }
                    title={s.name}
                    subtitle={[s.code, s.contactName].filter(Boolean).join(" · ")}
                    right={formatMoney(s.balance)}
                    rightSub={s.overdue > 0 ? <Badge tone="danger">{formatMoney(s.overdue)} late</Badge> : null}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader title="Aging" description="Unpaid bills by days overdue" />
          <CardBody>
            <AgingChart data={agingOf(open)} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
