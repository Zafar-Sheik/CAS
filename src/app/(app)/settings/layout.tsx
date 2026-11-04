import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page";
import { SettingsTabs } from "@/components/settings/tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const admin = can(user?.role, "settings:manage");
  const tabs = [
    ...(admin ? [{ href: "/settings", label: "Company" }] : []),
    { href: "/settings/security", label: "Security" },
    ...(can(user?.role, "users:manage") ? [{ href: "/settings/users", label: "Users" }] : []),
    ...(can(user?.role, "audit:view") ? [{ href: "/settings/audit", label: "Audit log" }] : []),
  ];
  return (
    <div>
      <PageHeader title="Settings" />
      <SettingsTabs tabs={tabs} />
      {children}
    </div>
  );
}
