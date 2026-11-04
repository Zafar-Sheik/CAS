"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createReceipt, createSupplierPayment } from "@/server/payments";
import { formatMoney } from "@/lib/money";
import { cn, formatDate, toDateInput } from "@/lib/utils";

export type OpenDocOption = { id: string; number: string; partyId: string; dueDate: string; outstanding: number };

const METHODS = ["EFT", "CASH", "CARD", "CHEQUE", "OTHER"] as const;

export function PaymentForm({
  kind,
  parties,
  openDocs,
  initialPartyId,
  initialDocId,
  onDone,
}: {
  kind: "receipt" | "supplier";
  parties: { id: string; name: string; code: string }[];
  openDocs: OpenDocOption[];
  initialPartyId?: string;
  initialDocId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [partyId, setPartyId] = React.useState(initialPartyId ?? "");
  const docs = openDocs.filter((d) => d.partyId === partyId);
  const initialDoc = docs.find((d) => d.id === initialDocId);
  const [amount, setAmount] = React.useState(initialDoc ? initialDoc.outstanding.toFixed(2) : "");
  const [date, setDate] = React.useState(toDateInput(new Date()));
  const [method, setMethod] = React.useState<(typeof METHODS)[number]>("EFT");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [alloc, setAlloc] = React.useState<Record<string, string>>(
    initialDoc ? { [initialDoc.id]: initialDoc.outstanding.toFixed(2) } : {},
  );
  const [busy, setBusy] = React.useState(false);

  const amountNum = Number(amount) || 0;
  const allocated = Object.values(alloc).reduce((a, v) => a + (Number(v) || 0), 0);
  const unallocated = Math.round((amountNum - allocated) * 100) / 100;

  const autoAllocate = (value = amountNum) => {
    let left = value;
    const next: Record<string, string> = {};
    for (const d of docs) {
      if (left <= 0) break;
      const take = Math.min(d.outstanding, left);
      next[d.id] = take.toFixed(2);
      left = Math.round((left - take) * 100) / 100;
    }
    setAlloc(next);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (unallocated < -0.001) {
      toast.error("You've allocated more than the payment amount.");
      return;
    }
    setBusy(true);
    const payload = {
      partyId,
      date: date as unknown as Date,
      amount: amount as unknown as number,
      method,
      reference,
      notes,
      allocations: Object.entries(alloc)
        .filter(([, v]) => Number(v) > 0)
        .map(([documentId, v]) => ({ documentId, amount: v as unknown as number })),
    };
    const res = kind === "receipt" ? await createReceipt(payload) : await createSupplierPayment(payload);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved", { icon: <CheckCircle2 className="size-4" /> });
    if (onDone) onDone();
    else router.push(kind === "receipt" ? `/debtors/${partyId}` : `/creditors/${partyId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!initialPartyId ? (
        <Field label={kind === "receipt" ? "Received from" : "Paid to"} htmlFor="party" required>
          <Select
            id="party"
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setAlloc({});
            }}
          >
            <option value="">Choose…</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Amount" htmlFor="amount" required>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg font-semibold text-muted-foreground">R</span>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setAmount(v);
              if (!initialDocId) autoAllocate(Number(v) || 0);
            }}
            placeholder="0.00"
            className="h-14 pl-10 text-2xl font-semibold tabular"
            autoFocus={!!initialPartyId}
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="date" required>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reference" htmlFor="reference">
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank ref." />
        </Field>
      </div>

      <div>
        <div className="mb-1.5 text-sm font-medium">Method</div>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-medium transition",
                method === m ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
              )}
            >
              {m === "EFT" ? "EFT" : m.charAt(0) + m.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {partyId ? (
        <div className="rounded-2xl border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Allocate to {kind === "receipt" ? "invoices" : "bills"}</div>
            {docs.length ? (
              <button type="button" onClick={() => autoAllocate()} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                <Wand2 className="size-3.5" /> Oldest first
              </button>
            ) : null}
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing open. The payment will sit as credit on the account.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.number}</div>
                    <div className="text-xs text-muted-foreground">
                      Due {formatDate(d.dueDate)} · {formatMoney(d.outstanding)} owing
                    </div>
                  </div>
                  <Input
                    aria-label={`Allocate to ${d.number}`}
                    inputMode="decimal"
                    value={alloc[d.id] ?? ""}
                    placeholder="0.00"
                    onChange={(e) => setAlloc((a) => ({ ...a, [d.id]: e.target.value.replace(/[^\d.]/g, "") }))}
                    className="h-10 w-28 text-right tabular"
                  />
                </div>
              ))}
            </div>
          )}
          {amountNum > 0 ? (
            <div
              className={cn(
                "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium",
                unallocated < -0.001 ? "bg-danger-soft text-danger" : unallocated > 0.001 ? "bg-info-soft text-info" : "bg-success-soft text-success",
              )}
            >
              <Info className="size-3.5" />
              {unallocated < -0.001
                ? `Over-allocated by ${formatMoney(-unallocated)}`
                : unallocated > 0.001
                  ? `${formatMoney(unallocated)} will stay as credit on the account`
                  : "Fully allocated"}
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label="Notes" htmlFor="pay-notes">
        <Textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
      </Field>

      <Button type="submit" size="lg" className="w-full" variant="accent" loading={busy} disabled={!partyId || amountNum <= 0}>
        {kind === "receipt" ? "Record payment received" : "Record payment made"}
        {amountNum > 0 ? ` · ${formatMoney(amountNum)}` : ""}
      </Button>
    </form>
  );
}
