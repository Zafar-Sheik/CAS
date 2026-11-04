import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { ProjectForm } from "@/components/projects/project-form";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage(props: PageProps<"/projects/new">) {
  await requirePermission("projects:write");
  const sp = await props.searchParams;
  const customers = await db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div>
      <PageHeader title="New project" back={{ href: "/projects", label: "Projects" }} />
      <ProjectForm customers={customers} initial={{ customerId: str(sp, "customer") }} />
    </div>
  );
}
