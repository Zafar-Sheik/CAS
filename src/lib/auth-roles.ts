import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, userAc } from "better-auth/plugins/admin/access";

/**
 * Better Auth admin-plugin roles. Business permissions live in `roles.ts`;
 * these only govern Better Auth's own user-management endpoints.
 */
export const ac = createAccessControl(defaultStatements);

export const authRoles = {
  owner: ac.newRole({ ...adminAc.statements }),
  admin: ac.newRole({ ...adminAc.statements }),
  accountant: ac.newRole({ ...userAc.statements }),
  staff: ac.newRole({ ...userAc.statements }),
  viewer: ac.newRole({ ...userAc.statements }),
};
