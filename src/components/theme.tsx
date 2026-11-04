"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Pref = "light" | "dark" | "system";

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

// Tiny store over the theme cookie so every toggle on screen stays in sync.
const listeners = new Set<() => void>();
function readPref(): Pref {
  const m = document.cookie.match(/(?:^|; )cas-theme=(light|dark)/);
  return (m?.[1] as Pref) ?? "system";
}
function writePref(p: Pref) {
  document.cookie =
    p === "system" ? "cas-theme=; path=/; max-age=0; samesite=lax" : `cas-theme=${p}; path=/; max-age=31536000; samesite=lax`;
  apply(p);
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Keeps the `dark` class in step with the saved preference or the OS setting. */
export function ThemeSync({ preference }: { preference: Pref }) {
  useEffect(() => {
    apply(preference);
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);
  return null;
}

export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as Pref);
  const opts: { v: Pref; icon: typeof Sun; label: string }[] = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "system", icon: Monitor, label: "System" },
    { v: "dark", icon: Moon, label: "Dark" },
  ];
  return (
    <div className={cn("inline-flex rounded-full border bg-muted/60 p-1", className)} role="radiogroup" aria-label="Theme">
      {opts.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={pref === v}
          aria-label={label}
          onClick={() => writePref(v)}
          className={cn(
            "grid size-8 place-items-center rounded-full text-muted-foreground transition",
            pref === v && "bg-card text-foreground shadow-sm",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
