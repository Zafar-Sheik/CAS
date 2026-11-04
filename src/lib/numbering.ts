import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Counter = "nextInvoiceNo" | "nextQuoteNo" | "nextReceiptNo" | "nextBillNo" | "nextPaymentNo";

const PREFIX: Record<Counter, (s: { invoicePrefix: string; quotePrefix: string }) => string> = {
  nextInvoiceNo: (s) => s.invoicePrefix,
  nextQuoteNo: (s) => s.quotePrefix,
  nextReceiptNo: () => "REC",
  nextBillNo: () => "BIL",
  nextPaymentNo: () => "PAY",
};

/**
 * Atomically reserves the next document number inside a transaction.
 * The increment is a single UPDATE, so concurrent requests never share a number.
 */
export async function nextNumber(tx: Prisma.TransactionClient, counter: Counter) {
  const settings = await tx.companySettings.update({
    where: { id: 1 },
    data: { [counter]: { increment: 1 } },
  });
  const value = (settings[counter] as number) - 1;
  return `${PREFIX[counter](settings)}-${String(value).padStart(5, "0")}`;
}
