import { Mail, MessageCircle, Phone } from "lucide-react";

/** One-tap call / WhatsApp / email — the phone is the office. */
export function QuickContact({ phone, email }: { phone?: string | null; email?: string | null }) {
  const digits = phone?.replace(/[^\d+]/g, "") ?? "";
  const wa = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
  const items = [
    phone ? { href: `tel:${digits}`, label: "Call", icon: Phone } : null,
    phone ? { href: `https://wa.me/${wa}`, label: "WhatsApp", icon: MessageCircle } : null,
    email ? { href: `mailto:${email}`, label: "Email", icon: Mail } : null,
  ].filter(Boolean) as { href: string; label: string; icon: typeof Phone }[];
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          target={i.href.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 rounded-2xl border bg-background py-3 text-xs font-medium transition hover:border-accent/50 active:scale-[0.97]"
        >
          <i.icon className="size-5 text-accent" />
          {i.label}
        </a>
      ))}
    </div>
  );
}
