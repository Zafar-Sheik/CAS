"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Copy, KeyRound, Laptop, ShieldAlert, ShieldCheck, Smartphone, Download } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { OtpInput } from "@/app/login/two-factor/two-factor-form";
import { revokeMySession } from "@/server/admin";
import { formatDateTime } from "@/lib/utils";

type SessionRow = { id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; updatedAt: string };

function describeAgent(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const mobile = /iphone|android|mobile|ipad/i.test(ua);
  const os = /iphone|ipad/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /mac os/i.test(ua) ? "macOS" : /windows/i.test(ua) ? "Windows" : /linux/i.test(ua) ? "Linux" : "";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Browser";
  return { label: [browser, os].filter(Boolean).join(" on "), mobile };
}

export function SecurityPanel({
  user,
  required,
  prompt,
  sessions,
  currentSessionId,
}: {
  user: { name: string; email: string; twoFactorEnabled: boolean };
  required: boolean;
  prompt: boolean;
  sessions: SessionRow[];
  currentSessionId: string;
}) {
  return (
    <div className="max-w-3xl space-y-5">
      {prompt ? (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <ShieldAlert className="size-5 shrink-0 text-warning" />
          <div>
            <div className="font-semibold">Set up two-factor sign-in to continue</div>
            <p className="text-foreground/80">Your role can move money, so the studio requires a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) at sign-in.</p>
          </div>
        </motion.div>
      ) : null}
      <TwoFactorCard enabled={user.twoFactorEnabled} required={required} />
      <PasswordCard />
      <SessionsCard sessions={sessions} currentSessionId={currentSessionId} />
    </div>
  );
}

function TwoFactorCard({ enabled, required }: { enabled: boolean; required: boolean }) {
  const router = useRouter();
  const [step, setStep] = React.useState<"idle" | "password" | "scan" | "codes">("idle");
  const [password, setPassword] = React.useState("");
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState("");
  const [codes, setCodes] = React.useState<string[]>([]);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<"enable" | "disable" | "codes">("enable");

  async function start() {
    setBusy(true);
    if (mode === "enable") {
      const { data, error } = await authClient.twoFactor.enable({ password });
      setBusy(false);
      if (error || !data || !("totpURI" in data)) return toast.error(error?.message ?? "Couldn't start setup. Check your password.");
      setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 240 }));
      setSecret(new URL(data.totpURI).searchParams.get("secret") ?? "");
      setCodes(data.backupCodes);
      setStep("scan");
    } else if (mode === "disable") {
      const { error } = await authClient.twoFactor.disable({ password });
      setBusy(false);
      if (error) return toast.error(error.message ?? "Couldn't turn it off.");
      toast.success("Two-factor turned off");
      reset();
      router.refresh();
    } else {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
      setBusy(false);
      if (error || !data) return toast.error(error?.message ?? "Couldn't create codes.");
      setCodes(data.backupCodes);
      setStep("codes");
    }
  }

  async function verify(value: string) {
    setBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code: value });
    setBusy(false);
    if (error) {
      setCode("");
      return toast.error("That code didn't match. Try the newest one.");
    }
    toast.success("Two-factor is on");
    setStep("codes");
  }

  function reset() {
    setStep("idle");
    setPassword("");
    setCode("");
    setQr(null);
  }

  const download = () => {
    const blob = new Blob([`CAS ERP backup codes\nEach code works once.\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cas-backup-codes.txt";
    a.click();
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Two-factor sign-in {enabled ? <Badge tone="success">On</Badge> : <Badge tone="warning">Off</Badge>}
          </span>
        }
        description="A 6-digit code from your phone, on top of your password."
      />
      <CardBody>
        {step === "idle" ? (
          <div className="flex flex-wrap gap-2">
            {!enabled ? (
              <Button variant="accent" onClick={() => { setMode("enable"); setStep("password"); }}>
                <ShieldCheck /> Set up two-factor
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => { setMode("codes"); setStep("password"); }}>
                  <KeyRound /> New backup codes
                </Button>
                {!required ? (
                  <Button variant="danger-ghost" onClick={() => { setMode("disable"); setStep("password"); }}>
                    Turn off
                  </Button>
                ) : (
                  <p className="self-center text-xs text-muted-foreground">Required for your role.</p>
                )}
              </>
            )}
          </div>
        ) : null}

        {step === "password" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <Field label="Confirm your password" htmlFor="tf-pw">
              <Input id="tf-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={busy} disabled={!password}>
                Continue
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {step === "scan" && qr ? (
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto rounded-2xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code for your authenticator app" width={200} height={200} />
            </div>
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Open your authenticator app and scan the code.</li>
                <li>On this phone? Copy the setup key instead.</li>
                <li>Type the 6-digit code it shows.</li>
              </ol>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(secret).then(() => toast.success("Setup key copied"))}
                className="flex w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2 text-left font-mono text-xs break-all"
              >
                {secret}
                <Copy className="size-4 shrink-0" />
              </button>
              <OtpInput
                value={code}
                disabled={busy}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) verify(v);
                }}
              />
            </div>
          </div>
        ) : null}

        {step === "codes" ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">Save these backup codes somewhere safe.</span> If you lose your phone, each one lets you sign in once.
              They won&apos;t be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-3 font-mono text-sm">
              {codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={download}>
                <Download /> Download
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => toast.success("Copied"))}>
                <Copy /> Copy
              </Button>
              <Button
                type="button"
                onClick={() => {
                  reset();
                  router.replace("/settings/security");
                  router.refresh();
                }}
              >
                I&apos;ve saved them
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const checks = [
    { ok: next.length >= 12, label: "12+ characters" },
    { ok: /[a-z]/.test(next) && /[A-Z]/.test(next), label: "Upper and lower case" },
    { ok: /\d/.test(next) || /[^A-Za-z0-9]/.test(next), label: "A number or symbol" },
    { ok: next.length > 0 && next === confirm, label: "Matches" },
  ];
  const valid = checks.every((c) => c.ok);
  return (
    <Card>
      <CardHeader title="Password" description="Changing it signs out your other devices." />
      <CardBody>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
            setBusy(false);
            if (error)
              return toast.error(
                error.code === "PASSWORD_COMPROMISED" ? "That password appears in a known data breach. Choose another." : (error.message ?? "Couldn't change password."),
              );
            toast.success("Password changed. Other devices were signed out.");
            setCurrent("");
            setNext("");
            setConfirm("");
          }}
        >
          <Field label="Current password" htmlFor="pw-current" className="sm:col-span-2">
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" htmlFor="pw-new">
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm">
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {checks.map((c) => (
              <Badge key={c.label} tone={c.ok ? "success" : "neutral"}>
                {c.label}
              </Badge>
            ))}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy} disabled={!current || !valid}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function SessionsCard({ sessions, currentSessionId }: { sessions: SessionRow[]; currentSessionId: string }) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Signed-in devices" description="Sign out anything you don't recognise." />
      <div className="mt-2 divide-y">
        {sessions.map((s) => {
          const d = describeAgent(s.userAgent);
          const current = s.id === currentSessionId;
          return (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                {d.mobile ? <Smartphone className="size-5" /> : <Laptop className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {d.label} {current ? <Badge tone="success">This device</Badge> : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.ipAddress ?? "Unknown IP"} · active {formatDateTime(s.updatedAt)}
                </div>
              </div>
              {!current ? (
                <Button
                  size="sm"
                  variant="danger-ghost"
                  onClick={async () => {
                    const res = await revokeMySession(s.id);
                    if (!res.ok) return toast.error(res.error);
                    toast.success("Device signed out");
                    router.refresh();
                  }}
                >
                  Sign out
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="h-2" />
    </Card>
  );
}
