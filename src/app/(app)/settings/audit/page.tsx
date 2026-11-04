import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Pagination, buildHref } from "@/components/ui/page";
import { SearchBox } from "@/components/ui/search-box";
import { formatDateTime } from "@/lib/utils";
import { str, pageNum } from "@/lib/params";

export const metadata: Metadata = { title: "Audit log" };

const SIZE = 50;

export default async function AuditPage(props: PageProps<"/settings/audit">) {
  await requirePermission("audit:view");
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const page = pageNum(sp);
  const where = q ? { OR: [{ summary: { contains: q } }, { action: { contains: q } }, { user: { name: { contains: q } } }] } : {};
  const [rows, count] = await Promise.all([
    db.auditLog.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE }),
    db.auditLog.count({ where }),
  ]);
  return (
    <div className="max-w-4xl">
      <p className="mb-3 text-sm text-muted-foreground">Every change and sign-in, with who did it and from where. Entries can&apos;t be edited.</p>
      <SearchBox placeholder="Search activity" className="mb-4" />
      <Card className="divide-y overflow-hidden">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="w-36 shrink-0 text-xs text-muted-foreground tabular">{formatDateTime(r.createdAt)}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm">{r.summary}</div>
              <div className="text-xs text-muted-foreground">
                {r.user?.name ?? "System"} · <span className="font-mono">{r.action}</span>
                {r.ipAddress ? ` · ${r.ipAddress}` : ""}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No activity found.</p> : null}
      </Card>
      <Pagination page={page} pageCount={Math.ceil(count / SIZE)} hrefFor={(p) => buildHref("/settings/audit", { q, page: String(p) })} />
    </div>
  );
}
