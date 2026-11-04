"use client";
import * as React from "react";
import { Sheet } from "./sheet";
import { Button } from "./button";
import { Field, Textarea } from "./form";

/** Confirmation sheet, optionally asking for a reason (used for voids). */
export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  askReason,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  askReason?: boolean;
  onConfirm: (reason: string) => Promise<boolean | void>;
}) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            loading={busy}
            disabled={askReason && reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              const keepOpen = (await onConfirm(reason)) === false;
              setBusy(false);
              if (!keepOpen) {
                setReason("");
                onClose();
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {askReason ? (
        <Field label="Reason" htmlFor="confirm-reason" hint="Saved in the audit log.">
          <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      ) : (
        <div className="h-2" />
      )}
    </Sheet>
  );
}
