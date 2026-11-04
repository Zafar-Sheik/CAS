import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { getEditorData } from "@/server/editor-data";
import { PageHeader } from "@/components/ui/page";
import { DocumentEditor } from "@/components/documents/document-editor";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage(props: PageProps<"/invoices/new">) {
  await requirePermission("sales:write");
  const sp = await props.searchParams;
  const data = await getEditorData("invoice");
  return (
    <div>
      <PageHeader title="New invoice" back={{ href: "/invoices", label: "Invoices" }} />
      <DocumentEditor
        kind="invoice"
        parties={data.parties}
        projects={data.projects}
        items={data.items}
        defaultVat={data.defaultVat}
        initial={{ partyId: str(sp, "customer"), projectId: str(sp, "project") }}
      />
    </div>
  );
}
