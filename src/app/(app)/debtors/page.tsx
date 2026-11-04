import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users, HandCoins } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, FilterChips, EmptyState, ListRow, buildHref } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBox } from "@/components/ui/search-box";
import { AgingChart } from "@/components/dashboard/charts";
import { customerBalances, agingOf } from "@/server/queries";
import { formatMoney, toNumber } from "@/lib/money";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "Debtors" };

export default async function DebtorsPage(props: PageProps<"/debtors">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const filter = str(sp, "filter") ?? "owing";
  const [customers, balances, openInvoices] = await Promise.all([
    db.customer.findMany({
      where: {
        active: filter !== "archived",
        ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { contactName: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      orderBy: { name: "asc" },
      take: 300,
    }),
    customerBalances(),
    db.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIAL"] } }, select: { dueDate: true, total: true, amountPaid: true } }),
  ]);
  const aging = agingOf(openInvoices);
  const total = [...balances.values()].reduce((a, b) => a + b.balance, 0);
  const rows = customers
    .map((c) => ({ ...c, ...(balances.get(c.id) ?? { balance: 0, overdue: 0 }) }))
    .filter((c) => (filter === "owing" ? Math.abs(c.balance) > 0.004 : true))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const href = (f: string) => buildHref("/debtors", { q, filter: f });

  return (
    <div>
      <PageHeader
        title="Debtors"
        description={`${formatMoney(total)} owed to the studio`}
        actions={
          can(user.role, "sales:write") ? (
            <>
              <LinkButton href="/debtors/receive" variant="accent">
                <HandCoins /> Receive payment
              </LinkButton>
              <LinkButton href="/debtors/new" variant="secondary">
                <Plus /> Customer
              </LinkButton>
            </>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-4 space-y-3">
            <SearchBox placeholder="Search customers" />
            <FilterChips
              options={[
                { value: "owing", label: "Owing" },
                { value: "all", label: "All customers" },
                { value: "archived", label: "Archived" },
              ]}
              active={filter}
              hrefFor={href}
            />
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filter === "owing" ? "Nobody owes you money" : "No customers"}
              description={filter === "owing" ? "Every invoice is paid up." : "Add a customer to start invoicing."}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y">
                {rows.map((c) => {
                  const limit = toNumber(c.creditLimit);
                  return (
                    <ListRow
                      key={c.id}
                      href={`/debtors/${c.id}`}
                      leading={
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                          {c.name.replace(/^(Mr|Mrs|Ms|Dr)\.?\s+/i, "").slice(0, 2).toUpperCase()}
                        </span>
                      }
                      title={c.name}
                      subtitle={[c.code, c.contactName].filter(Boolean).join(" · ")}
                      right={formatMoney(c.balance)}
                      rightSub={
                        c.overdue > 0 ? (
                          <Badge tone="danger">{formatMoney(c.overdue)} late</Badge>
                        ) : limit > 0 && c.balance > limit ? (
                          <Badge tone="warning">Over limit</Badge>
                        ) : c.balance < 0 ? (
                          <Badge tone="info">In credit</Badge>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Aging" description="Unpaid invoices by days overdue" />
            <CardBody>
              <AgingChart data={aging} />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-sm text-muted-foreground">
              Tip: open a customer to send a statement, call or WhatsApp them in one tap. <Link className="font-medium text-accent" href="/reports">See reports</Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
