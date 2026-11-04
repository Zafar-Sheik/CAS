import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings, agingOf } from "@/server/queries";
import { Paper, Letterhead, BillTo, BankFooter, formatDate } from "@/components/print/document";
import { formatMoney, toNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Statement" };

export default async function PrintStatement(props: PageProps<"/print/statement/[id]">) {
  const { id } = await props.params;
  const [c, s] = await Promise.all([
    db.customer.findUnique({
      where: { id },
      include: {
        invoices: { where: { status: { in: ["ISSUED", "PARTIAL", "PAID"] } } },
        receipts: true,
      },
    }),
    getSettings(),
  ]);
  if (!c) notFound();
  const tx = [
    ...c.invoices.map((i) => ({ date: i.issueDate, ref: i.number, desc: "Invoice", debit: toNumber(i.total), credit: 0 })),
    ...c.receipts.map((r) => ({ date: r.date, ref: r.number, desc: `Payment received${r.reference ? ` (${r.reference})` : ""}`, debit: 0, credit: toNumber(r.amount) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const rows = tx.reduce<((typeof tx)[number] & { balance: number })[]>((acc, t) => {
    const prev = acc.length ? acc[acc.length - 1].balance : 0;
    acc.push({ ...t, balance: Math.round((prev + t.debit - t.credit) * 100) / 100 });
    return acc;
  }, []);
  const running = rows.length ? rows[rows.length - 1].balance : 0;
  const aging = agingOf(c.invoices.filter((i) => i.status !== "PAID"));

  return (
    <Paper>
      <Letterhead s={s} title="Statement" meta={[{ label: "Date", value: formatDate(new Date()) }, { label: "Account", value: c.code }]} />
      <BillTo label="Account holder" party={c} />
      <table className="mt-6 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-[#171715] text-left text-[10px] tracking-wide text-[#f3f1ec] uppercase">
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-2 py-2 font-semibold">Reference</th>
            <th className="px-2 py-2 font-semibold">Description</th>
            <th className="px-2 py-2 text-right font-semibold">Debit</th>
            <th className="px-2 py-2 text-right font-semibold">Credit</th>
            <th className="px-3 py-2 text-right font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#ebe8e1] break-inside-avoid">
              <td className="px-3 py-2">{formatDate(r.date)}</td>
              <td className="px-2 py-2">{r.ref}</td>
              <td className="px-2 py-2">{r.desc}</td>
              <td className="px-2 py-2 text-right tabular">{r.debit ? formatMoney(r.debit) : ""}</td>
              <td className="px-2 py-2 text-right tabular">{r.credit ? formatMoney(r.credit) : ""}</td>
              <td className="px-3 py-2 text-right font-semibold tabular">{formatMoney(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 grid grid-cols-6 border border-[#e0dcd3] text-center text-[11px] break-inside-avoid">
        {aging.map((a) => (
          <div key={a.bucket} className="border-r border-[#e0dcd3] p-2">
            <div className="text-[#6b6862]">{a.bucket === "Current" ? "Current" : `${a.bucket} days`}</div>
            <div className="font-semibold tabular">{formatMoney(a.amount)}</div>
          </div>
        ))}
        <div className="bg-[#171715] p-2 text-[#f3f1ec]">
          <div>Amount due</div>
          <div className="font-bold tabular">{formatMoney(running)}</div>
        </div>
      </div>
      <BankFooter s={s} reference={c.code} />
    </Paper>
  );
}
