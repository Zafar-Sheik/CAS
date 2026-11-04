import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: Tone; label: string }> = {
  DRAFT: { tone: "neutral", label: "Draft" },
  ISSUED: { tone: "info", label: "Unpaid" },
  POSTED: { tone: "info", label: "Unpaid" },
  PARTIAL: { tone: "warning", label: "Part paid" },
  PAID: { tone: "success", label: "Paid" },
  VOID: { tone: "danger", label: "Void" },
  OVERDUE: { tone: "danger", label: "Overdue" },
  SENT: { tone: "info", label: "Sent" },
  ACCEPTED: { tone: "success", label: "Accepted" },
  DECLINED: { tone: "danger", label: "Declined" },
  CONVERTED: { tone: "accent", label: "Invoiced" },
  ACTIVE: { tone: "success", label: "Active" },
  ON_HOLD: { tone: "warning", label: "On hold" },
  COMPLETE: { tone: "neutral", label: "Complete" },
  CANCELLED: { tone: "danger", label: "Cancelled" },
};

export function StatusBadge({ status, dueDate }: { status: string; dueDate?: Date | string }) {
  const overdue =
    dueDate && ["ISSUED", "PARTIAL", "POSTED"].includes(status) && new Date(dueDate) < new Date(new Date().toDateString());
  const s = overdue ? STATUS.OVERDUE : (STATUS[status] ?? { tone: "neutral" as Tone, label: status });
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
