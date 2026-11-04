import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Plus, Package, Wrench } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, FilterChips, EmptyState, buildHref } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBox } from "@/components/ui/search-box";
import { formatMoney, formatQty, toNumber } from "@/lib/money";
import { str } from "@/lib/params";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const filter = str(sp, "filter") ?? "all";
  const category = str(sp, "category");
  const where: Prisma.ItemWhereInput = {
    active: filter !== "archived",
    ...(filter === "stock" || filter === "low" ? { type: "STOCK" } : filter === "services" ? { type: "SERVICE" } : {}),
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: { contains: q } }, { category: { contains: q } }] } : {}),
  };
  const [all, categories] = await Promise.all([
    db.item.findMany({ where, orderBy: [{ type: "asc" }, { name: "asc" }], take: 500 }),
    db.item.findMany({ distinct: ["category"], select: { category: true }, where: { category: { not: null }, active: true } }),
  ]);
  const isLow = (i: (typeof all)[number]) => i.type === "STOCK" && toNumber(i.qtyOnHand) <= toNumber(i.reorderLevel);
  const items = filter === "low" ? all.filter(isLow) : all;
  const stockItems = all.filter((i) => i.type === "STOCK");
  const value = stockItems.reduce((a, i) => a + Math.max(0, toNumber(i.qtyOnHand)) * toNumber(i.costPrice), 0);
  const lowCount = stockItems.filter(isLow).length;
  const href = (p: Record<string, string | undefined>) => buildHref("/inventory", { q, filter: filter === "all" ? undefined : filter, category, ...p });

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`${stockItems.length} stock items · ${formatMoney(value)} at cost${lowCount ? ` · ${lowCount} low` : ""}`}
        actions={can(user.role, "inventory:write") ? <LinkButton href="/inventory/new"><Plus /> New item</LinkButton> : null}
      />
      <div className="mb-4 space-y-3">
        <SearchBox placeholder="Search name, code or barcode" />
        <FilterChips
          options={[
            { value: "all", label: "Everything" },
            { value: "stock", label: "Stock" },
            { value: "low", label: "Low stock", count: lowCount },
            { value: "services", label: "Services" },
            { value: "archived", label: "Archived" },
          ]}
          active={filter}
          hrefFor={(v) => href({ filter: v === "all" ? undefined : v })}
        />
        {categories.length > 1 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0">
            <Link href={href({ category: undefined })} className={cn("h-8 shrink-0 rounded-full px-3 text-xs leading-8 font-medium", !category ? "bg-accent-soft text-accent" : "text-muted-foreground")}>
              All categories
            </Link>
            {categories.map((c) => (
              <Link
                key={c.category}
                href={href({ category: c.category! })}
                className={cn("h-8 shrink-0 rounded-full px-3 text-xs leading-8 font-medium", category === c.category ? "bg-accent-soft text-accent" : "text-muted-foreground")}
              >
                {c.category}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Boxes} title={filter === "low" ? "Nothing is running low" : "No items"} description="Stock items and services you sell appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => {
            const qty = toNumber(i.qtyOnHand);
            const reorder = toNumber(i.reorderLevel);
            const low = isLow(i);
            const pct = i.type === "STOCK" ? Math.min(100, reorder > 0 ? (qty / (reorder * 3)) * 100 : qty > 0 ? 100 : 0) : 0;
            return (
              <Link key={i.id} href={`/inventory/${i.id}`} className="block min-w-0 transition active:scale-[0.98]">
                <Card className="h-full p-4 transition hover:border-accent/40">
                  <div className="flex items-start gap-3">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", i.type === "STOCK" ? "bg-accent-soft text-accent" : "bg-info-soft text-info")}>
                      {i.type === "STOCK" ? <Package className="size-5" /> : <Wrench className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{i.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {i.sku}
                        {i.category ? ` · ${i.category}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold tabular">{formatMoney(i.sellPrice)}</div>
                  </div>
                  {i.type === "STOCK" ? (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className={cn("font-semibold tabular", low ? (qty <= 0 ? "text-danger" : "text-warning") : "")}>
                          {formatQty(qty)} {i.unit}
                        </span>
                        {low ? <Badge tone={qty <= 0 ? "danger" : "warning"}>{qty <= 0 ? "Out of stock" : "Reorder"}</Badge> : <span className="text-muted-foreground">reorder at {formatQty(reorder)}</span>}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", low ? (qty <= 0 ? "bg-danger" : "bg-warning") : "bg-success")} style={{ width: `${Math.max(pct, 3)}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-muted-foreground">Service · per {i.unit}</div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
