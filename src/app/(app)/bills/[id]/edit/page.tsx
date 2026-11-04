import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { getEditorData, toInitialLines } from "@/server/editor-data";
import { PageHeader } from "@/components/ui/page";
import { DocumentEditor } from "@/components/documents/document-editor";
import { toDateInput } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit bill" };

export default async function EditBillPage(props: PageProps<"/bills/[id]/edit">) {
  await requirePermission("purchases:write");
  const { id } = await props.params;
  const b = await db.bill.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!b) notFound();
  if (b.status !== "DRAFT") redirect(`/bills/${id}`);
  const data = await getEditorData("bill");
  return (
    <div>
      <PageHeader title="Edit draft bill" back={{ href: `/bills/${id}`, label: "Back" }} />
      <DocumentEditor
        kind="bill"
        parties={data.parties}
        items={data.items}
        defaultVat={data.defaultVat}
        categories={data.categories}
        initial={{
          id: b.id,
          partyId: b.supplierId,
          issueDate: toDateInput(b.issueDate),
          secondDate: toDateInput(b.dueDate),
          reference: b.supplierRef,
          category: b.category,
          notes: b.notes,
          lines: toInitialLines(b.lines),
        }}
      />
    </div>
  );
}
