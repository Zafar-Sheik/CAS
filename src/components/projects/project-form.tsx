"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveProject } from "@/server/records";
import { STAGES, STAGE_LABEL } from "./stages";

export type ProjectInitial = {
  id?: string;
  code?: string;
  name?: string;
  customerId?: string;
  sector?: string | null;
  location?: string | null;
  sizeM2?: number | null;
  stage?: string;
  status?: string;
  feeValue?: number;
  startDate?: string | null;
  notes?: string | null;
};

export function ProjectForm({ customers, initial }: { customers: { id: string; name: string }[]; initial?: ProjectInitial }) {
  const router = useRouter();
  const [v, setV] = React.useState<Record<string, string>>({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    customerId: initial?.customerId ?? "",
    sector: initial?.sector ?? "",
    location: initial?.location ?? "",
    sizeM2: initial?.sizeM2 ? String(initial.sizeM2) : "",
    stage: initial?.stage ?? "DISCOVERY",
    status: initial?.status ?? "ACTIVE",
    feeValue: initial?.feeValue ? String(initial.feeValue) : "",
    startDate: initial?.startDate ?? "",
    notes: initial?.notes ?? "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveProject({
      id: initial?.id,
      code: v.code,
      name: v.name,
      customerId: v.customerId,
      sector: v.sector,
      location: v.location,
      sizeM2: v.sizeM2 ? (v.sizeM2 as unknown as number) : null,
      stage: v.stage as never,
      status: v.status as never,
      feeValue: (v.feeValue || 0) as unknown as number,
      startDate: v.startDate ? (v.startDate as unknown as Date) : null,
      notes: v.notes,
    });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast.error(res.error);
    }
    toast.success(res.message ?? "Saved");
    router.push(`/projects/${res.data!.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5" noValidate>
      <Card className="grid gap-4 p-4 sm:grid-cols-2 md:p-5">
        <Field label="Project name" htmlFor="name" required error={errors.name} className="sm:col-span-2">
          <Input id="name" value={v.name} onChange={set("name")} autoFocus={!initial?.id} placeholder="e.g. House Nene" />
        </Field>
        <Field label="Client" htmlFor="customerId" required error={errors.customerId} className="sm:col-span-2">
          <Select id="customerId" value={v.customerId} onChange={set("customerId")}>
            <option value="">Choose a client…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sector" htmlFor="sector">
          <Input id="sector" list="sectors" value={v.sector} onChange={set("sector")} />
          <datalist id="sectors">
            {["Residential", "Student living", "Lifestyle commercial", "Additions & alterations", "Interior", "Commercial"].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Location" htmlFor="location">
          <Input id="location" value={v.location} onChange={set("location")} />
        </Field>
        <Field label="Size (m²)" htmlFor="sizeM2">
          <Input id="sizeM2" inputMode="numeric" value={v.sizeM2} onChange={(e) => setV((s) => ({ ...s, sizeM2: e.target.value.replace(/\D/g, "") }))} />
        </Field>
        <Field label="Total fee (excl. VAT)" htmlFor="feeValue" error={errors.feeValue}>
          <Input id="feeValue" inputMode="decimal" value={v.feeValue} onChange={(e) => setV((s) => ({ ...s, feeValue: e.target.value.replace(/[^\d.]/g, "") }))} />
        </Field>
        <Field label="Stage" htmlFor="stage">
          <Select id="stage" value={v.stage} onChange={set("stage")}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={v.status} onChange={set("status")}>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETE">Complete</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>
        <Field label="Start date" htmlFor="startDate">
          <Input id="startDate" type="date" value={v.startDate} onChange={set("startDate")} />
        </Field>
        <Field label="Project code" htmlFor="code" hint="Leave blank to generate">
          <Input id="code" value={v.code} onChange={set("code")} />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" value={v.notes} onChange={set("notes")} />
        </Field>
      </Card>
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy}>
        <Save /> Save project
      </Button>
    </form>
  );
}
