import "server-only";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

type Settings = {
  name: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNo: string | null;
  bankBranchCode: string | null;
  phone: string | null;
  email: string | null;
};

export function shareTextFor(
  doc: { kind: "Invoice" | "Quote"; number: string; total: unknown; balance?: number; date: Date; dueLabel: string },
  s: Settings,
) {
  const lines = [
    `${s.name}`,
    `${doc.kind} ${doc.number}`,
    `Amount: ${formatMoney(doc.balance ?? (doc.total as number))}`,
    `${doc.dueLabel}: ${formatDate(doc.date)}`,
  ];
  if (doc.kind === "Invoice" && s.bankAccountNo) {
    lines.push("", "Banking details:", `${s.bankAccountName ?? s.name}`, `${s.bankName ?? ""} ${s.bankAccountNo}`.trim());
    if (s.bankBranchCode) lines.push(`Branch code ${s.bankBranchCode}`);
    lines.push(`Reference: ${doc.number}`);
  }
  if (s.phone || s.email) lines.push("", [s.phone, s.email].filter(Boolean).join(" · "));
  return lines.join("\n");
}
