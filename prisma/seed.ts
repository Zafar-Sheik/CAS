/**
 * Seeds company settings and the owner account. Set SEED_DEMO=true for sample data.
 *   SEED_OWNER_EMAIL, SEED_OWNER_NAME, SEED_OWNER_PASSWORD (generated if missing)
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const url = new URL(process.env.DATABASE_URL!);
const ssl = process.env.DATABASE_SSL === "true" || (url.hostname.endsWith("tidbcloud.com") && process.env.DATABASE_SSL !== "false");
const db = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 4000),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: ssl ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    allowPublicKeyRetrieval: !ssl,
  }),
});

const r2 = (n: number) => Math.round(n * 100) / 100;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

function totals(lines: { quantity: number; unitPrice: number; vatRate: number }[]) {
  let sub = 0;
  let vat = 0;
  for (const l of lines) {
    const net = Math.round(l.quantity * l.unitPrice * 100);
    sub += net;
    vat += Math.round((net * l.vatRate) / 100);
  }
  return { subtotal: sub / 100, vatTotal: vat / 100, total: (sub + vat) / 100 };
}

async function main() {
  await db.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Caveman Architectural Studios",
      legalName: "Caveman Architectural Studios (Pty) Ltd",
      email: "info@cavemanarchitects.co.za",
      phone: "+27 84 268 1929",
      address: "89 Helen Joseph Rd\nBerea, Durban\n4001",
      website: "cavemanarchitects.co.za",
      invoiceFooter: "Thank you for building with CAS. Please use the invoice number as your payment reference.",
    },
  });

  const email = (process.env.SEED_OWNER_EMAIL ?? "owner@cavemanarchitects.co.za").toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    const password = process.env.SEED_OWNER_PASSWORD ?? `Cas-${randomBytes(9).toString("base64url")}`;
    const id = randomUUID();
    await db.user.create({
      data: { id, email, name: process.env.SEED_OWNER_NAME ?? "Studio Owner", emailVerified: true, role: "owner" },
    });
    await db.account.create({
      data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(password) },
    });
    console.log("\n  Owner account created");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log("  You'll be asked to set up two-factor authentication on first sign-in.\n");
  } else {
    console.log(`Owner ${email} already exists — skipping.`);
  }

  if (process.env.SEED_DEMO !== "true") return;
  if ((await db.customer.count()) > 0) {
    console.log("Demo data already present — skipping.");
    return;
  }
  const owner = await db.user.findUniqueOrThrow({ where: { email } });

  // Customers & suppliers
  const customers = await Promise.all(
    [
      { code: "NEN001", name: "Mr S. Nene", contactName: "Sipho Nene", email: "nene@example.co.za", phone: "+27 82 000 1111", address: "Amahlongwa, Umkomaas", termsDays: 14 },
      { code: "WES001", name: "WestRidge Student Living (Pty) Ltd", contactName: "Ayesha Patel", email: "projects@westridge.example", phone: "+27 31 000 2222", vatNumber: "4123456789", creditLimit: 500000, address: "Durban, KwaZulu-Natal" },
      { code: "ZAK001", name: "Zaka Lifestyle", contactName: "Thabo Zaka", email: "thabo@zaka.example", phone: "+27 83 000 3333", creditLimit: 250000 },
      { code: "DUR001", name: "Durban North Developments", contactName: "Lerato Mokoena", email: "lerato@dnd.example", phone: "+27 31 000 4444", vatNumber: "4987654321", creditLimit: 400000 },
      { code: "MOO001", name: "Mrs K. Moodley", contactName: "Kavitha Moodley", email: "kmoodley@example.co.za", phone: "+27 72 000 5555", termsDays: 14 },
    ].map((c) => db.customer.create({ data: c })),
  );
  const suppliers = await Promise.all(
    [
      { code: "PLO001", name: "Berea Plot & Print", contactName: "Naveen", email: "orders@bereaplot.example", phone: "+27 31 100 1000" },
      { code: "BIM001", name: "BIM Software Licensing SA", email: "billing@bimsa.example", termsDays: 7 },
      { code: "MOD001", name: "Model Makers Supply Co.", email: "sales@modelsupply.example", phone: "+27 31 100 3000" },
      { code: "SAF001", name: "KZN Site Safety", email: "info@kznsafety.example" },
    ].map((s) => db.supplier.create({ data: s })),
  );

  // Items: services (stage fees) and studio stock
  const items = Object.fromEntries(
    await Promise.all(
      [
        { sku: "SVC-DISC", name: "Discovery: site analysis & brief", type: "SERVICE", category: "Fees", unit: "stage", sellPrice: 18500 },
        { sku: "SVC-CONC", name: "Concept design: sketches & 3D massing", type: "SERVICE", category: "Fees", unit: "stage", sellPrice: 45000 },
        { sku: "SVC-DEVT", name: "Design development & council drawings", type: "SERVICE", category: "Fees", unit: "stage", sellPrice: 85000 },
        { sku: "SVC-DELV", name: "Construction documents & site administration", type: "SERVICE", category: "Fees", unit: "stage", sellPrice: 65000 },
        { sku: "SVC-3DR", name: "Photoreal 3D render", type: "SERVICE", category: "Visualisation", unit: "image", sellPrice: 3500 },
        { sku: "SVC-SITE", name: "Site visit", type: "SERVICE", category: "Fees", unit: "visit", sellPrice: 1850 },
        { sku: "PAP-A1R", name: "A1 bond paper roll 80gsm", type: "STOCK", category: "Print", unit: "roll", costPrice: 420, sellPrice: 650, qty: 14, reorder: 6, location: "Plot room" },
        { sku: "INK-T40", name: "Plotter ink cartridge (black)", type: "STOCK", category: "Print", unit: "each", costPrice: 980, sellPrice: 1350, qty: 3, reorder: 4, location: "Plot room" },
        { sku: "MOD-FB5", name: "Foam board 5mm A1", type: "STOCK", category: "Model making", unit: "sheet", costPrice: 85, sellPrice: 140, qty: 42, reorder: 20, location: "Workshop" },
        { sku: "MOD-BAL", name: "Balsa sheet 2mm", type: "STOCK", category: "Model making", unit: "sheet", costPrice: 38, sellPrice: 65, qty: 8, reorder: 15, location: "Workshop" },
        { sku: "PPE-HLM", name: "Site safety helmet (white)", type: "STOCK", category: "Site", unit: "each", costPrice: 95, sellPrice: 160, qty: 11, reorder: 5, location: "Store" },
        { sku: "PPE-VST", name: "Hi-vis vest, CAS branded", type: "STOCK", category: "Site", unit: "each", costPrice: 75, sellPrice: 120, qty: 18, reorder: 10, location: "Store" },
      ].map(async (i) => {
        const item = await db.item.create({
          data: {
            sku: i.sku,
            name: i.name,
            type: i.type as "STOCK" | "SERVICE",
            category: i.category,
            unit: i.unit,
            costPrice: i.costPrice ?? 0,
            sellPrice: i.sellPrice,
            qtyOnHand: i.qty ?? 0,
            reorderLevel: i.reorder ?? 0,
            location: i.location,
          },
        });
        if (i.qty) {
          await db.stockMovement.create({
            data: { itemId: item.id, type: "OPENING", quantity: i.qty, unitCost: i.costPrice ?? 0, balance: i.qty, note: "Opening balance", userId: owner.id, createdAt: daysAgo(330) },
          });
        }
        return [i.sku, item] as const;
      }),
    ),
  );

  const [nene, westridge, zaka, dnd, moodley] = customers;
  const projects = await Promise.all([
    db.project.create({ data: { code: "P25-001", name: "House Nene", customerId: nene.id, sector: "Residential", location: "Amahlongwa, Umkomaas", sizeM2: 350, stage: "DELIVERY", feeValue: 364000, startDate: daysAgo(320) } }),
    db.project.create({ data: { code: "P25-002", name: "WestRidge Student Accommodation", customerId: westridge.id, sector: "Student living", location: "Durban", stage: "DEVELOPMENT", feeValue: 980000, startDate: daysAgo(240) } }),
    db.project.create({ data: { code: "P25-003", name: "Zaka Lifestyle", customerId: zaka.id, sector: "Lifestyle commercial", stage: "CONCEPT", feeValue: 420000, startDate: daysAgo(120) } }),
    db.project.create({ data: { code: "P26-004", name: "Umhlanga Ridge townhouses", customerId: dnd.id, sector: "Residential", location: "Umhlanga", stage: "DISCOVERY", feeValue: 610000, startDate: daysAgo(30) } }),
    db.project.create({ data: { code: "P26-005", name: "Moodley alterations", customerId: moodley.id, sector: "Additions & alterations", location: "Morningside", stage: "CONCEPT", feeValue: 95000, startDate: daysAgo(45) } }),
  ]);

  let invNo = 1001;
  let recNo = 1001;
  const invoiceSpecs: { c: typeof nene; p: (typeof projects)[number]; days: number; lines: [string, number, number?][]; paid: number }[] = [
    { c: nene, p: projects[0], days: 320, lines: [["SVC-DISC", 1]], paid: 1 },
    { c: nene, p: projects[0], days: 280, lines: [["SVC-CONC", 1], ["SVC-3DR", 4]], paid: 1 },
    { c: westridge, p: projects[1], days: 235, lines: [["SVC-DISC", 1, 32000]], paid: 1 },
    { c: nene, p: projects[0], days: 210, lines: [["SVC-DEVT", 1, 120000]], paid: 1 },
    { c: westridge, p: projects[1], days: 180, lines: [["SVC-CONC", 1, 145000], ["SVC-3DR", 8]], paid: 1 },
    { c: zaka, p: projects[2], days: 115, lines: [["SVC-DISC", 1, 24000]], paid: 1 },
    { c: nene, p: projects[0], days: 100, lines: [["SVC-DELV", 1, 90000], ["SVC-SITE", 4]], paid: 1 },
    { c: westridge, p: projects[1], days: 75, lines: [["SVC-DEVT", 1, 220000]], paid: 0.5 },
    { c: zaka, p: projects[2], days: 52, lines: [["SVC-CONC", 1, 68000], ["SVC-3DR", 6]], paid: 0 },
    { c: moodley, p: projects[4], days: 40, lines: [["SVC-DISC", 1, 9500], ["SVC-SITE", 1]], paid: 1 },
    { c: dnd, p: projects[3], days: 24, lines: [["SVC-DISC", 1, 38000]], paid: 0 },
    { c: nene, p: projects[0], days: 12, lines: [["SVC-SITE", 3], ["PPE-HLM", 2], ["PPE-VST", 2]], paid: 0 },
    { c: moodley, p: projects[4], days: 6, lines: [["SVC-CONC", 1, 28000], ["SVC-3DR", 2]], paid: 0 },
  ];

  for (const spec of invoiceSpecs) {
    const lines = spec.lines.map(([sku, qty, price]) => {
      const it = items[sku];
      return { item: it, quantity: qty, unitPrice: price ?? Number(it.sellPrice), vatRate: 15 };
    });
    const t = totals(lines);
    const issueDate = daysAgo(spec.days);
    const number = `INV-${String(invNo++).padStart(5, "0")}`;
    const amountPaid = r2(t.total * spec.paid);
    const inv = await db.invoice.create({
      data: {
        number,
        customerId: spec.c.id,
        projectId: spec.p.id,
        status: spec.paid >= 1 ? "PAID" : spec.paid > 0 ? "PARTIAL" : "ISSUED",
        issueDate,
        dueDate: new Date(issueDate.getTime() + spec.c.termsDays * 86400000),
        issuedAt: issueDate,
        ...t,
        amountPaid,
        createdById: owner.id,
        createdAt: issueDate,
        lines: {
          create: lines.map((l, i) => ({
            itemId: l.item.id,
            description: l.item.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: 15,
            lineTotal: r2(l.quantity * l.unitPrice),
            sortOrder: i,
          })),
        },
      },
    });
    for (const l of lines) {
      if (l.item.type !== "STOCK") continue;
      const updated = await db.item.update({ where: { id: l.item.id }, data: { qtyOnHand: { decrement: l.quantity } } });
      await db.stockMovement.create({
        data: { itemId: l.item.id, type: "SALE", quantity: -l.quantity, unitCost: l.item.costPrice, balance: updated.qtyOnHand, reference: number, userId: owner.id, createdAt: issueDate },
      });
    }
    if (amountPaid > 0) {
      const date = new Date(issueDate.getTime() + 9 * 86400000);
      await db.receipt.create({
        data: {
          number: `REC-${String(recNo++).padStart(5, "0")}`,
          customerId: spec.c.id,
          date,
          amount: amountPaid,
          method: "EFT",
          reference: number,
          createdById: owner.id,
          createdAt: date,
          allocations: { create: [{ invoiceId: inv.id, amount: amountPaid }] },
        },
      });
    }
  }

  // Quotes
  await db.quote.create({
    data: {
      number: "QUO-01001",
      customerId: dnd.id,
      projectId: projects[3].id,
      status: "SENT",
      issueDate: daysAgo(20),
      expiryDate: daysAgo(-10),
      ...totals([{ quantity: 1, unitPrice: 145000, vatRate: 15 }, { quantity: 12, unitPrice: 3500, vatRate: 15 }]),
      createdById: owner.id,
      lines: {
        create: [
          { itemId: items["SVC-CONC"].id, description: "Concept design: 24 townhouse units", quantity: 1, unitPrice: 145000, vatRate: 15, lineTotal: 145000, sortOrder: 0 },
          { itemId: items["SVC-3DR"].id, description: "Marketing renders", quantity: 12, unitPrice: 3500, vatRate: 15, lineTotal: 42000, sortOrder: 1 },
        ],
      },
    },
  });

  // Bills
  let billNo = 1001;
  let payNo = 1001;
  const billSpecs: { s: (typeof suppliers)[number]; days: number; cat: string; lines: [string | null, string, number, number][]; paid: boolean }[] = [
    { s: suppliers[1], days: 300, cat: "Software", lines: [[null, "BIM licence, annual (3 seats)", 1, 54000]], paid: true },
    { s: suppliers[0], days: 260, cat: "Printing", lines: [["PAP-A1R", "A1 bond paper roll 80gsm", 10, 410], ["INK-T40", "Plotter ink cartridge", 4, 960]], paid: true },
    { s: suppliers[2], days: 190, cat: "Model making", lines: [["MOD-FB5", "Foam board 5mm A1", 30, 82], ["MOD-BAL", "Balsa sheet 2mm", 20, 36]], paid: true },
    { s: suppliers[0], days: 130, cat: "Printing", lines: [[null, "Council submission sets, WestRidge", 1, 6800]], paid: true },
    { s: suppliers[3], days: 70, cat: "Site", lines: [["PPE-HLM", "Safety helmets", 6, 92], ["PPE-VST", "Branded vests", 10, 74]], paid: true },
    { s: suppliers[0], days: 33, cat: "Printing", lines: [[null, "Presentation boards, Zaka Lifestyle", 1, 4200], ["PAP-A1R", "A1 bond paper roll 80gsm", 6, 430]], paid: false },
    { s: suppliers[1], days: 5, cat: "Software", lines: [[null, "Rendering plug-in, annual", 1, 12500]], paid: false },
  ];
  for (const b of billSpecs) {
    const lines = b.lines.map(([sku, description, quantity, unitPrice]) => ({ item: sku ? items[sku] : null, description, quantity, unitPrice, vatRate: 15 }));
    const t = totals(lines);
    const issueDate = daysAgo(b.days);
    const number = `BIL-${String(billNo++).padStart(5, "0")}`;
    const bill = await db.bill.create({
      data: {
        number,
        supplierId: b.s.id,
        supplierRef: `SUP-${Math.floor(Math.random() * 90000 + 10000)}`,
        status: b.paid ? "PAID" : "POSTED",
        issueDate,
        dueDate: new Date(issueDate.getTime() + b.s.termsDays * 86400000),
        category: b.cat,
        ...t,
        amountPaid: b.paid ? t.total : 0,
        postedAt: issueDate,
        createdById: owner.id,
        createdAt: issueDate,
        lines: {
          create: lines.map((l, i) => ({
            itemId: l.item?.id ?? null,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: 15,
            lineTotal: r2(l.quantity * l.unitPrice),
            sortOrder: i,
          })),
        },
      },
    });
    for (const l of lines) {
      if (!l.item) continue;
      const updated = await db.item.update({ where: { id: l.item.id }, data: { qtyOnHand: { increment: l.quantity } } });
      await db.stockMovement.create({
        data: { itemId: l.item.id, type: "PURCHASE", quantity: l.quantity, unitCost: l.unitPrice, balance: updated.qtyOnHand, reference: number, userId: owner.id, createdAt: issueDate },
      });
    }
    if (b.paid) {
      const date = new Date(issueDate.getTime() + 5 * 86400000);
      await db.supplierPayment.create({
        data: {
          number: `PAY-${String(payNo++).padStart(5, "0")}`,
          supplierId: b.s.id,
          date,
          amount: t.total,
          method: "EFT",
          reference: number,
          createdById: owner.id,
          createdAt: date,
          allocations: { create: [{ billId: bill.id, amount: t.total }] },
        },
      });
    }
  }

  await db.companySettings.update({
    where: { id: 1 },
    data: { nextInvoiceNo: invNo, nextReceiptNo: recNo, nextBillNo: billNo, nextPaymentNo: payNo, nextQuoteNo: 1002 },
  });
  console.log("Demo data loaded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
