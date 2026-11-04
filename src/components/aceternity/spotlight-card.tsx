"use client";
import * as React from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity-style "Card Spotlight": a copper glow follows the pointer. */
export function SpotlightCard({
  children,
  className,
  radius = 280,
}: {
  children: React.ReactNode;
  className?: string;
  radius?: number;
}) {
  const x = useMotionValue(-500);
  const y = useMotionValue(-500);
  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, color-mix(in oklab, var(--accent) 16%, transparent), transparent 80%)`;

  return (
    <div
      className={cn("group relative overflow-hidden rounded-3xl border bg-card", className)}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onPointerLeave={() => {
        x.set(-500);
        y.set(-500);
      }}
    >
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100" style={{ background }} />
      <div className="relative">{children}</div>
    </div>
  );
}
