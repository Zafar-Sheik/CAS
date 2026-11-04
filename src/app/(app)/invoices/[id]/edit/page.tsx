import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { getEditorData, toInitialLines } from "@/server/editor-data";
import { PageHeader } from "@/components/ui/page";
import { DocumentEditor } from "@/components/documents/document-editor";
import { toDateInput } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage(props: PageProps<"/invoices/[id]/edit">) {
  await requirePermission("sales:write");
  const { id } = await props.params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!inv) notFound();
  if (inv.status !== "DRAFT") redirect(`/invoices/${id}`);
  const data = await getEditorData("invoice");
  return (
    <div>
      <PageHeader title="Edit draft invoice" back={{ href: `/invoices/${id}`, label: "Back" }} />
      <DocumentEditor
        kind="invoice"
        parties={data.parties}
        projects={data.projects}
        items={data.items}
        defaultVat={data.defaultVat}
        initial={{
          id: inv.id,
          partyId: inv.customerId,
          projectId: inv.projectId,
          issueDate: toDateInput(inv.issueDate),
          secondDate: toDateInput(inv.dueDate),
          reference: inv.reference,
          notes: inv.notes,
          lines: toInitialLines(inv.lines),
        }}
      />
    </div>
  );
}
