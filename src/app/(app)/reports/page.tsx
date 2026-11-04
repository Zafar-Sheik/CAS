import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { PageHeader, FilterChips, DetailList, buildHref } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatMoney, formatQty, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { str } from "@/lib/params";
import { PERIODS, periodRange } from "@/lib/periods";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage(props: PageProps<"/reports">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const period = str(sp, "period") ?? "month";
  const { from, to } = periodRange(period);
  const range = { gte: from, lt: to };

  const [invoices, bills, receipts, payments, items] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIAL", "PAID"] }, issueDate: range },
      select: { subtotal: true, vatTotal: true, total: true, customer: { select: { name: true } } },
    }),
    db.bill.findMany({ where: { status: { in: ["POSTED", "PARTIAL", "PAID"] }, issueDate: range }, select: { subtotal: true, vatTotal: true, category: true } }),
    db.receipt.aggregate({ where: { date: range }, _sum: { amount: true } }),
    db.supplierPayment.aggregate({ where: { date: range }, _sum: { amount: true } }),
    db.item.findMany({ where: { type: "STOCK", active: true }, select: { category: true, qtyOnHand: true, costPrice: true, sellPrice: true } }),
  ]);

  const sales = invoices.reduce((a, i) => a + toNumber(i.subtotal), 0);
  const outputVat = invoices.reduce((a, i) => a + toNumber(i.vatTotal), 0);
  const purchases = bills.reduce((a, b) => a + toNumber(b.subtotal), 0);
  const inputVat = bills.reduce((a, b) => a + toNumber(b.vatTotal), 0);
  const cashIn = toNumber(receipts._sum.amount);
  const cashOut = toNumber(payments._sum.amount);

  const byCustomer = [...invoices.reduce((m, i) => m.set(i.customer.name, (m.get(i.customer.name) ?? 0) + toNumber(i.subtotal)), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
  const byCategory = [...bills.reduce((m, b) => m.set(b.category ?? "Uncategorised", (m.get(b.category ?? "Uncategorised") ?? 0) + toNumber(b.subtotal)), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
  const stockByCat = [...items.reduce((m, i) => {
    const k = i.category ?? "Uncategorised";
    const cur = m.get(k) ?? { qty: 0, cost: 0, retail: 0 };
    const q = Math.max(0, toNumber(i.qtyOnHand));
    cur.qty += q;
    cur.cost += q * toNumber(i.costPrice);
    cur.retail += q * toNumber(i.sellPrice);
    return m.set(k, cur);
  }, new Map<string, { qty: number; cost: number; retail: number }>())];
  const stockTotal = stockByCat.reduce((a, [, v]) => a + v.cost, 0);
  const maxCust = Math.max(1, ...byCustomer.map(([, v]) => v));
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => v));
  const qs = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;

  return (
    <div>
      <PageHeader title="Reports" description={`${formatDate(from)} to ${formatDate(new Date(to.getTime() - 86400000))}`} />
      <div className="mb-5">
        <FilterChips options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} active={period} hrefFor={(v) => buildHref("/reports", { period: v })} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Sales (excl. VAT)", value: sales },
          { label: "Purchases (excl. VAT)", value: purchases },
          { label: "Gross margin", value: sales - purchases, tone: sales - purchases >= 0 ? "text-success" : "text-danger" },
          { label: "Net cash flow", value: cashIn - cashOut, tone: cashIn - cashOut >= 0 ? "text-success" : "text-danger" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={`mt-1 truncate text-lg font-semibold tabular md:text-2xl ${s.tone ?? ""}`}>{formatMoney(s.value)}</div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="VAT summary" description="For your VAT201 return (invoice basis)" />
          <CardBody>
            <DetailList
              items={[
                { label: "Output VAT (on sales)", value: formatMoney(outputVat) },
                { label: "Input VAT (on purchases)", value: formatMoney(inputVat) },
                {
                  label: outputVat - inputVat >= 0 ? "VAT payable to SARS" : "VAT refundable",
                  value: <span className="text-base font-semibold">{formatMoney(Math.abs(outputVat - inputVat))}</span>,
                },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">Check with your accountant before filing. Voided documents are excluded.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cash" description="Money that actually moved" />
          <CardBody>
            <DetailList
              items={[
                { label: "Received from customers", value: <span className="text-success">{formatMoney(cashIn)}</span> },
                { label: "Paid to suppliers", value: formatMoney(cashOut) },
                { label: "Net", value: <span className="text-base font-semibold">{formatMoney(cashIn - cashOut)}</span> },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sales by client" />
          <CardBody className="space-y-3">
            {byCustomer.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this period.</p>
            ) : (
              byCustomer.map(([name, v]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{name}</span>
                    <span className="tabular">{formatMoney(v)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(v / maxCust) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Spend by category" />
          <CardBody className="space-y-3">
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchases in this period.</p>
            ) : (
              byCategory.map(([name, v]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{name}</span>
                    <span className="tabular">{formatMoney(v)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[var(--chart-2)]" style={{ width: `${(v / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stock valuation" description={`${formatMoney(stockTotal)} at cost, today`} />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 text-right font-medium">Units</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-5 py-2.5 text-right font-medium">Retail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stockByCat.map(([k, v]) => (
                  <tr key={k}>
                    <td className="px-5 py-2.5 font-medium">{k}</td>
                    <td className="px-3 py-2.5 text-right tabular">{formatQty(v.qty)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{formatMoney(v.cost)}</td>
                    <td className="px-5 py-2.5 text-right tabular">{formatMoney(v.retail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-3" />
        </Card>

        {can(user.role, "reports:export") ? (
        <Card>
          <CardHeader title="Export for your accountant" description="CSV files for this period" />
          <CardBody className="grid grid-cols-2 gap-2">
            {[
              ["invoices", "Invoices"],
              ["receipts", "Receipts"],
              ["bills", "Supplier bills"],
              ["payments", "Supplier payments"],
              ["stock", "Stock list"],
              ["debtors", "Debtors balances"],
            ].map(([type, label]) => (
              <a
                key={type}
                href={`/api/export/${type}?${qs}`}
                className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm font-medium hover:border-accent/50"
              >
                <Download className="size-4 text-accent" /> {label}
              </a>
            ))}
          </CardBody>
        </Card>
        ) : null}
      </div>
    </div>
  );
}
