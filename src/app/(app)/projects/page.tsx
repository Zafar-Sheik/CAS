import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, MapPin, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, FilterChips, EmptyState, buildHref } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { SearchBox } from "@/components/ui/search-box";
import { STAGES, STAGE_LABEL } from "@/components/projects/stages";
import { formatMoney, toNumber } from "@/lib/money";
import { str } from "@/lib/params";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const stage = str(sp, "stage") ?? "all";
  const where: Prisma.ProjectWhereInput = {
    ...(stage !== "all" && (STAGES as readonly string[]).includes(stage) ? { stage: stage as never } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
  };
  const projects = await db.project.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      invoices: { where: { status: { in: ["ISSUED", "PARTIAL", "PAID"] } }, select: { subtotal: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every job, from first sketch to completion"
        actions={can(user.role, "projects:write") ? <LinkButton href="/projects/new"><Plus /> New project</LinkButton> : null}
      />
      <div className="mb-4 space-y-3">
        <SearchBox placeholder="Search projects or clients" />
        <FilterChips
          options={[{ value: "all", label: "All" }, ...STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))]}
          active={stage}
          hrefFor={(v) => buildHref("/projects", { q, stage: v === "all" ? undefined : v })}
        />
      </div>
      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects" description="Create a project to link quotes and invoices to a job." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const billed = p.invoices.reduce((a, i) => a + toNumber(i.subtotal), 0);
            const fee = toNumber(p.feeValue);
            const pct = fee > 0 ? Math.min(100, (billed / fee) * 100) : 0;
            const stageIdx = STAGES.indexOf(p.stage);
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="block min-w-0 transition active:scale-[0.98]">
                <Card className="h-full p-4 transition hover:border-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold tracking-wide text-accent uppercase">{p.code}</div>
                      <div className="truncate text-base font-semibold">{p.name}</div>
                      <div className="truncate text-sm text-muted-foreground">{p.customer.name}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.location ? (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {p.location}
                      {p.sizeM2 ? ` · ${p.sizeM2} m²` : ""}
                    </div>
                  ) : null}
                  <div className="mt-3 flex gap-1" aria-label={`Stage: ${STAGE_LABEL[p.stage]}`}>
                    {STAGES.slice(0, 4).map((s, i) => (
                      <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= stageIdx ? "bg-accent" : "bg-muted"}`} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs">
                    <span className="font-medium">{STAGE_LABEL[p.stage]}</span>
                    <span className="text-muted-foreground tabular">
                      {formatMoney(billed)} of {formatMoney(fee)} billed ({pct.toFixed(0)}%)
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
