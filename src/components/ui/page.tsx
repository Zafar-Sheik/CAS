import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="-ml-1 mb-1 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <div className="mb-1 text-xs font-semibold tracking-[0.14em] text-accent uppercase">{eyebrow}</div> : null}
        <h1 className="truncate text-2xl font-semibold md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card/50 px-6 py-14 text-center", className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="size-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function FilterChips({
  options,
  active,
  hrefFor,
}: {
  options: { value: string; label: string; count?: number }[];
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-0">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          scroll={false}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
            active === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined ? (
            <span className={cn("rounded-full px-1.5 text-xs", active === o.value ? "bg-primary-foreground/15" : "bg-muted")}>{o.count}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

/** Two-column label/value list for detail screens. */
export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y">
      {items.map((i) => (
        <div key={i.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="text-right font-medium break-words">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A tappable row used in mobile lists. */
export function ListRow({
  href,
  title,
  subtitle,
  right,
  rightSub,
  leading,
}: {
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-muted/60 active:bg-muted">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle ? <div className="truncate text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="shrink-0 text-right">
        {right ? <div className="font-semibold tabular">{right}</div> : null}
        {rightSub ? <div className="mt-0.5">{rightSub}</div> : null}
      </div>
    </Link>
  );
}

export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (p: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="rounded-xl border bg-card px-3 py-2 font-medium hover:bg-muted">
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className="rounded-xl border bg-card px-3 py-2 font-medium hover:bg-muted">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function buildHref(base: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
