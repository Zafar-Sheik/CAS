import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { getEditorData } from "@/server/editor-data";
import { PageHeader } from "@/components/ui/page";
import { DocumentEditor } from "@/components/documents/document-editor";
import { addDays, toDateInput } from "@/lib/utils";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "New quote" };

export default async function NewQuotePage(props: PageProps<"/quotes/new">) {
  await requirePermission("sales:write");
  const sp = await props.searchParams;
  const data = await getEditorData("quote");
  return (
    <div>
      <PageHeader title="New quote" back={{ href: "/quotes", label: "Quotes" }} />
      <DocumentEditor
        kind="quote"
        parties={data.parties}
        projects={data.projects}
        items={data.items}
        defaultVat={data.defaultVat}
        initial={{ partyId: str(sp, "customer"), projectId: str(sp, "project"), secondDate: toDateInput(addDays(new Date(), 30)) }}
      />
    </div>
  );
}
