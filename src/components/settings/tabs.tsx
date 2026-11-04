"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0">
      <div className="inline-flex gap-1 rounded-2xl border bg-card p-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} className={cn("relative rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap", active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {active ? <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-xl bg-primary" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
              <span className="relative">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
