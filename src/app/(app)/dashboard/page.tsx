import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  HandCoins,
  PackagePlus,
  Receipt,
  PackageX,
  CalendarClock,
  Activity,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { getDashboard } from "@/server/queries";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { CashflowChart, AgingChart } from "@/components/dashboard/charts";
import { HoverGrid } from "@/components/aceternity/hover-grid";
import { MovingBorderLink } from "@/components/aceternity/moving-border";
import { TextGenerate } from "@/components/aceternity/text-generate";
import { GridBackground } from "@/components/aceternity/grid-background";
import { formatMoney, formatQty } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const STAGE_LABEL: Record<string, string> = {
  DISCOVERY: "Discovery",
  CONCEPT: "Concept",
  DEVELOPMENT: "Development",
  DELIVERY: "Delivery",
};

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hour12: false, timeZone: "Africa/Johannesburg" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const denied = (await props.searchParams).denied === "1";
  const user = await requireUser();
  const d = await getDashboard();
  const k = d.kpis;
  const trend = k.salesLastMonth > 0 ? ((k.salesThisMonth - k.salesLastMonth) / k.salesLastMonth) * 100 : null;
  const pipelineMax = Math.max(1, ...d.pipeline.map((p) => p.count));

  return (
    <div className="relative">
      {denied ? (
        <div role="status" className="relative z-10 mb-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          Your role doesn&apos;t have access to that page. Ask the owner if you need it.
        </div>
      ) : null}
      <GridBackground className="-top-8 h-72" />
      <div className="relative mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Johannesburg" }).format(new Date())}
          </p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
            <TextGenerate words={`${greeting()}, ${user.name.split(" ")[0]}`} />
          </h1>
        </div>
        <div className="hidden gap-2 md:flex">
          <Link
            href="/debtors/receive"
            className="inline-flex h-11 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <HandCoins className="size-4" /> Receive payment
          </Link>
          <MovingBorderLink href="/invoices/new">
            <FileText /> New invoice
          </MovingBorderLink>
        </div>
      </div>

      {/* KPIs */}
      <section className="relative grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key figures">
        <KpiCard index={0} label="Sales this month" value={k.salesThisMonth} trend={trend} sub="vs last month" href="/reports" tone="accent" />
        <KpiCard
          index={1}
          label="Owed to you"
          value={k.debtorsTotal}
          sub={k.overdueCount ? `${formatMoney(k.overdueTotal)} overdue` : "Nothing overdue"}
          href="/debtors"
          tone={k.overdueCount ? "danger" : undefined}
        />
        <KpiCard
          index={2}
          label="You owe"
          value={k.creditorsTotal}
          sub={k.billsDueSoonCount ? `${k.billsDueSoonCount} due this week` : "Nothing due this week"}
          href="/creditors"
          tone={k.billsDueSoonCount ? "warning" : undefined}
        />
        <KpiCard
          index={3}
          label="Stock value"
          value={k.stockValue}
          sub={k.lowStockCount ? `${k.lowStockCount} items low` : "Stock levels healthy"}
          href="/inventory?filter=low"
          tone={k.lowStockCount ? "warning" : undefined}
        />
      </section>

      {/* Quick actions on phones */}
      <section className="mt-5 md:hidden" aria-label="Quick actions">
        <HoverGrid
          items={[
            { href: "/invoices/new", title: "Invoice", description: "Bill a client", icon: <FileText /> },
            { href: "/debtors/receive", title: "Get paid", description: "Record money in", icon: <HandCoins /> },
            { href: "/bills/new", title: "Capture bill", description: "Supplier invoice", icon: <Receipt /> },
            { href: "/inventory/new", title: "Stock item", description: "Add a product", icon: <PackagePlus /> },
          ]}
        />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Sales and purchases" description="Last 12 months, excluding VAT" />
          <CardBody>
            <CashflowChart data={d.months} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Debtors aging"
            description="How late your money is"
            action={
              <Link href="/debtors" className="text-sm font-medium text-accent">
                View
              </Link>
            }
          />
          <CardBody>
            <AgingChart data={d.debtorsAging} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Needs attention */}
        <Card>
          <CardHeader title="Needs attention" description="Chase these first" />
          <CardBody className="space-y-4">
            <AttentionList
              icon={AlertTriangle}
              title="Overdue invoices"
              empty="No overdue invoices. Nice."
              items={d.overdueInvoices.map((i) => ({
                href: `/invoices/${i.id}`,
                title: i.customer,
                sub: `${i.number} · ${i.daysLate} days late`,
                value: formatMoney(i.amount),
                tone: "text-danger",
              }))}
            />
            <AttentionList
              icon={CalendarClock}
              title="Bills due this week"
              empty="No bills due in the next 7 days."
              items={d.billsDueSoon.map((b) => ({
                href: `/bills/${b.id}`,
                title: b.supplier,
                sub: `${b.number} · ${b.dueInDays < 0 ? `${-b.dueInDays} days late` : b.dueInDays === 0 ? "due today" : `in ${b.dueInDays} days`}`,
                value: formatMoney(b.amount),
                tone: "text-warning",
              }))}
            />
            <AttentionList
              icon={PackageX}
              title="Low stock"
              empty="Everything is above its reorder level."
              items={d.lowStock.map((s) => ({
                href: `/inventory/${s.id}`,
                title: s.name,
                sub: `${s.sku} · reorder at ${formatQty(s.reorder)}`,
                value: `${formatQty(s.qty)} ${s.unit}`,
                tone: s.qty <= 0 ? "text-danger" : "text-warning",
              }))}
            />
          </CardBody>
        </Card>

        {/* Recent invoices */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent invoices"
            action={
              <Link href="/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-accent">
                All <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="mt-2 divide-y">
            {d.recentInvoices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              d.recentInvoices.map((i) => (
                <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{i.customer}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.number.startsWith("DRAFT") ? "Draft" : i.number} · {formatDate(i.issueDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular">{formatMoney(i.total)}</div>
                    <StatusBadge status={i.status} dueDate={i.dueDate} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Project pipeline" description="Active jobs by stage" />
          <CardBody className="space-y-3">
            {d.pipeline.map((p) => (
              <Link key={p.stage} href={`/projects?stage=${p.stage}`} className="block">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{STAGE_LABEL[p.stage]}</span>
                  <span className="text-muted-foreground tabular">
                    {p.count} · {formatMoney(p.fee)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(p.count / pipelineMax) * 100}%` }} />
                </div>
              </Link>
            ))}
            <div className="flex justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Open quotes</span>
              <span className="font-semibold tabular">
                {k.openQuotesCount} · {formatMoney(k.openQuotesTotal)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top clients" description="Sales, last 12 months" />
          <CardBody className="space-y-3">
            {d.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            ) : (
              d.topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-lg bg-muted text-xs font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  <span className="text-sm font-semibold tabular">{formatMoney(c.value)}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" description="Who did what" />
          <CardBody className="space-y-3">
            {d.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              d.recentActivity.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <Activity className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <div className="truncate text-sm">{a.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.user?.name ?? "System"} · {formatDateTime(a.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AttentionList({
  icon: Icon,
  title,
  empty,
  items,
}: {
  icon: typeof AlertTriangle;
  title: string;
  empty: string;
  items: { href: string; title: string; sub: string; value: string; tone: string }[];
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" /> {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="-mx-2">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.title}</div>
                <div className="truncate text-xs text-muted-foreground">{i.sub}</div>
              </div>
              <div className={`text-sm font-semibold tabular ${i.tone}`}>{i.value}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
