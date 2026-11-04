import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { NAV_GROUPS } from "@/components/shell/nav";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  await requireUser();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Everything</h1>
      {NAV_GROUPS.filter((g) => g.label !== "Overview").map((g) => (
        <section key={g.label}>
          <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{g.label}</h2>
          <Card className="divide-y overflow-hidden">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
                  <i.icon className="size-[18px]" />
                </span>
                <span className="flex-1 font-medium">{i.label}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        </section>
      ))}
      <Card className="flex items-center justify-between p-4">
        <span className="font-medium">Appearance</span>
        <ThemeToggle />
      </Card>
    </div>
  );
}
