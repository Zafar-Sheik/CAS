import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { getEditorData } from "@/server/editor-data";
import { PageHeader } from "@/components/ui/page";
import { DocumentEditor } from "@/components/documents/document-editor";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "Capture bill" };

export default async function NewBillPage(props: PageProps<"/bills/new">) {
  await requirePermission("purchases:write");
  const sp = await props.searchParams;
  const data = await getEditorData("bill");
  return (
    <div>
      <PageHeader title="Capture supplier bill" back={{ href: "/bills", label: "Bills" }} />
      <DocumentEditor
        kind="bill"
        parties={data.parties}
        items={data.items}
        defaultVat={data.defaultVat}
        categories={data.categories}
        initial={{ partyId: str(sp, "supplier") }}
      />
    </div>
  );
}
