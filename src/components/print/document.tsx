import Image from "next/image";
import { formatMoney, formatQty, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

type Settings = {
  name: string;
  legalName: string | null;
  regNumber: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNo: string | null;
  bankBranchCode: string | null;
  invoiceFooter: string | null;
};

type Line = {
  id: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountPct: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

export function Paper({ children }: { children: React.ReactNode }) {
  return (
    <article className="min-h-[297mm] w-[210mm] bg-white p-[14mm] text-[12px] leading-relaxed text-[#171715] shadow-xl print:min-h-0 print:w-auto print:p-0 print:shadow-none">
      {children}
    </article>
  );
}

export function Letterhead({ s, title, meta }: { s: Settings; title: string; meta: { label: string; value: string }[] }) {
  return (
    <header className="flex items-start justify-between gap-8 border-b border-[#e0dcd3] pb-6">
      <div>
        <Image src="/brand/cas-logo-dark.png" alt={s.name} width={110} height={39} priority />
        <div className="mt-3 text-[11px] text-[#6b6862]">
          <div className="font-semibold text-[#171715]">{s.legalName ?? s.name}</div>
          {s.address ? <div className="whitespace-pre-line">{s.address}</div> : null}
          <div>{[s.phone, s.email, s.website].filter(Boolean).join(" · ")}</div>
          {s.regNumber ? <div>Reg. {s.regNumber}</div> : null}
          {s.vatNumber ? <div>VAT no. {s.vatNumber}</div> : null}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[22px] font-semibold tracking-tight uppercase" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </div>
        <table className="mt-2 ml-auto text-[11px]">
          <tbody>
            {meta.map((m) => (
              <tr key={m.label}>
                <td className="pr-3 text-[#6b6862]">{m.label}</td>
                <td className="text-right font-semibold">{m.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </header>
  );
}

export function BillTo({ label, party }: { label: string; party: { name: string; contactName?: string | null; address?: string | null; vatNumber?: string | null; email?: string | null } }) {
  return (
    <section className="mt-6">
      <div className="text-[10px] font-semibold tracking-[0.14em] text-[#b8732e] uppercase">{label}</div>
      <div className="mt-1 text-[13px] font-semibold">{party.name}</div>
      <div className="text-[11px] text-[#6b6862]">
        {party.contactName ? <div>Attn: {party.contactName}</div> : null}
        {party.address ? <div className="whitespace-pre-line">{party.address}</div> : null}
        {party.email ? <div>{party.email}</div> : null}
        {party.vatNumber ? <div>VAT no. {party.vatNumber}</div> : null}
      </div>
    </section>
  );
}

export function LinesTable({ lines }: { lines: Line[] }) {
  return (
    <table className="mt-6 w-full border-collapse text-[11px]">
      <thead>
        <tr className="bg-[#171715] text-left text-[10px] tracking-wide text-[#f3f1ec] uppercase">
          <th className="px-3 py-2 font-semibold">Description</th>
          <th className="px-2 py-2 text-right font-semibold">Qty</th>
          <th className="px-2 py-2 text-right font-semibold">Unit price</th>
          <th className="px-2 py-2 text-right font-semibold">Disc.</th>
          <th className="px-2 py-2 text-right font-semibold">VAT</th>
          <th className="px-3 py-2 text-right font-semibold">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id} className="border-b border-[#ebe8e1] break-inside-avoid">
            <td className="px-3 py-2.5">{l.description}</td>
            <td className="px-2 py-2.5 text-right tabular">{formatQty(l.quantity)}</td>
            <td className="px-2 py-2.5 text-right tabular">{formatMoney(l.unitPrice)}</td>
            <td className="px-2 py-2.5 text-right tabular">{toNumber(l.discountPct) ? `${toNumber(l.discountPct)}%` : ""}</td>
            <td className="px-2 py-2.5 text-right tabular">{toNumber(l.vatRate)}%</td>
            <td className="px-3 py-2.5 text-right font-semibold tabular">{formatMoney(l.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Totals({ rows }: { rows: { label: string; value: unknown; strong?: boolean }[] }) {
  return (
    <div className="mt-4 ml-auto w-[75mm] text-[12px]">
      {rows.map((r) => (
        <div key={r.label} className={`flex justify-between py-1 ${r.strong ? "mt-1 border-t-2 border-[#171715] pt-2 text-[14px] font-bold" : ""}`}>
          <span className={r.strong ? "" : "text-[#6b6862]"}>{r.label}</span>
          <span className="tabular">{formatMoney(r.value as number)}</span>
        </div>
      ))}
    </div>
  );
}

export function BankFooter({ s, reference, notes }: { s: Settings; reference?: string; notes?: string | null }) {
  return (
    <footer className="mt-10 grid grid-cols-2 gap-8 border-t border-[#e0dcd3] pt-5 text-[11px] break-inside-avoid">
      <div>
        {s.bankAccountNo ? (
          <>
            <div className="text-[10px] font-semibold tracking-[0.14em] text-[#b8732e] uppercase">Banking details</div>
            <div className="mt-1">
              {s.bankAccountName ?? s.name}
              <br />
              {s.bankName} · Acc. {s.bankAccountNo}
              {s.bankBranchCode ? (
                <>
                  <br />
                  Branch code {s.bankBranchCode}
                </>
              ) : null}
              {reference ? (
                <>
                  <br />
                  Reference: <strong>{reference}</strong>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="text-[#6b6862]">
        {notes ? <p className="mb-2 whitespace-pre-line text-[#171715]">{notes}</p> : null}
        {s.invoiceFooter ? <p className="whitespace-pre-line">{s.invoiceFooter}</p> : null}
      </div>
    </footer>
  );
}

export { formatDate };
