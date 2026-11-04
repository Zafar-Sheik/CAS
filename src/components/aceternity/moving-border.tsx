"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity-style "Moving Border" — a copper light travelling round the edge. */
export function MovingBorderLink({
  href,
  children,
  className,
  duration = 3200,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  duration?: number;
}) {
  const pathRef = React.useRef<SVGRectElement>(null);
  const progress = useMotionValue(0);

  const pointAt = (v: number) => {
    try {
      return pathRef.current?.getPointAtLength(v) ?? { x: 0, y: 0 };
    } catch {
      return { x: 0, y: 0 }; // not laid out yet
    }
  };

  useAnimationFrame((time) => {
    let length = 0;
    try {
      length = pathRef.current?.getTotalLength() ?? 0;
    } catch {
      length = 0;
    }
    if (length) progress.set((time * (length / duration)) % length);
  });

  const x = useTransform(progress, (v) => pointAt(v).x);
  const y = useTransform(progress, (v) => pointAt(v).y);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <Link href={href} className={cn("relative inline-flex h-11 overflow-hidden rounded-xl p-[1.5px]", className)}>
      <div className="absolute inset-0">
        <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%">
          <rect fill="none" width="100%" height="100%" rx="12" ry="12" ref={pathRef} />
        </svg>
        <motion.div style={{ position: "absolute", top: 0, left: 0, display: "inline-block", transform }}>
          <div className="size-16 bg-[radial-gradient(var(--color-copper)_40%,transparent_60%)] opacity-90" />
        </motion.div>
      </div>
      <div className="relative flex h-full w-full items-center justify-center gap-2 rounded-[10.5px] bg-primary px-4 text-sm font-medium text-primary-foreground [&_svg]:size-4">
        {children}
      </div>
    </Link>
  );
}
