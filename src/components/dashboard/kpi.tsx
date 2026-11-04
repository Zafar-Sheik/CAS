"use client";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { SpotlightCard } from "@/components/aceternity/spotlight-card";
import { AnimatedNumber } from "@/components/aceternity/animated-number";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

const fmtFull = (n: number) => formatMoney(Math.round(n));
const fmtCompact = (n: number) => formatMoneyCompact(n);

export function KpiCard({
  label,
  value,
  sub,
  href,
  trend,
  tone,
  index = 0,
  compact,
}: {
  label: string;
  value: number;
  sub?: string;
  href: string;
  trend?: number | null;
  tone?: "danger" | "warning" | "accent";
  index?: number;
  compact?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.4 }}>
      <Link href={href} className="block h-full rounded-3xl active:scale-[0.98] transition">
        <SpotlightCard className="h-full p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground md:text-sm">{label}</span>
            {tone ? (
              <span
                className={cn(
                  "size-2 rounded-full",
                  tone === "danger" && "bg-danger",
                  tone === "warning" && "bg-warning",
                  tone === "accent" && "bg-accent",
                )}
              />
            ) : null}
          </div>
          <AnimatedNumber
            value={value}
            format={compact ? fmtCompact : fmtFull}
            className="mt-2 block truncate text-xl font-semibold tracking-tight tabular md:text-2xl"
          />
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {trend !== undefined && trend !== null ? (
              <span className={cn("inline-flex items-center font-semibold", trend >= 0 ? "text-success" : "text-danger")}>
                {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(trend).toFixed(0)}%
              </span>
            ) : null}
            <span className="truncate">{sub}</span>
          </div>
        </SpotlightCard>
      </Link>
    </motion.div>
  );
}
