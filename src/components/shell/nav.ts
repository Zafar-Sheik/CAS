import {
  LayoutDashboard,
  FileText,
  FileSignature,
  Users,
  Receipt,
  Truck,
  Boxes,
  FolderKanban,
  BarChart3,
  Settings,
  Wallet,
  HandCoins,
  PackagePlus,
  UserPlus,
} from "lucide-react";
import type { Permission } from "@/lib/roles";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Sales",
    items: [
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/quotes", label: "Quotes", icon: FileSignature },
      { href: "/debtors", label: "Debtors", icon: Users },
    ],
  },
  {
    label: "Purchases",
    items: [
      { href: "/bills", label: "Supplier bills", icon: Receipt },
      { href: "/creditors", label: "Creditors", icon: Truck },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  { label: "Admin", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export const QUICK_ACTIONS: (NavItem & { description: string })[] = [
  { href: "/invoices/new", label: "New invoice", description: "Bill a client", icon: FileText, permission: "sales:write" },
  { href: "/debtors/receive", label: "Receive payment", description: "Money in", icon: HandCoins, permission: "sales:write" },
  { href: "/quotes/new", label: "New quote", description: "Price a job", icon: FileSignature, permission: "sales:write" },
  { href: "/bills/new", label: "Capture bill", description: "Supplier invoice", icon: Receipt, permission: "purchases:write" },
  { href: "/creditors/pay", label: "Pay supplier", description: "Money out", icon: Wallet, permission: "purchases:write" },
  { href: "/inventory/new", label: "Add stock item", description: "Products & services", icon: PackagePlus, permission: "inventory:write" },
  { href: "/debtors/new", label: "Add customer", description: "New debtor", icon: UserPlus, permission: "sales:write" },
  { href: "/projects/new", label: "New project", description: "Track a job", icon: FolderKanban, permission: "projects:write" },
];
