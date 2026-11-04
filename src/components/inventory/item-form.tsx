"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, Save, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { saveItem } from "@/server/records";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

export type ItemInitial = {
  id?: string;
  sku?: string;
  name?: string;
  description?: string | null;
  type?: "STOCK" | "SERVICE";
  category?: string | null;
  unit?: string;
  costPrice?: number;
  sellPrice?: number;
  vatRate?: number;
  reorderLevel?: number;
  location?: string | null;
  barcode?: string | null;
};

export function ItemForm({ initial, categories, defaultVat }: { initial?: ItemInitial; categories: string[]; defaultVat: number }) {
  const router = useRouter();
  const isNew = !initial?.id;
  const [v, setV] = React.useState<Record<string, string>>({
    sku: initial?.sku ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    type: initial?.type ?? "STOCK",
    category: initial?.category ?? "",
    unit: initial?.unit ?? "each",
    costPrice: String(initial?.costPrice ?? ""),
    sellPrice: String(initial?.sellPrice ?? ""),
    vatRate: String(initial?.vatRate ?? defaultVat),
    reorderLevel: String(initial?.reorderLevel ?? "0"),
    openingQty: "0",
    location: initial?.location ?? "",
    barcode: initial?.barcode ?? "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const num = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, "") }));
  const cost = Number(v.costPrice) || 0;
  const sell = Number(v.sellPrice) || 0;
  const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
  const stock = v.type === "STOCK";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const res = await saveItem({
      id: initial?.id,
      sku: v.sku,
      name: v.name,
      description: v.description,
      type: v.type as "STOCK" | "SERVICE",
      category: v.category,
      unit: v.unit,
      costPrice: v.costPrice || 0,
      sellPrice: v.sellPrice || 0,
      vatRate: v.vatRate,
      reorderLevel: stock ? v.reorderLevel || 0 : 0,
      openingQty: isNew && stock ? v.openingQty || 0 : undefined,
      location: v.location,
      barcode: v.barcode,
    } as never);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved");
    router.push(`/inventory/${res.data!.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Item type">
        {[
          { t: "STOCK", label: "Stock item", sub: "Physical, counted", icon: Package },
          { t: "SERVICE", label: "Service", sub: "Fees, time, renders", icon: Wrench },
        ].map((o) => (
          <button
            key={o.t}
            type="button"
            role="radio"
            aria-checked={v.type === o.t}
            disabled={!isNew}
            onClick={() => setV((s) => ({ ...s, type: o.t }))}
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition disabled:opacity-60",
              v.type === o.t && "border-accent ring-4 ring-accent/15",
            )}
          >
            <o.icon className="size-5 text-accent" />
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="grid gap-4 p-4 sm:grid-cols-2 md:p-5">
        <Field label="Name" htmlFor="name" required error={errors.name} className="sm:col-span-2">
          <Input id="name" value={v.name} onChange={set("name")} autoFocus={isNew} />
        </Field>
        <Field label="Code (SKU)" htmlFor="sku" required error={errors.sku}>
          <Input id="sku" value={v.sku} onChange={(e) => setV((s) => ({ ...s, sku: e.target.value.toUpperCase() }))} placeholder="e.g. PAP-A1R" />
        </Field>
        <Field label="Category" htmlFor="category">
          <Input id="category" list="item-categories" value={v.category} onChange={set("category")} />
          <datalist id="item-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Unit" htmlFor="unit" hint="each, roll, sheet, hour, stage…">
          <Input id="unit" value={v.unit} onChange={set("unit")} />
        </Field>
        <Field label="VAT rate %" htmlFor="vatRate" error={errors.vatRate}>
          <Input id="vatRate" inputMode="decimal" value={v.vatRate} onChange={num("vatRate")} />
        </Field>
        <Field label="Cost price (excl. VAT)" htmlFor="costPrice" error={errors.costPrice} hint={stock ? "Updated automatically as you buy (average cost)." : undefined}>
          <Input id="costPrice" inputMode="decimal" value={v.costPrice} onChange={num("costPrice")} placeholder="0.00" />
        </Field>
        <Field label="Selling price (excl. VAT)" htmlFor="sellPrice" error={errors.sellPrice} hint={sell > 0 ? `Margin ${margin.toFixed(0)}% · ${formatMoney(sell - cost)} per ${v.unit || "unit"}` : undefined}>
          <Input id="sellPrice" inputMode="decimal" value={v.sellPrice} onChange={num("sellPrice")} placeholder="0.00" />
        </Field>
        {stock ? (
          <>
            {isNew ? (
              <Field label="Opening quantity" htmlFor="openingQty" hint="How many you have right now.">
                <Input id="openingQty" inputMode="decimal" value={v.openingQty} onChange={num("openingQty")} />
              </Field>
            ) : null}
            <Field label="Reorder level" htmlFor="reorderLevel" hint="Warn me when stock falls to this.">
              <Input id="reorderLevel" inputMode="decimal" value={v.reorderLevel} onChange={num("reorderLevel")} />
            </Field>
            <Field label="Storage location" htmlFor="location">
              <Input id="location" value={v.location} onChange={set("location")} placeholder="e.g. Plot room" />
            </Field>
            <Field label="Barcode" htmlFor="barcode">
              <Input id="barcode" value={v.barcode} onChange={set("barcode")} inputMode="numeric" />
            </Field>
          </>
        ) : null}
        <Field label="Description" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" value={v.description} onChange={set("description")} className="min-h-20" />
        </Field>
      </Card>
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy}>
        <Save /> Save item
      </Button>
    </form>
  );
}
