import "server-only"

import {
  DEPARTMENT_PERMISSION_KEYS,
  type DepartmentPermissionKey,
} from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export async function hasDepartmentPermission(
  departman: string | null | undefined,
  key: DepartmentPermissionKey
): Promise<boolean> {
  const permissions = await getResolvedDepartmentPermissionsForUser(departman)
  return !!permissions[key]
}

export { DEPARTMENT_PERMISSION_KEYS }
