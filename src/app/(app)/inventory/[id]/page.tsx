import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { PageHeader, DetailList } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdjustStock } from "@/components/inventory/adjust-stock";
import { ArchiveButton } from "@/components/contacts/archive-button";
import { formatMoney, formatQty, toNumber } from "@/lib/money";
import { formatDateTime, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Item" };

const MOVE_LABEL: Record<string, string> = {
  OPENING: "Opening balance",
  PURCHASE: "Bought",
  SALE: "Sold",
  ADJUSTMENT: "Adjustment",
  RETURN_IN: "Returned by customer",
  RETURN_OUT: "Returned to supplier",
  VOID_REVERSAL: "Reversal",
};

export default async function ItemPage(props: PageProps<"/inventory/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const item = await db.item.findUnique({ where: { id }, include: { movements: { orderBy: { createdAt: "desc" }, take: 100 } } });
  if (!item) notFound();
  const userIds = [...new Set(item.movements.map((m) => m.userId).filter(Boolean))] as string[];
  const users = new Map((await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const qty = toNumber(item.qtyOnHand);
  const reorder = toNumber(item.reorderLevel);
  const stock = item.type === "STOCK";
  const low = stock && qty <= reorder;
  const writer = can(user.role, "inventory:write");
  const sell = toNumber(item.sellPrice);
  const cost = toNumber(item.costPrice);

  return (
    <div>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        eyebrow={item.sku}
        title={item.name}
        description={item.category ?? undefined}
        actions={
          writer ? (
            <>
              {stock ? <AdjustStock itemId={item.id} current={qty} unit={item.unit} /> : null}
              <LinkButton variant="secondary" href={`/inventory/${item.id}/edit`}>
                <Pencil /> Edit
              </LinkButton>
              <ArchiveButton kind="item" id={item.id} active={item.active} />
            </>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {stock ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">On hand</div>
                <div className={cn("mt-1 text-2xl font-semibold tabular", low && (qty <= 0 ? "text-danger" : "text-warning"))}>
                  {formatQty(qty)} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                </div>
                {low ? <Badge tone={qty <= 0 ? "danger" : "warning"} className="mt-1">{qty <= 0 ? "Out of stock" : "Reorder now"}</Badge> : null}
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Value at cost</div>
                <div className="mt-1 text-2xl font-semibold tabular">{formatMoney(Math.max(0, qty) * cost)}</div>
              </Card>
              <Card className="col-span-2 p-4 sm:col-span-1">
                <div className="text-xs text-muted-foreground">Reorder level</div>
                <div className="mt-1 text-2xl font-semibold tabular">{formatQty(reorder)}</div>
              </Card>
            </div>
          ) : null}
          {stock ? (
            <Card>
              <CardHeader title="Stock card" description="Every movement, newest first" />
              <div className="mt-2 divide-y">
                {item.movements.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">No movements yet.</p>
                ) : (
                  item.movements.map((m) => {
                    const q = toNumber(m.quantity);
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", q >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                          {q >= 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {MOVE_LABEL[m.type]}
                            {m.reference ? ` · ${m.reference}` : ""}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {formatDateTime(m.createdAt)}
                            {m.userId ? ` · ${users.get(m.userId) ?? "user"}` : ""}
                            {m.note ? ` · ${m.note}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-sm font-semibold tabular", q >= 0 ? "text-success" : "text-danger")}>
                            {q >= 0 ? "+" : ""}
                            {formatQty(q)}
                          </div>
                          <div className="text-xs text-muted-foreground tabular">→ {formatQty(m.balance)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="h-2" />
            </Card>
          ) : (
            <Card>
              <CardBody className="text-sm text-muted-foreground">Services aren&apos;t counted, so there&apos;s no stock card. Add it to quotes and invoices like any item.</CardBody>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardBody>
            <DetailList
              items={[
                { label: "Type", value: stock ? "Stock item" : "Service" },
                { label: "Selling price", value: formatMoney(sell) },
                { label: "Cost price", value: formatMoney(cost) },
                { label: "Margin", value: sell > 0 ? `${(((sell - cost) / sell) * 100).toFixed(0)}%` : "—" },
                { label: "VAT", value: `${toNumber(item.vatRate)}%` },
                { label: "Unit", value: item.unit },
                ...(stock ? [{ label: "Location", value: item.location }, { label: "Barcode", value: item.barcode }] : []),
                { label: "Status", value: item.active ? "Active" : "Archived" },
              ]}
            />
            {item.description ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">{item.description}</p> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
