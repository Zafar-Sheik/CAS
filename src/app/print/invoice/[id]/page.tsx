import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/server/queries";
import { Paper, Letterhead, BillTo, LinesTable, Totals, BankFooter, formatDate } from "@/components/print/document";
import { toNumber } from "@/lib/money";

export async function generateMetadata(props: PageProps<"/print/invoice/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const inv = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: inv ? `Invoice ${inv.number}` : "Invoice" };
}

export default async function PrintInvoice(props: PageProps<"/print/invoice/[id]">) {
  const { id } = await props.params;
  const [inv, s] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: { customer: true, project: true, lines: { orderBy: { sortOrder: "asc" } } } }),
    getSettings(),
  ]);
  if (!inv || inv.status === "DRAFT") notFound();
  const paid = toNumber(inv.amountPaid);
  return (
    <Paper>
      {inv.status === "VOID" ? (
        <div className="mb-4 rounded border-2 border-red-700 p-2 text-center font-bold tracking-widest text-red-700 uppercase">Void</div>
      ) : null}
      <Letterhead
        s={s}
        title={s.vatNumber ? "Tax invoice" : "Invoice"}
        meta={[
          { label: "Invoice no.", value: inv.number },
          { label: "Date", value: formatDate(inv.issueDate) },
          { label: "Due", value: formatDate(inv.dueDate) },
          ...(inv.reference ? [{ label: "Your ref.", value: inv.reference }] : []),
          ...(inv.project ? [{ label: "Project", value: inv.project.name }] : []),
        ]}
      />
      <BillTo label="Bill to" party={inv.customer} />
      <LinesTable lines={inv.lines} />
      <Totals
        rows={[
          { label: "Subtotal", value: inv.subtotal },
          { label: "VAT", value: inv.vatTotal },
          { label: "Total", value: inv.total, strong: !paid },
          ...(paid ? [{ label: "Paid", value: -paid }, { label: "Balance due", value: toNumber(inv.total) - paid, strong: true }] : []),
        ]}
      />
      <BankFooter s={s} reference={inv.number} notes={inv.notes} />
    </Paper>
  );
}
