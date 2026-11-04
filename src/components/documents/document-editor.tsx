"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Trash2, Package, Search, Minus, Wrench, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { calcTotals, formatMoney, formatQty } from "@/lib/money";
import { addDays, cn, toDateInput } from "@/lib/utils";
import { saveInvoice, saveQuote } from "@/server/invoices";
import { saveBill } from "@/server/bills";

export type PickerItem = {
  id: string;
  sku: string;
  name: string;
  type: "STOCK" | "SERVICE";
  unit: string;
  sellPrice: number;
  costPrice: number;
  vatRate: number;
  qtyOnHand: number;
};
export type Party = { id: string; name: string; code: string; termsDays: number };
export type ProjectOption = { id: string; name: string; customerId: string };

type Line = {
  key: string;
  itemId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  vatRate: string;
};

export type DocumentInitial = {
  id?: string;
  partyId?: string;
  projectId?: string | null;
  issueDate?: string;
  secondDate?: string; // due or expiry
  reference?: string | null;
  category?: string | null;
  notes?: string | null;
  lines?: Omit<Line, "key">[];
};

const KIND = {
  invoice: { party: "Customer", date: "Invoice date", second: "Due date", ref: "Reference / order no.", base: "/invoices" },
  quote: { party: "Customer", date: "Quote date", second: "Valid until", ref: "Reference", base: "/quotes" },
  bill: { party: "Supplier", date: "Bill date", second: "Due date", ref: "Supplier's invoice no.", base: "/bills" },
} as const;

let keySeq = 0;
const newKey = () => `l${++keySeq}`;

export function DocumentEditor({
  kind,
  parties,
  projects = [],
  items,
  initial,
  defaultVat,
  categories = [],
}: {
  kind: keyof typeof KIND;
  parties: Party[];
  projects?: ProjectOption[];
  items: PickerItem[];
  initial?: DocumentInitial;
  defaultVat: number;
  categories?: string[];
}) {
  const k = KIND[kind];
  const router = useRouter();
  const [partyId, setPartyId] = React.useState(initial?.partyId ?? "");
  const [projectId, setProjectId] = React.useState(initial?.projectId ?? "");
  const [issueDate, setIssueDate] = React.useState(initial?.issueDate ?? toDateInput(new Date()));
  const [secondDate, setSecondDate] = React.useState(initial?.secondDate ?? toDateInput(addDays(new Date(), 30)));
  const [reference, setReference] = React.useState(initial?.reference ?? "");
  const [category, setCategory] = React.useState(initial?.category ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [lines, setLines] = React.useState<Line[]>(() =>
    initial?.lines?.length
      ? initial.lines.map((l) => ({ ...l, key: newKey() }))
      : [],
  );
  const [pickerFor, setPickerFor] = React.useState<string | "new" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const party = parties.find((p) => p.id === partyId);
  const partyProjects = projects.filter((p) => p.customerId === partyId);

  // Default due date follows the party's terms when you pick them.
  const onParty = (id: string) => {
    setPartyId(id);
    setProjectId("");
    const p = parties.find((x) => x.id === id);
    if (p && kind !== "quote") setSecondDate(toDateInput(addDays(new Date(issueDate), p.termsDays)));
  };

  const parsed = lines.map((l) => ({
    quantity: Number(l.quantity) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    discountPct: Number(l.discountPct) || 0,
    vatRate: Number(l.vatRate) || 0,
  }));
  const totals = calcTotals(parsed);

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addFromItem = (item: PickerItem | null) => {
    const base: Line = {
      key: newKey(),
      itemId: item?.id ?? null,
      description: item?.name ?? "",
      quantity: "1",
      unitPrice: String(item ? (kind === "bill" ? item.costPrice : item.sellPrice) : ""),
      discountPct: "0",
      vatRate: String(item?.vatRate ?? defaultVat),
    };
    if (pickerFor && pickerFor !== "new") {
      update(pickerFor, { ...base, key: pickerFor });
    } else {
      setLines((ls) => [...ls, base]);
    }
    setPickerFor(null);
  };

  async function submit() {
    setBusy(true);
    setErrors({});
    const payloadLines = lines.map((l) => ({
      itemId: l.itemId,
      description: l.description,
      quantity: l.quantity as unknown as number,
      unitPrice: l.unitPrice as unknown as number,
      discountPct: (l.discountPct || 0) as unknown as number,
      vatRate: l.vatRate as unknown as number,
    }));
    const common = { id: initial?.id, issueDate: issueDate as unknown as Date, notes, lines: payloadLines };
    const res =
      kind === "invoice"
        ? await saveInvoice({ ...common, customerId: partyId, projectId: projectId || null, dueDate: secondDate as unknown as Date, reference })
        : kind === "quote"
          ? await saveQuote({ ...common, customerId: partyId, projectId: projectId || null, expiryDate: secondDate as unknown as Date, reference })
          : await saveBill({ ...common, supplierId: partyId, dueDate: secondDate as unknown as Date, supplierRef: reference, category });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved");
    router.push(`${k.base}/${res.data!.id}`);
    router.refresh();
  }

  return (
    <div className="pb-44 lg:pb-12">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-4 md:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={k.party} htmlFor="party" required error={errors.customerId ?? errors.supplierId} className="sm:col-span-2">
                <Select id="party" value={partyId} onChange={(e) => onParty(e.target.value)} aria-invalid={!!(errors.customerId ?? errors.supplierId)}>
                  <option value="">Choose a {k.party.toLowerCase()}…</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </Select>
              </Field>
              {kind !== "bill" && partyProjects.length > 0 ? (
                <Field label="Project" htmlFor="project" className="sm:col-span-2">
                  <Select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">No project</option>
                    {partyProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field label={k.date} htmlFor="issueDate" required error={errors.issueDate}>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => {
                    setIssueDate(e.target.value);
                    if (party && kind !== "quote" && e.target.value)
                      setSecondDate(toDateInput(addDays(new Date(e.target.value), party.termsDays)));
                  }}
                />
              </Field>
              <Field label={k.second} htmlFor="secondDate" required error={errors.dueDate ?? errors.expiryDate}>
                <Input id="secondDate" type="date" value={secondDate} onChange={(e) => setSecondDate(e.target.value)} />
              </Field>
              <Field label={k.ref} htmlFor="reference">
                <Input id="reference" value={reference ?? ""} onChange={(e) => setReference(e.target.value)} />
              </Field>
              {kind === "bill" ? (
                <Field label="Expense category" htmlFor="category">
                  <Input id="category" list="bill-categories" value={category ?? ""} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Printing" />
                  <datalist id="bill-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
              ) : null}
            </div>
          </Card>

          {/* Lines */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Lines</h2>
              {errors.lines ? <span className="text-xs font-medium text-danger">{errors.lines}</span> : null}
            </div>
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {lines.map((l, idx) => {
                  const item = items.find((i) => i.id === l.itemId);
                  const p = parsed[idx];
                  const net = p.quantity * p.unitPrice * (1 - p.discountPct / 100);
                  const lowStock = kind !== "bill" && item?.type === "STOCK" && p.quantity > item.qtyOnHand;
                  const err = (f: string) => errors[`lines.${idx}.${f}`];
                  return (
                    <motion.div
                      key={l.key}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -40, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="p-3.5 md:p-4">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setPickerFor(l.key)}
                            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                            aria-label="Choose item"
                          >
                            {item?.type === "SERVICE" ? <Wrench className="size-4" /> : <Package className="size-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <Input
                              aria-label="Description"
                              value={l.description}
                              onChange={(e) => update(l.key, { description: e.target.value })}
                              placeholder="Description"
                              aria-invalid={!!err("description")}
                              className="h-10"
                            />
                            {item ? (
                              <div className={cn("mt-1 text-xs", lowStock ? "font-medium text-warning" : "text-muted-foreground")}>
                                {item.sku}
                                {item.type === "STOCK" ? ` · ${formatQty(item.qtyOnHand)} ${item.unit} in stock` : ""}
                                {lowStock ? " · not enough stock" : ""}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"
                            aria-label="Remove line"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Qty</label>
                            <div className="flex h-10 items-center rounded-xl border border-input bg-card">
                              <button
                                type="button"
                                aria-label="Decrease"
                                className="grid h-full w-9 place-items-center text-muted-foreground"
                                onClick={() => update(l.key, { quantity: String(Math.max(0, (Number(l.quantity) || 0) - 1)) })}
                              >
                                <Minus className="size-3.5" />
                              </button>
                              <input
                                aria-label="Quantity"
                                inputMode="decimal"
                                value={l.quantity}
                                onChange={(e) => update(l.key, { quantity: e.target.value.replace(/[^\d.-]/g, "") })}
                                className="h-full w-full min-w-0 bg-transparent text-center tabular outline-none"
                              />
                              <button
                                type="button"
                                aria-label="Increase"
                                className="grid h-full w-9 place-items-center text-muted-foreground"
                                onClick={() => update(l.key, { quantity: String((Number(l.quantity) || 0) + 1) })}
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Unit price</label>
                            <Input
                              aria-label="Unit price"
                              inputMode="decimal"
                              value={l.unitPrice}
                              onChange={(e) => update(l.key, { unitPrice: e.target.value.replace(/[^\d.]/g, "") })}
                              className="h-10 tabular"
                              aria-invalid={!!err("unitPrice")}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Discount %</label>
                            <Input
                              aria-label="Discount percent"
                              inputMode="decimal"
                              value={l.discountPct}
                              onChange={(e) => update(l.key, { discountPct: e.target.value.replace(/[^\d.]/g, "") })}
                              className="h-10 tabular"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">VAT</label>
                            <Select aria-label="VAT rate" value={l.vatRate} onChange={(e) => update(l.key, { vatRate: e.target.value })} className="h-10">
                              <option value={String(defaultVat)}>{defaultVat}%</option>
                              {defaultVat !== 0 ? <option value="0">0% (zero / exempt)</option> : null}
                            </Select>
                          </div>
                        </div>
                        <div className="mt-2.5 flex justify-end text-sm">
                          <span className="text-muted-foreground">Line total&nbsp;</span>
                          <span className="font-semibold tabular">{formatMoney(net)}</span>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => setPickerFor("new")}>
                <Package /> Add item
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setLines((ls) => [
                    ...ls,
                    { key: newKey(), itemId: null, description: "", quantity: "1", unitPrice: "", discountPct: "0", vatRate: String(defaultVat) },
                  ])
                }
              >
                <Plus /> Custom line
              </Button>
            </div>
          </div>

          <Card className="p-4 md:p-5">
            <Field label="Notes" htmlFor="notes" hint={kind === "bill" ? "Internal only." : "Printed on the document."}>
              <Textarea id="notes" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Card>
        </div>

        {/* Totals (desktop side panel) */}
        <div className="hidden lg:block">
          <Card className="sticky top-8 p-5">
            <h2 className="mb-3 font-semibold">Summary</h2>
            <TotalsList subtotal={totals.subtotal} vat={totals.vat} total={totals.total} />
            <Button className="mt-5 w-full" size="lg" onClick={submit} loading={busy}>
              <Save /> Save {kind === "bill" ? "bill" : kind}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {kind === "quote" ? "You can send or convert it next." : "Saved as a draft. You'll confirm it on the next screen."}
            </p>
          </Card>
        </div>
      </div>

      {/* Sticky total bar (phones/tablets) */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-card/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Total · includes VAT {formatMoney(totals.vat)}</div>
            <div className="truncate text-lg font-semibold tabular">{formatMoney(totals.total)}</div>
          </div>
          <Button size="lg" onClick={submit} loading={busy}>
            <Save /> Save
          </Button>
        </div>
      </div>

      <ItemPicker
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        items={items}
        kind={kind}
        onPick={addFromItem}
      />
    </div>
  );
}

export function TotalsList({ subtotal, vat, total, paid }: { subtotal: number; vat: number; total: number; paid?: number }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular">{formatMoney(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">VAT</dt>
        <dd className="tabular">{formatMoney(vat)}</dd>
      </div>
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular">{formatMoney(total)}</dd>
      </div>
      {paid !== undefined ? (
        <>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="tabular text-success">−{formatMoney(paid)}</dd>
          </div>
          <div className="flex justify-between rounded-xl bg-accent-soft px-3 py-2 font-semibold">
            <dt>Balance due</dt>
            <dd className="tabular">{formatMoney(total - paid)}</dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}

function ItemPicker({
  open,
  onClose,
  items,
  kind,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  items: PickerItem[];
  kind: "invoice" | "quote" | "bill";
  onPick: (item: PickerItem | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const close = () => {
    setQ("");
    onClose();
  };
  const pick = (item: PickerItem | null) => {
    setQ("");
    onPick(item);
  };
  const list = items.filter((i) => {
    if (kind === "bill" && i.type === "SERVICE") return false;
    const s = q.toLowerCase();
    return !s || i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s);
  });
  return (
    <Sheet open={open} onClose={close} title="Choose an item" description={kind === "bill" ? "Stock you're buying" : "Services and stock"}>
      <div className="sticky top-0 z-10 bg-card pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code" className="pl-10" />
        </div>
      </div>
      <div className="-mx-2 space-y-0.5 pb-2">
        <button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted">
          <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
            <Plus className="size-4" />
          </span>
          <span className="text-sm font-medium">Custom line (no item)</span>
        </button>
        {list.map((i) => (
          <button
            type="button"
            key={i.id}
            onClick={() => pick(i)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              {i.type === "SERVICE" ? <Wrench className="size-4" /> : <Package className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{i.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {i.sku}
                {i.type === "STOCK" ? ` · ${formatQty(i.qtyOnHand)} ${i.unit} on hand` : " · service"}
              </span>
            </span>
            <span className="text-sm font-semibold tabular">{formatMoney(kind === "bill" ? i.costPrice : i.sellPrice)}</span>
          </button>
        ))}
        {list.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No items match.</p> : null}
      </div>
    </Sheet>
  );
}
