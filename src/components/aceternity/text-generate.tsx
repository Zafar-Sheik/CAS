"use client";
import { motion, stagger, useAnimate, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** Aceternity-style "Text Generate Effect": words fade in from a blur. */
export function TextGenerate({ words, className }: { words: string; className?: string }) {
  const [scope, animate] = useAnimate();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    animate("span", { opacity: 1, filter: "blur(0px)" }, { duration: 0.5, delay: stagger(0.08) });
  }, [animate, reduce]);
  return (
    <span ref={scope} className={cn(className)}>
      {words.split(" ").map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          style={reduce ? undefined : { opacity: 0, filter: "blur(8px)" }}
          className="inline-block"
        >
          {w}&nbsp;
        </motion.span>
      ))}
    </span>
  );
}
