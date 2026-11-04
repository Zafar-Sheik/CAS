"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound } from "lucide-react";
import { motion } from "motion/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function TwoFactorForm() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"totp" | "backup">("totp");
  const [code, setCode] = React.useState("");
  const [trust, setTrust] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    const res =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: value, trustDevice: trust })
        : await authClient.twoFactor.verifyBackupCode({ code: value.trim(), trustDevice: trust });
    if (res.error) {
      setBusy(false);
      setCode("");
      setError(res.error.status === 429 ? "Too many attempts. Wait a minute." : "That code didn't work. Try the newest one.");
      return;
    }
    const next = sessionStorage.getItem("cas-next") || "/dashboard";
    sessionStorage.removeItem("cas-next");
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        {mode === "totp" ? <ShieldCheck className="size-6" /> : <KeyRound className="size-6" />}
      </div>
      <h1 className="text-3xl font-semibold">Verify it&apos;s you</h1>
      <p className="mt-1.5 text-muted-foreground">
        {mode === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter one of the backup codes you saved. Each works once."}
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          verify(code);
        }}
      >
        {mode === "totp" ? (
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) verify(v);
            }}
            disabled={busy}
          />
        ) : (
          <Field label="Backup code" htmlFor="backup">
            <Input id="backup" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" autoFocus />
          </Field>
        )}
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Trust this device for 30 days
        </label>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length < 6}>
          Verify
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          className="font-medium text-accent"
          onClick={() => {
            setMode(mode === "totp" ? "backup" : "totp");
            setCode("");
            setError(null);
          }}
        >
          {mode === "totp" ? "Use a backup code" : "Use authenticator app"}
        </button>
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Start over
        </Link>
      </div>
    </motion.div>
  );
}

/** Six boxes, one hidden input — paste and SMS/OTP autofill both work. */
export function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        autoFocus
        disabled={disabled}
        aria-label="6-digit code"
        className="absolute inset-0 h-full w-full opacity-0"
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "grid h-14 place-items-center rounded-xl border bg-card text-xl font-semibold tabular transition",
              i === value.length && "border-accent ring-4 ring-accent/15",
            )}
          >
            {value[i] ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
