"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Textarea } from "@/components/ui/form";
import { adjustStock } from "@/server/records";
import { formatQty } from "@/lib/money";
import { cn } from "@/lib/utils";

const MODES = [
  { v: "add", label: "Add", hint: "Found / received outside a bill" },
  { v: "remove", label: "Remove", hint: "Used, damaged or lost" },
  { v: "set", label: "Count", hint: "Set to what you counted" },
] as const;

const REASONS = ["Stock take", "Used in studio", "Damaged", "Lost / theft", "Found", "Correction"];

export function AdjustStock({ itemId, current, unit }: { itemId: string; current: number; unit: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<(typeof MODES)[number]["v"]>("set");
  const [qty, setQty] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const n = Number(qty) || 0;
  const after = mode === "add" ? current + n : mode === "remove" ? current - n : n;

  async function submit() {
    setBusy(true);
    const res = await adjustStock({ itemId, mode, quantity: qty as unknown as number, note });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message ?? "Stock updated");
    setOpen(false);
    setQty("");
    setNote("");
    router.refresh();
  }

  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Adjust stock
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Adjust stock"
        description={`${formatQty(current)} ${unit} on hand now`}
        footer={
          <Button className="w-full" size="lg" onClick={submit} loading={busy} disabled={!qty || note.trim().length < 3 || after < 0}>
            Save · {formatQty(after)} {unit} after
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setMode(m.v)}
                className={cn("rounded-xl border p-2.5 text-center text-sm font-semibold", mode === m.v ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{MODES.find((m) => m.v === mode)?.hint}</p>
          <Field label={mode === "set" ? "Counted quantity" : "Quantity"} htmlFor="adj-qty">
            <Input id="adj-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} className="h-14 text-2xl font-semibold tabular" autoFocus />
          </Field>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setNote(r)} className={cn("h-8 rounded-full border px-3 text-xs font-medium", note === r ? "border-accent bg-accent-soft text-accent" : "bg-background text-muted-foreground")}>
                {r}
              </button>
            ))}
          </div>
          <Field label="Reason" htmlFor="adj-note" hint="Saved on the stock card and in the audit log.">
            <Textarea id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
          </Field>
          {after < 0 ? <p className="text-sm font-medium text-danger">Stock can&apos;t go below zero.</p> : null}
        </div>
      </Sheet>
    </>
  );
}
