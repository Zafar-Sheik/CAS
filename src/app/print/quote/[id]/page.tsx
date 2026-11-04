import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/server/queries";
import { Paper, Letterhead, BillTo, LinesTable, Totals, BankFooter, formatDate } from "@/components/print/document";

export const metadata: Metadata = { title: "Quotation" };

export default async function PrintQuote(props: PageProps<"/print/quote/[id]">) {
  const { id } = await props.params;
  const [q, s] = await Promise.all([
    db.quote.findUnique({ where: { id }, include: { customer: true, project: true, lines: { orderBy: { sortOrder: "asc" } } } }),
    getSettings(),
  ]);
  if (!q) notFound();
  return (
    <Paper>
      <Letterhead
        s={s}
        title="Quotation"
        meta={[
          { label: "Quote no.", value: q.number },
          { label: "Date", value: formatDate(q.issueDate) },
          { label: "Valid until", value: formatDate(q.expiryDate) },
          ...(q.project ? [{ label: "Project", value: q.project.name }] : []),
        ]}
      />
      <BillTo label="Prepared for" party={q.customer} />
      <LinesTable lines={q.lines} />
      <Totals
        rows={[
          { label: "Subtotal", value: q.subtotal },
          { label: "VAT", value: q.vatTotal },
          { label: "Total", value: q.total, strong: true },
        ]}
      />
      <BankFooter s={{ ...s, bankAccountNo: null }} notes={q.notes} />
    </Paper>
  );
}
