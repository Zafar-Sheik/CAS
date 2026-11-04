"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setProjectStage } from "@/server/records";
import { STAGES, STAGE_LABEL, STAGE_HINT, type Stage } from "./stages";
import { cn } from "@/lib/utils";

export function StageStepper({ id, stage, editable }: { id: string; stage: Stage; editable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<Stage | null>(null);
  const current = STAGES.indexOf(stage);
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s}>
            <button
              type="button"
              disabled={!editable || active || pending !== null}
              onClick={async () => {
                setPending(s);
                const res = await setProjectStage(id, s);
                setPending(null);
                if (!res.ok) return toast.error(res.error);
                toast.success(`Moved to ${STAGE_LABEL[s]}`);
                router.refresh();
              }}
              className={cn(
                "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition sm:flex-col sm:items-start",
                active ? "border-accent bg-accent-soft" : "bg-card",
                editable && !active && "hover:border-accent/50",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  done ? "bg-success text-white" : active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold">{STAGE_LABEL[s]}</span>
                <span className="block text-xs text-muted-foreground">{STAGE_HINT[s]}</span>
              </span>
              {pending === s ? <motion.span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" initial={{ width: 0 }} animate={{ width: "100%" }} /> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
