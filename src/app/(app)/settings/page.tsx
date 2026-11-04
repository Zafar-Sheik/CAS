import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { getSettings } from "@/server/queries";
import { toNumber } from "@/lib/money";
import { CompanyForm } from "@/components/settings/company-form";

export const metadata: Metadata = { title: "Company settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "settings:manage")) redirect("/settings/security");
  const s = await getSettings();
  return <CompanyForm initial={{ ...s, defaultVatRate: toNumber(s.defaultVatRate) }} />;
}
