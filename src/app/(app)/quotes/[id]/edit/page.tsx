import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { getEditorData, toInitialLines } from "@/server/editor-data";
import { PageHeader } from "@/components/ui/page";
import { DocumentEditor } from "@/components/documents/document-editor";
import { toDateInput } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit quote" };

export default async function EditQuotePage(props: PageProps<"/quotes/[id]/edit">) {
  await requirePermission("sales:write");
  const { id } = await props.params;
  const q = await db.quote.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!q) notFound();
  if (q.status === "CONVERTED") redirect(`/quotes/${id}`);
  const data = await getEditorData("quote");
  return (
    <div>
      <PageHeader title={`Edit ${q.number}`} back={{ href: `/quotes/${id}`, label: "Back" }} />
      <DocumentEditor
        kind="quote"
        parties={data.parties}
        projects={data.projects}
        items={data.items}
        defaultVat={data.defaultVat}
        initial={{
          id: q.id,
          partyId: q.customerId,
          projectId: q.projectId,
          issueDate: toDateInput(q.issueDate),
          secondDate: toDateInput(q.expiryDate),
          reference: q.reference,
          notes: q.notes,
          lines: toInitialLines(q.lines),
        }}
      />
    </div>
  );
}
