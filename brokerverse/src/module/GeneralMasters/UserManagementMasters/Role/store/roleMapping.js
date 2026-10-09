/**
 * Maps /roles records ({ id, code, name, description, permissions[], status, department, platform, modifiedBy,
 * modifiedAt }) to the Role screens' fields ({ roleCode, roleName, roleDescription, menuAccess, subMenuAccess,
 * permissions }) and back.
 * Menu / sub-menu access are permission modules (e.g. "masters"); the permission level is "read" or "write".
 */
const unique = (items) => [...new Set(items.filter(Boolean))];
const moduleOf = (code) => String(code).split(":")[1];
const levelOf = (code) => String(code).split(":")[0];
const titleCase = (text) =>
  String(text)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const toRoleRow = (role) => {
  const codes = role.permissions || [];
  const modules = unique(codes.map(moduleOf));
  return {
    id: role.id,
    roleCode: role.code,
    roleName: role.name,
    roleDescription: role.description || "",
    menuAccess: modules[0] || "",
    subMenuAccess: modules[1] || modules[0] || "",
    permissions: codes.some((code) => levelOf(code) === "write") ? "write" : "read",
    permissionCodes: codes,
    users: role.users,
    isSystem: role.isSystem,
    department: role.department || "",
    groupOrder: role.groupOrder ?? null,
    platform: !!role.platform,
    modifiedBy: role.modifiedBy || "",
    modifiedOn: role.modifiedAt || role.createdAt ? String(role.modifiedAt || role.createdAt).slice(0, 10) : "",
    status: role.status === "inactive" ? "Inactive" : "Active",
  };
};

/** Roles of a department first, in the order of the user form (access.role_groups), then the others in creation order. */
export const byDepartment = (a, b) => (a.groupOrder ?? Number.MAX_SAFE_INTEGER) - (b.groupOrder ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;

/** Permission codes granted by the chosen menu / sub-menu modules and level ("write" includes read). */
export const accessPermissions = ({ menuAccess, subMenuAccess, permissions }) => {
  const levels = permissions === "write" ? ["read", "write"] : ["read"];
  return unique([menuAccess, subMenuAccess]).flatMap((module) => levels.map((level) => `${level}:${module}`));
};

/** Role code accepted by the API (lowercase letters, digits and dashes). */
export const toRoleCode = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ACCESS_FIELDS = ["menuAccess", "subMenuAccess", "permissions"];

/** PUT/POST body; permissions are only replaced when an access field changed (keeps multi-module roles intact). */
export const toRolePayload = (values, original) => {
  const body = { name: values.roleName, description: values.roleDescription || undefined };
  if (!original) body.code = toRoleCode(values.roleCode);
  if (!original || ACCESS_FIELDS.some((field) => values[field] !== original[field])) {
    body.permissions = accessPermissions(values);
  }
  return body;
};

/** Dropdown options from GET /roles/permissions: modules and permission levels. */
export const accessOptions = (permissionList = []) => ({
  modules: unique(permissionList.map((p) => p.module)).map((module) => ({ label: titleCase(module), value: module })),
  levels: unique(permissionList.map((p) => levelOf(p.code))).map((level) => ({ label: titleCase(level), value: level })),
});
