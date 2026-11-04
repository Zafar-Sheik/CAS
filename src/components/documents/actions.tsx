"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, FileCheck2, HandCoins, Pencil, Printer, Send, Share2, Trash2, Wallet, XCircle, ThumbsUp, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm";
import { Sheet } from "@/components/ui/sheet";
import { PaymentForm, type OpenDocOption } from "./payment-form";
import { issueInvoice, voidInvoice, deleteDraftInvoice, setQuoteStatus, convertQuote, deleteQuote } from "@/server/invoices";
import { postBill, voidBill, deleteDraftBill } from "@/server/bills";
import { reverseReceipt, reverseSupplierPayment } from "@/server/payments";
import type { ActionResult } from "@/server/action";

function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const exec = async <T,>(key: string, fn: () => Promise<ActionResult<T>>, after?: (r: ActionResult<T>) => void) => {
    setPending(key);
    const res = await fn();
    setPending(null);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(res.message ?? "Done");
    if (after) after(res);
    else router.refresh();
    return true;
  };
  return { pending, exec, router };
}

function ShareButton({ title, text }: { title: string; text: string }) {
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, text });
          } catch {
            /* cancelled */
          }
        } else {
          await navigator.clipboard.writeText(text);
          toast.success("Copied. Paste it into WhatsApp or email.");
        }
      }}
    >
      <Share2 /> Share
    </Button>
  );
}

export function InvoiceActions({
  id,
  status,
  canWrite,
  canVoid,
  hasPayments,
  shareText,
  title,
  customer,
  openDocs,
}: {
  id: string;
  status: string;
  canWrite: boolean;
  canVoid: boolean;
  hasPayments: boolean;
  shareText: string;
  title: string;
  customer: { id: string; name: string; code: string };
  openDocs: OpenDocOption[];
}) {
  const { pending, exec, router } = useAction();
  const [confirm, setConfirm] = React.useState<null | "issue" | "void" | "delete">(null);
  const [payOpen, setPayOpen] = React.useState(false);

  return (
    <>
      {status === "DRAFT" && canWrite ? (
        <>
          <Button variant="accent" onClick={() => setConfirm("issue")} loading={pending === "issue"}>
            <FileCheck2 /> Issue invoice
          </Button>
          <LinkButton variant="secondary" href={`/invoices/${id}/edit`}>
            <Pencil /> Edit
          </LinkButton>
          <Button variant="danger-ghost" onClick={() => setConfirm("delete")}>
            <Trash2 /> Delete
          </Button>
        </>
      ) : null}
      {["ISSUED", "PARTIAL"].includes(status) && canWrite ? (
        <Button variant="accent" onClick={() => setPayOpen(true)}>
          <HandCoins /> Record payment
        </Button>
      ) : null}
      {status !== "DRAFT" ? (
        <>
          <LinkButton variant="secondary" href={`/print/invoice/${id}`} target="_blank">
            <Printer /> PDF
          </LinkButton>
          <ShareButton title={title} text={shareText} />
        </>
      ) : null}
      {["ISSUED", "PARTIAL", "PAID"].includes(status) && canVoid && !hasPayments ? (
        <Button variant="danger-ghost" onClick={() => setConfirm("void")}>
          <Ban /> Void
        </Button>
      ) : null}

      <ConfirmSheet
        open={confirm === "issue"}
        onClose={() => setConfirm(null)}
        title="Issue this invoice?"
        description="It gets its permanent number, stock is deducted, and it can no longer be edited."
        confirmLabel="Issue invoice"
        onConfirm={() => exec("issue", () => issueInvoice(id))}
      />
      <ConfirmSheet
        open={confirm === "void"}
        onClose={() => setConfirm(null)}
        title="Void this invoice?"
        description="Stock is returned and the invoice stays on record as void. This can't be undone."
        confirmLabel="Void invoice"
        danger
        askReason
        onConfirm={(reason) => exec("void", () => voidInvoice(id, reason))}
      />
      <ConfirmSheet
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete this draft?"
        confirmLabel="Delete draft"
        danger
        onConfirm={() => exec("delete", () => deleteDraftInvoice(id), () => router.push("/invoices"))}
      />
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title="Record payment" description={customer.name}>
        <PaymentForm
          kind="receipt"
          parties={[customer]}
          openDocs={openDocs}
          initialPartyId={customer.id}
          initialDocId={id}
          onDone={() => setPayOpen(false)}
        />
      </Sheet>
    </>
  );
}

export function QuoteActions({
  id,
  status,
  canWrite,
  invoiceId,
  shareText,
  title,
}: {
  id: string;
  status: string;
  canWrite: boolean;
  invoiceId: string | null;
  shareText: string;
  title: string;
}) {
  const { pending, exec, router } = useAction();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  return (
    <>
      {canWrite && status !== "CONVERTED" ? (
        <>
          <Button
            variant="accent"
            loading={pending === "convert"}
            onClick={() => exec("convert", () => convertQuote(id), (r) => r.ok && router.push(`/invoices/${r.data!.id}`))}
          >
            <ArrowRightLeft /> Convert to invoice
          </Button>
          {status === "DRAFT" ? (
            <Button variant="secondary" loading={pending === "sent"} onClick={() => exec("sent", () => setQuoteStatus(id, "SENT"))}>
              <Send /> Mark sent
            </Button>
          ) : null}
          {status === "SENT" ? (
            <>
              <Button variant="secondary" loading={pending === "acc"} onClick={() => exec("acc", () => setQuoteStatus(id, "ACCEPTED"))}>
                <ThumbsUp /> Accepted
              </Button>
              <Button variant="secondary" loading={pending === "dec"} onClick={() => exec("dec", () => setQuoteStatus(id, "DECLINED"))}>
                <XCircle /> Declined
              </Button>
            </>
          ) : null}
          <LinkButton variant="secondary" href={`/quotes/${id}/edit`}>
            <Pencil /> Edit
          </LinkButton>
        </>
      ) : null}
      {invoiceId ? (
        <LinkButton variant="secondary" href={`/invoices/${invoiceId}`}>
          <CheckCircle2 /> View invoice
        </LinkButton>
      ) : null}
      <LinkButton variant="secondary" href={`/print/quote/${id}`} target="_blank">
        <Printer /> PDF
      </LinkButton>
      <ShareButton title={title} text={shareText} />
      {canWrite && status !== "CONVERTED" ? (
        <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> Delete
        </Button>
      ) : null}
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this quote?"
        confirmLabel="Delete quote"
        danger
        onConfirm={() => exec("delete", () => deleteQuote(id), () => router.push("/quotes"))}
      />
    </>
  );
}

export function BillActions({
  id,
  status,
  canWrite,
  canVoid,
  hasPayments,
  supplier,
  openDocs,
}: {
  id: string;
  status: string;
  canWrite: boolean;
  canVoid: boolean;
  hasPayments: boolean;
  supplier: { id: string; name: string; code: string };
  openDocs: OpenDocOption[];
}) {
  const { pending, exec, router } = useAction();
  const [confirm, setConfirm] = React.useState<null | "post" | "void" | "delete">(null);
  const [payOpen, setPayOpen] = React.useState(false);
  return (
    <>
      {status === "DRAFT" && canWrite ? (
        <>
          <Button variant="accent" onClick={() => setConfirm("post")} loading={pending === "post"}>
            <FileCheck2 /> Post bill
          </Button>
          <LinkButton variant="secondary" href={`/bills/${id}/edit`}>
            <Pencil /> Edit
          </LinkButton>
          <Button variant="danger-ghost" onClick={() => setConfirm("delete")}>
            <Trash2 /> Delete
          </Button>
        </>
      ) : null}
      {["POSTED", "PARTIAL"].includes(status) && canWrite ? (
        <Button variant="accent" onClick={() => setPayOpen(true)}>
          <Wallet /> Pay bill
        </Button>
      ) : null}
      {["POSTED", "PARTIAL", "PAID"].includes(status) && canVoid && !hasPayments ? (
        <Button variant="danger-ghost" onClick={() => setConfirm("void")}>
          <Ban /> Void
        </Button>
      ) : null}
      <ConfirmSheet
        open={confirm === "post"}
        onClose={() => setConfirm(null)}
        title="Post this bill?"
        description="It moves into creditors and any stock lines are received into inventory."
        confirmLabel="Post bill"
        onConfirm={() => exec("post", () => postBill(id))}
      />
      <ConfirmSheet
        open={confirm === "void"}
        onClose={() => setConfirm(null)}
        title="Void this bill?"
        description="Received stock is reversed. This can't be undone."
        confirmLabel="Void bill"
        danger
        askReason
        onConfirm={(reason) => exec("void", () => voidBill(id, reason))}
      />
      <ConfirmSheet
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete this draft?"
        confirmLabel="Delete draft"
        danger
        onConfirm={() => exec("delete", () => deleteDraftBill(id), () => router.push("/bills"))}
      />
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title="Pay bill" description={supplier.name}>
        <PaymentForm
          kind="supplier"
          parties={[supplier]}
          openDocs={openDocs}
          initialPartyId={supplier.id}
          initialDocId={id}
          onDone={() => setPayOpen(false)}
        />
      </Sheet>
    </>
  );
}

export function ReversePaymentButton({ id, kind, number }: { id: string; kind: "receipt" | "supplier"; number: string }) {
  const { exec } = useAction();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft"
        aria-label={`Reverse ${number}`}
      >
        Reverse
      </button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Reverse ${number}?`}
        description="The payment is removed and the documents it paid become unpaid again."
        confirmLabel="Reverse payment"
        danger
        onConfirm={() => exec("rev", () => (kind === "receipt" ? reverseReceipt(id) : reverseSupplierPayment(id)))}
      />
    </>
  );
}

export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent hover:underline">
      {children}
    </Link>
  );
}
