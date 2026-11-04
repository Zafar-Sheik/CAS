// Role-based access control. Shared by server and client (no secrets here).

export const ROLES = ["owner", "admin", "accountant", "staff", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  accountant: "Accountant",
  staff: "Staff",
  viewer: "Read only",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including users and company settings.",
  admin: "Manage everything, including users. Cannot remove the owner.",
  accountant: "Sales, purchases, payments and stock. No user management.",
  staff: "Quotes, invoices, customers and stock. No purchases or voids.",
  viewer: "Can look at everything, change nothing.",
};

export type Permission =
  | "sales:write"
  | "purchases:write"
  | "inventory:write"
  | "projects:write"
  | "documents:void"
  | "settings:manage"
  | "users:manage"
  | "audit:view"
  | "reports:export";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "sales:write",
    "purchases:write",
    "inventory:write",
    "projects:write",
    "documents:void",
    "settings:manage",
    "users:manage",
    "audit:view",
    "reports:export",
  ],
  admin: [
    "sales:write",
    "purchases:write",
    "inventory:write",
    "projects:write",
    "documents:void",
    "settings:manage",
    "users:manage",
    "audit:view",
    "reports:export",
  ],
  accountant: ["sales:write", "purchases:write", "inventory:write", "projects:write", "documents:void", "reports:export"],
  staff: ["sales:write", "inventory:write", "projects:write"],
  viewer: [],
};

export function asRole(value: string | null | undefined): Role {
  return (ROLES as readonly string[]).includes(value ?? "") ? (value as Role) : "viewer";
}

export function can(role: string | null | undefined, permission: Permission) {
  return MATRIX[asRole(role)].includes(permission);
}

/** Roles that must have two-factor authentication switched on. */
export const ROLES_REQUIRING_2FA: Role[] = ["owner", "admin", "accountant"];
