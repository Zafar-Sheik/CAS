"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { saveCustomer, saveSupplier } from "@/server/records";

export type ContactInitial = {
  id?: string;
  code?: string;
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  creditLimit?: number;
  termsDays?: number;
  bankDetails?: string | null;
  notes?: string | null;
};

export function ContactForm({ kind, initial }: { kind: "customer" | "supplier"; initial?: ContactInitial }) {
  const router = useRouter();
  const [v, setV] = React.useState<ContactInitial>({ termsDays: 30, creditLimit: 0, ...initial });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof ContactInitial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const base = {
      id: v.id,
      code: v.code ?? "",
      name: v.name ?? "",
      contactName: v.contactName,
      email: v.email,
      phone: v.phone,
      vatNumber: v.vatNumber,
      address: v.address,
      termsDays: v.termsDays,
      notes: v.notes,
    };
    const res =
      kind === "customer"
        ? await saveCustomer({ ...base, creditLimit: v.creditLimit })
        : await saveSupplier({ ...base, bankDetails: v.bankDetails });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved");
    router.push(`/${kind === "customer" ? "debtors" : "creditors"}/${res.data!.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5" noValidate>
      <Card className="grid gap-4 p-4 sm:grid-cols-2 md:p-5">
        <Field label={kind === "customer" ? "Customer name" : "Supplier name"} htmlFor="name" required error={errors.name} className="sm:col-span-2">
          <Input id="name" value={v.name ?? ""} onChange={set("name")} autoFocus aria-invalid={!!errors.name} />
        </Field>
        <Field label="Contact person" htmlFor="contactName">
          <Input id="contactName" value={v.contactName ?? ""} onChange={set("contactName")} autoComplete="name" />
        </Field>
        <Field label="Account code" htmlFor="code" hint="Leave blank to generate one" error={errors.code}>
          <Input id="code" value={v.code ?? ""} onChange={set("code")} className="uppercase" />
        </Field>
        <Field label="Mobile / phone" htmlFor="phone">
          <Input id="phone" type="tel" inputMode="tel" value={v.phone ?? ""} onChange={set("phone")} autoComplete="tel" />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" inputMode="email" value={v.email ?? ""} onChange={set("email")} autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <Field label="VAT number" htmlFor="vatNumber">
          <Input id="vatNumber" value={v.vatNumber ?? ""} onChange={set("vatNumber")} />
        </Field>
        <Field label="Payment terms (days)" htmlFor="termsDays" error={errors.termsDays}>
          <Input id="termsDays" inputMode="numeric" value={String(v.termsDays ?? "")} onChange={(e) => setV((s) => ({ ...s, termsDays: Number(e.target.value.replace(/\D/g, "")) }))} />
        </Field>
        {kind === "customer" ? (
          <Field label="Credit limit (R)" htmlFor="creditLimit" hint="0 means no limit" error={errors.creditLimit}>
            <Input id="creditLimit" inputMode="decimal" value={String(v.creditLimit ?? "")} onChange={(e) => setV((s) => ({ ...s, creditLimit: e.target.value.replace(/[^\d.]/g, "") as unknown as number }))} />
          </Field>
        ) : null}
        <Field label="Address" htmlFor="address" className="sm:col-span-2">
          <Textarea id="address" value={v.address ?? ""} onChange={set("address")} className="min-h-20" />
        </Field>
        {kind === "supplier" ? (
          <Field label="Supplier's banking details" htmlFor="bankDetails" className="sm:col-span-2" hint="Check any change by phone before paying.">
            <Textarea id="bankDetails" value={v.bankDetails ?? ""} onChange={set("bankDetails")} className="min-h-20" />
          </Field>
        ) : null}
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" value={v.notes ?? ""} onChange={set("notes")} className="min-h-20" />
        </Field>
      </Card>
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy}>
        <Save /> Save {kind}
      </Button>
    </form>
  );
}
