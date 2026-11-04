"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Lock, MoreHorizontal, ShieldOff, Unlock, UserPlus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/form";
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/roles";
import { createUser, setUserRole, setUserBlocked, resetUserPassword, resetUserTwoFactor } from "@/server/admin";
import { formatDateTime, initials } from "@/lib/utils";
import type { ActionResult } from "@/server/action";

type U = { id: string; name: string; email: string; role: string; banned: boolean; twoFactorEnabled: boolean; lastActive: string | null };

function strongPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?";
  const arr = crypto.getRandomValues(new Uint32Array(16));
  let p = Array.from(arr, (n) => chars[n % chars.length]).join("");
  p = `Ca${p}7!`;
  return p;
}

export function UsersPanel({ users, meId, meRole }: { users: U[]; meId: string; meRole: Role }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [manage, setManage] = React.useState<U | null>(null);
  const run = async (fn: () => Promise<ActionResult>) => {
    const res = await fn();
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(res.message ?? "Done");
    router.refresh();
    return true;
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} people can sign in</p>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus /> Add user
        </Button>
      </div>
      <Card className="divide-y overflow-hidden">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials(u.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{u.name}</span>
                {u.id === meId ? <Badge>You</Badge> : null}
                {u.banned ? <Badge tone="danger">Blocked</Badge> : null}
                {!u.twoFactorEnabled ? <Badge tone="warning">No 2FA</Badge> : null}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {u.email} · {ROLE_LABELS[u.role as Role] ?? u.role}
                {u.lastActive ? ` · active ${formatDateTime(u.lastActive)}` : ""}
              </div>
            </div>
            {u.id !== meId && !(u.role === "owner" && meRole !== "owner") ? (
              <Button size="icon-sm" variant="ghost" aria-label={`Manage ${u.name}`} onClick={() => setManage(u)}>
                <MoreHorizontal />
              </Button>
            ) : null}
          </div>
        ))}
      </Card>
      <AddUserSheet open={addOpen} onClose={() => setAddOpen(false)} meRole={meRole} />
      {manage ? <ManageSheet user={manage} meRole={meRole} onClose={() => setManage(null)} run={run} /> : null}
    </div>
  );
}

function AddUserSheet({ open, onClose, meRole }: { open: boolean; onClose: () => void; meRole: Role }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("staff");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add user"
      description="They sign in with this email and a temporary password."
      footer={
        <Button
          className="w-full"
          size="lg"
          loading={busy}
          disabled={!name || !email || !password}
          onClick={async () => {
            setBusy(true);
            const res = await createUser({ name, email, role, password });
            setBusy(false);
            if (!res.ok) return toast.error(res.error);
            toast.success(res.message ?? "User added");
            setName("");
            setEmail("");
            setPassword("");
            onClose();
            router.refresh();
          }}
        >
          Add user
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" htmlFor="nu-name">
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="nu-email">
          <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" htmlFor="nu-role" hint={ROLE_DESCRIPTIONS[role]}>
          <Select id="nu-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.filter((r) => r !== "owner" || meRole === "owner").map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Temporary password" htmlFor="nu-pw" hint="12+ characters, mixed case, plus a number or symbol. Share it privately.">
          <div className="flex gap-2">
            <Input id="nu-pw" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
            <Button type="button" variant="secondary" size="icon" aria-label="Generate password" onClick={() => setPassword(strongPassword())}>
              <Wand2 />
            </Button>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

function ManageSheet({ user, meRole, onClose, run }: { user: U; meRole: Role; onClose: () => void; run: (fn: () => Promise<ActionResult>) => Promise<boolean> }) {
  const [role, setRole] = React.useState(user.role as Role);
  const [pw, setPw] = React.useState("");
  return (
    <Sheet open onClose={onClose} title={user.name} description={user.email}>
      <div className="space-y-5 pb-2">
        <div className="space-y-2">
          <Field label="Role" htmlFor="mu-role" hint={ROLE_DESCRIPTIONS[role]}>
            <Select id="mu-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.filter((r) => r !== "owner" || meRole === "owner").map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" disabled={role === user.role} onClick={() => run(() => setUserRole(user.id, role)).then((ok) => ok && onClose())}>
            Save role
          </Button>
        </div>
        <div className="space-y-2">
          <Field label="Set a new password" htmlFor="mu-pw" hint="Signs them out everywhere.">
            <div className="flex gap-2">
              <Input id="mu-pw" value={pw} onChange={(e) => setPw(e.target.value)} className="font-mono" />
              <Button type="button" variant="secondary" size="icon" aria-label="Generate password" onClick={() => setPw(strongPassword())}>
                <Wand2 />
              </Button>
            </div>
          </Field>
          <Button variant="secondary" disabled={!pw} onClick={() => run(() => resetUserPassword(user.id, pw)).then((ok) => ok && onClose())}>
            <KeyRound /> Reset password
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {user.twoFactorEnabled ? (
            <Button variant="secondary" onClick={() => run(() => resetUserTwoFactor(user.id)).then((ok) => ok && onClose())}>
              <ShieldOff /> Reset two-factor
            </Button>
          ) : null}
          <Button variant={user.banned ? "secondary" : "danger"} onClick={() => run(() => setUserBlocked(user.id, !user.banned)).then((ok) => ok && onClose())}>
            {user.banned ? <Unlock /> : <Lock />} {user.banned ? "Restore access" : "Block access"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
