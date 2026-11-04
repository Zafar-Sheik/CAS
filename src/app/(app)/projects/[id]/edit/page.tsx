import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage(props: PageProps<"/projects/[id]/edit">) {
  await requirePermission("projects:write");
  const { id } = await props.params;
  const [p, customers] = await Promise.all([
    db.project.findUnique({ where: { id } }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${p.name}`} back={{ href: `/projects/${id}`, label: "Back" }} />
      <ProjectForm
        customers={customers}
        initial={{ ...p, feeValue: toNumber(p.feeValue), startDate: p.startDate ? toDateInput(p.startDate) : null }}
      />
    </div>
  );
}
