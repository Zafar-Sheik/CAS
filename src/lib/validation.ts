import { z } from "zod";

const trimmed = (max = 191) => z.string().trim().max(max);
const optionalText = (max = 191) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const money = z.coerce.number().finite().min(0, "Must be zero or more").max(999_999_999_999);
const qty = z.coerce.number().finite().max(999_999_999);
const pct = z.coerce.number().finite().min(0).max(100);
const dateStr = z.coerce.date({ message: "Enter a valid date" });
const id = z.string().trim().min(1).max(64);

export const customerSchema = z.object({
  id: id.optional(),
  code: trimmed(32).optional().transform((v) => v || undefined),
  name: trimmed().min(2, "Enter the customer's name"),
  contactName: optionalText(),
  email: z
    .string()
    .trim()
    .max(191)
    .optional()
    .nullable()
    .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email")
    .transform((v) => v || null),
  phone: optionalText(64),
  vatNumber: optionalText(64),
  address: optionalText(1000),
  creditLimit: money.default(0),
  termsDays: z.coerce.number().int().min(0).max(365).default(30),
  notes: optionalText(4000),
});
export type CustomerInput = z.input<typeof customerSchema>;

export const supplierSchema = customerSchema.omit({ creditLimit: true }).extend({
  name: trimmed().min(2, "Enter the supplier's name"),
  bankDetails: optionalText(1000),
});
export type SupplierInput = z.input<typeof supplierSchema>;

export const itemSchema = z.object({
  id: id.optional(),
  sku: trimmed(64).min(1, "Enter a code (SKU)"),
  name: trimmed().min(2, "Enter a name"),
  description: optionalText(2000),
  type: z.enum(["STOCK", "SERVICE"]),
  category: optionalText(64),
  unit: trimmed(16).min(1).default("each"),
  costPrice: money.default(0),
  sellPrice: money.default(0),
  vatRate: pct.default(15),
  reorderLevel: qty.min(0).default(0),
  openingQty: qty.min(0).optional(),
  location: optionalText(64),
  barcode: optionalText(64),
});
export type ItemInput = z.input<typeof itemSchema>;

export const stockAdjustSchema = z.object({
  itemId: id,
  mode: z.enum(["add", "remove", "set"]),
  quantity: qty.min(0, "Quantity can't be negative"),
  unitCost: money.optional(),
  note: trimmed(500).min(3, "Say why you're adjusting stock"),
});

export const projectSchema = z.object({
  id: id.optional(),
  code: trimmed(32).optional().transform((v) => v || undefined),
  name: trimmed().min(2, "Enter a project name"),
  customerId: id,
  sector: optionalText(64),
  location: optionalText(191),
  sizeM2: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  stage: z.enum(["DISCOVERY", "CONCEPT", "DEVELOPMENT", "DELIVERY", "COMPLETE"]),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETE", "CANCELLED"]),
  feeValue: money.default(0),
  startDate: dateStr.optional().nullable(),
  notes: optionalText(4000),
});
export type ProjectInput = z.input<typeof projectSchema>;

export const lineSchema = z.object({
  itemId: id.optional().nullable().transform((v) => v || null),
  description: trimmed(512).min(1, "Describe the line"),
  quantity: qty.refine((v) => v !== 0, "Quantity can't be zero"),
  unitPrice: money,
  discountPct: pct.default(0),
  vatRate: pct,
});
export type LineFormInput = z.input<typeof lineSchema>;

const docBase = {
  id: id.optional(),
  projectId: id.optional().nullable().transform((v) => v || null),
  issueDate: dateStr,
  reference: optionalText(128),
  notes: optionalText(4000),
  lines: z.array(lineSchema).min(1, "Add at least one line").max(200),
};

export const invoiceSchema = z.object({
  ...docBase,
  customerId: id,
  dueDate: dateStr,
});
export type InvoiceInput = z.input<typeof invoiceSchema>;

export const quoteSchema = z.object({
  ...docBase,
  customerId: id,
  expiryDate: dateStr,
});
export type QuoteInput = z.input<typeof quoteSchema>;

export const billSchema = z.object({
  id: id.optional(),
  supplierId: id,
  supplierRef: optionalText(128),
  issueDate: dateStr,
  dueDate: dateStr,
  category: optionalText(64),
  notes: optionalText(4000),
  lines: z.array(lineSchema).min(1, "Add at least one line").max(200),
});
export type BillInput = z.input<typeof billSchema>;

export const paymentSchema = z.object({
  partyId: id,
  date: dateStr,
  amount: money.refine((v) => v > 0, "Enter an amount"),
  method: z.enum(["EFT", "CASH", "CARD", "CHEQUE", "OTHER"]),
  reference: optionalText(128),
  notes: optionalText(2000),
  allocations: z
    .array(z.object({ documentId: id, amount: money }))
    .max(200)
    .optional(),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const settingsSchema = z.object({
  name: trimmed().min(2),
  legalName: optionalText(),
  regNumber: optionalText(64),
  vatNumber: optionalText(64),
  email: optionalText(),
  phone: optionalText(64),
  address: optionalText(1000),
  website: optionalText(),
  bankName: optionalText(128),
  bankAccountName: optionalText(),
  bankAccountNo: optionalText(64),
  bankBranchCode: optionalText(32),
  defaultVatRate: pct,
  paymentTermDays: z.coerce.number().int().min(0).max(365),
  invoicePrefix: trimmed(12).regex(/^[A-Z0-9]+$/i, "Letters and numbers only"),
  quotePrefix: trimmed(12).regex(/^[A-Z0-9]+$/i, "Letters and numbers only"),
  invoiceFooter: optionalText(2000),
  allowNegativeStock: z.coerce.boolean(),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v), "Mix upper- and lower-case letters")
  .refine((v) => /\d/.test(v) || /[^A-Za-z0-9]/.test(v), "Add a number or symbol");

export const newUserSchema = z.object({
  name: trimmed().min(2, "Enter a name"),
  email: z.email("Enter a valid email").max(191).transform((v) => v.toLowerCase()),
  role: z.enum(["owner", "admin", "accountant", "staff", "viewer"]),
  password: passwordSchema,
});
