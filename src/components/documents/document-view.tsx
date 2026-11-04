import * as React from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DetailList } from "@/components/ui/page";
import { TotalsList } from "./document-editor";
import { formatMoney, formatQty, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

type Line = {
  id: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountPct: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  item?: { sku: string; unit: string } | null;
};

export function LinesCard({ lines }: { lines: Line[] }) {
  return (
    <Card>
      <CardHeader title="Lines" description={`${lines.length} ${lines.length === 1 ? "line" : "lines"}`} />
      {/* phones */}
      <div className="mt-3 divide-y md:hidden">
        {lines.map((l) => (
          <div key={l.id} className="px-5 py-3">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{l.description}</div>
                <div className="text-xs text-muted-foreground">
                  {formatQty(l.quantity)} {l.item?.unit ?? ""} × {formatMoney(l.unitPrice)}
                  {toNumber(l.discountPct) ? ` · −${toNumber(l.discountPct)}%` : ""} · VAT {toNumber(l.vatRate)}%
                </div>
              </div>
              <div className="font-semibold tabular">{formatMoney(l.lineTotal)}</div>
            </div>
          </div>
        ))}
      </div>
      {/* larger screens */}
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Description</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              <th className="px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-3 py-2.5 text-right font-medium">Disc.</th>
              <th className="px-3 py-2.5 text-right font-medium">VAT</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3">
                  <div className="font-medium">{l.description}</div>
                  {l.item ? <div className="text-xs text-muted-foreground">{l.item.sku}</div> : null}
                </td>
                <td className="px-3 py-3 text-right tabular">{formatQty(l.quantity)}</td>
                <td className="px-3 py-3 text-right tabular">{formatMoney(l.unitPrice)}</td>
                <td className="px-3 py-3 text-right tabular">{toNumber(l.discountPct) ? `${toNumber(l.discountPct)}%` : "—"}</td>
                <td className="px-3 py-3 text-right tabular">{toNumber(l.vatRate)}%</td>
                <td className="px-5 py-3 text-right font-semibold tabular">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-3" />
    </Card>
  );
}

export function SummaryCard({
  party,
  partyHref,
  details,
  subtotal,
  vat,
  total,
  paid,
}: {
  party: string;
  partyHref: string;
  details: { label: string; value: React.ReactNode }[];
  subtotal: unknown;
  vat: unknown;
  total: unknown;
  paid?: unknown;
}) {
  return (
    <Card>
      <CardBody>
        <Link href={partyHref} className="text-lg font-semibold hover:text-accent">
          {party}
        </Link>
        <div className="mt-2">
          <DetailList items={details} />
        </div>
        <div className="mt-4">
          <TotalsList
            subtotal={toNumber(subtotal as number)}
            vat={toNumber(vat as number)}
            total={toNumber(total as number)}
            paid={paid === undefined ? undefined : toNumber(paid as number)}
          />
        </div>
      </CardBody>
    </Card>
  );
}

export function PaymentsCard({
  title,
  payments,
}: {
  title: string;
  payments: { id: string; number: string; date: Date; amount: unknown; method: string }[];
}) {
  if (!payments.length) return null;
  return (
    <Card>
      <CardHeader title={title} />
      <div className="mt-2 divide-y">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <div>
              <div className="font-medium">{p.number}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(p.date)} · {p.method}
              </div>
            </div>
            <div className="font-semibold text-success tabular">{formatMoney(p.amount as number)}</div>
          </div>
        ))}
      </div>
      <div className="h-2" />
    </Card>
  );
}
