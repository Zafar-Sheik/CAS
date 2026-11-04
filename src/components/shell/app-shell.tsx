"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Search, LayoutDashboard, FileText, Boxes, Menu, LogOut, ShieldCheck, Loader2, CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import { NAV_GROUPS, QUICK_ACTIONS } from "./nav";
import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme";
import { authClient } from "@/lib/auth-client";
import { can, ROLE_LABELS, type Role } from "@/lib/roles";
import { cn, initials } from "@/lib/utils";
import { globalSearch, type SearchHit } from "@/server/search";

type ShellUser = { name: string; email: string; role: Role };

const isActive = (pathname: string, href: string) =>
  href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("relative block h-6 w-[68px]", className)}>
      <Image src="/brand/cas-logo-dark.png" alt="CAS" fill sizes="68px" className="object-contain dark:hidden" priority />
      <Image src="/brand/cas-logo-light.png" alt="CAS" fill sizes="68px" className="hidden object-contain dark:block" priority />
    </span>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const actions = QUICK_ACTIONS.filter((a) => !a.permission || can(user.role, a.permission));

  return (
    <div className="min-h-dvh lg:pl-72">
      {/* ── Desktop sidebar ───────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r bg-card/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-3 px-6">
          <Logo />
          <span className="text-xs font-medium text-muted-foreground">Studio ERP</span>
        </div>
        <div className="px-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-10 w-full items-center gap-2 rounded-xl border bg-background px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <Search className="size-4" />
            Search everything
            <kbd className="ml-auto rounded-md border bg-card px-1.5 text-[10px] font-semibold">⌘K</kbd>
          </button>
        </div>
        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                      active ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    ) : null}
                    <item.icon className="relative size-[18px]" />
                    <span className="relative">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t p-4">
          <button
            onClick={() => setQuickOpen(true)}
            className="mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition hover:brightness-110"
          >
            <Plus className="size-4" /> Create
          </button>
          <UserCard user={user} />
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────── */}
      <header className="pt-safe sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <button
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <Search className="size-5" />
            </button>
            <button
              aria-label="Account"
              onClick={() => setMenuOpen(true)}
              className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {initials(user.name)}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 pt-5 pb-32 md:px-6 lg:px-10 lg:pt-8 lg:pb-12">{children}</main>

      {/* ── Mobile bottom dock ───────────────────── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/85 pb-safe backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          <DockLink href="/dashboard" label="Home" icon={LayoutDashboard} active={isActive(pathname, "/dashboard")} />
          <DockLink
            href="/invoices"
            label="Sales"
            icon={FileText}
            active={["/invoices", "/quotes", "/debtors"].some((h) => isActive(pathname, h))}
          />
          <div className="flex justify-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setQuickOpen(true)}
              aria-label="Create"
              className="-mt-7 grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-xl ring-4 shadow-accent/30 ring-background"
            >
              <Plus className="size-7" />
            </motion.button>
          </div>
          <DockLink href="/inventory" label="Stock" icon={Boxes} active={isActive(pathname, "/inventory")} />
          <DockLink
            href="/more"
            label="More"
            icon={Menu}
            active={["/more", "/bills", "/creditors", "/projects", "/reports", "/settings"].some((h) => isActive(pathname, h))}
          />
        </div>
      </nav>

      {/* ── Quick create ─────────────────────────── */}
      <Sheet open={quickOpen} onClose={() => setQuickOpen(false)} title="Create" description="What do you want to do?">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {actions.map((a, i) => (
            <motion.div key={a.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link
                href={a.href}
                onClick={() => setQuickOpen(false)}
                className="flex h-full flex-col gap-2.5 rounded-2xl border bg-background p-3.5 transition active:scale-[0.97] hover:border-accent/50"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <a.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{a.label}</span>
                  <span className="block text-xs text-muted-foreground">{a.description}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </Sheet>

      {/* ── Account menu (mobile) ────────────────── */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Account">
        <div className="space-y-3 pb-2">
          <UserCard user={user} onNavigate={() => setMenuOpen(false)} />
          <div className="flex items-center justify-between rounded-2xl border p-3">
            <span className="text-sm font-medium">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </Sheet>

      {searchOpen ? <SearchPalette onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}

function DockLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Plus; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium transition",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {active ? (
        <motion.span layoutId="dock-active" className="absolute -top-px h-0.5 w-8 rounded-full bg-accent" />
      ) : null}
      <Icon className={cn("size-[22px]", active && "text-accent")} />
      {label}
    </Link>
  );
}

function UserCard({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex items-center gap-3">
      <Link href="/settings/security" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-muted">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials(user.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <ShieldCheck className="size-3" /> {ROLE_LABELS[user.role]}
          </span>
        </span>
      </Link>
      <button
        aria-label="Sign out"
        title="Sign out"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await authClient.signOut();
          toast.success("Signed out");
          router.replace("/login");
          router.refresh();
        }}
        className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-danger-soft hover:text-danger"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      </button>
    </div>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const open = true;
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [result, setResult] = React.useState<{ q: string; hits: SearchHit[] }>({ q: "", hits: [] });
  const [index, setIndex] = React.useState(0);
  const term = q.trim();
  const hits = term.length >= 2 ? result.hits : [];
  const loading = term.length >= 2 && result.q !== term;

  React.useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await globalSearch(term);
      if (cancelled) return;
      setResult({ q: term, hits: res });
      setIndex(0);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  const go = (h: SearchHit) => {
    onClose();
    router.push(h.href);
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border bg-card shadow-2xl"
            role="dialog"
            aria-label="Search"
          >
            <div className="flex items-center gap-3 border-b px-4">
              {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <Search className="size-5 text-muted-foreground" />}
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  if (e.key === "ArrowDown") setIndex((i) => Math.min(i + 1, hits.length - 1));
                  if (e.key === "ArrowUp") setIndex((i) => Math.max(i - 1, 0));
                  if (e.key === "Enter" && hits[index]) go(hits[index]);
                }}
                placeholder="Invoices, customers, stock, projects…"
                className="h-14 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
              />
              <button onClick={onClose} className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted">
                Esc
              </button>
            </div>
            <div className="max-h-[60dvh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Type at least two letters.</p>
              ) : !loading && hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</p>
              ) : (
                hits.map((h, i) => (
                  <button
                    key={h.href}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(h)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === index && "bg-muted")}
                  >
                    <span className="w-16 shrink-0 text-[11px] font-semibold tracking-wide text-accent uppercase">{h.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{h.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span>
                    </span>
                    {i === index ? <CornerDownLeft className="size-4 text-muted-foreground" /> : null}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
