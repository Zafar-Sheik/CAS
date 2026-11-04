"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme";
import { saveSettings } from "@/server/admin";

type S = Record<string, string | number | boolean | null | Date>;

export function CompanyForm({ initial }: { initial: S }) {
  const router = useRouter();
  const [v, setV] = React.useState<S>(initial);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const text = (k: string) => ({
    id: k,
    value: (v[k] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value })),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveSettings(v as never);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast.error(res.error);
    }
    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      <Card>
        <CardHeader title="Company" description="Printed on invoices, quotes and statements" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Trading name" htmlFor="name" required error={errors.name}>
            <Input {...text("name")} />
          </Field>
          <Field label="Registered name" htmlFor="legalName">
            <Input {...text("legalName")} />
          </Field>
          <Field label="Company reg. no." htmlFor="regNumber">
            <Input {...text("regNumber")} />
          </Field>
          <Field label="VAT number" htmlFor="vatNumber" hint="Shown on tax invoices">
            <Input {...text("vatNumber")} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input {...text("email")} type="email" />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input {...text("phone")} type="tel" />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input {...text("website")} />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <Textarea {...text("address")} className="min-h-20" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Banking details" description="Clients pay into this account" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Bank" htmlFor="bankName">
            <Input {...text("bankName")} />
          </Field>
          <Field label="Account name" htmlFor="bankAccountName">
            <Input {...text("bankAccountName")} />
          </Field>
          <Field label="Account number" htmlFor="bankAccountNo">
            <Input {...text("bankAccountNo")} inputMode="numeric" />
          </Field>
          <Field label="Branch code" htmlFor="bankBranchCode">
            <Input {...text("bankBranchCode")} inputMode="numeric" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Documents & tax" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="VAT rate %" htmlFor="defaultVatRate" error={errors.defaultVatRate}>
            <Input id="defaultVatRate" inputMode="decimal" value={String(v.defaultVatRate ?? "")} onChange={(e) => setV((s) => ({ ...s, defaultVatRate: e.target.value }))} />
          </Field>
          <Field label="Default payment terms (days)" htmlFor="paymentTermDays">
            <Input id="paymentTermDays" inputMode="numeric" value={String(v.paymentTermDays ?? "")} onChange={(e) => setV((s) => ({ ...s, paymentTermDays: e.target.value }))} />
          </Field>
          <Field label="Invoice prefix" htmlFor="invoicePrefix" error={errors.invoicePrefix}>
            <Input {...text("invoicePrefix")} />
          </Field>
          <Field label="Quote prefix" htmlFor="quotePrefix" error={errors.quotePrefix}>
            <Input {...text("quotePrefix")} />
          </Field>
          <Field label="Invoice footer" htmlFor="invoiceFooter" className="sm:col-span-2">
            <Textarea {...text("invoiceFooter")} className="min-h-20" />
          </Field>
          <div className="sm:col-span-2">
            <Switch
              checked={Boolean(v.allowNegativeStock)}
              onChange={(c) => setV((s) => ({ ...s, allowNegativeStock: c }))}
              label="Allow selling more stock than on hand"
              description="Off is safer: issuing an invoice is blocked when stock would go negative."
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3.5 sm:col-span-2">
            <span className="text-sm font-medium">Appearance (this device)</span>
            <ThemeToggle />
          </div>
        </div>
      </Card>
      <Button type="submit" size="lg" loading={busy}>
        <Save /> Save settings
      </Button>
    </form>
  );
}
