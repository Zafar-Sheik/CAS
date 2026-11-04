"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity-style "Card Hover Effect": a highlight slides between tiles. */
export function HoverGrid({
  items,
  className,
}: {
  items: { href: string; title: string; description: string; icon: React.ReactNode }[];
  className?: string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  return (
    <div className={cn("grid grid-cols-2 gap-1 lg:grid-cols-4", className)}>
      {items.map((item, idx) => (
        <Link
          key={item.href}
          href={item.href}
          className="relative block rounded-2xl p-1"
          onMouseEnter={() => setHovered(idx)}
          onMouseLeave={() => setHovered(null)}
        >
          <AnimatePresence>
            {hovered === idx ? (
              <motion.span
                className="absolute inset-0 block rounded-[20px] bg-accent-soft"
                layoutId="hover-grid-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.1 } }}
              />
            ) : null}
          </AnimatePresence>
          <div className="relative z-10 flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition active:scale-[0.98]">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5">
              {item.icon}
            </div>
            <div>
              <div className="font-semibold">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
