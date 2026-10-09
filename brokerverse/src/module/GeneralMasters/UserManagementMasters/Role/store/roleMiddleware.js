import userService from "../../../../../services/userService";
import { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import { byDepartment, toRolePayload, toRoleRow } from "./roleMapping";
import {
  GET_ROLE_DETAILS,
  GET_ROLE_BY_ID,
  POST_ADD_ROLE,
  PATCH_ROLE_EDIT,
  GET_SERACH_ROLE,
  GET_VIEW_ROLE,
  GET_PATCH_ROLE,
} from "../../../../../redux/actionTypes";

const loadRoles = async () => (await userService.getRoles()).map(toRoleRow).sort(byDepartment);

const findRole = async (row) => {
  const id = String(row?.id ?? row);
  const role = (await loadRoles()).find((item) => String(item.id) === id || item.roleCode === id);
  if (!role) throw new Error("Role not found");
  return role;
};

export const getRoleListMiddleware = masterThunk(GET_ROLE_DETAILS, loadRoles);

export const getRoleListByIdMiddleware = masterThunk(GET_ROLE_BY_ID, loadRoles);

export const postAddRoleMiddleware = masterThunk(POST_ADD_ROLE, async (values) => {
  const created = await userService.createRole(toRolePayload(values));
  return findRole(created.id);
});

export const patchRoleEditMiddleware = masterThunk(PATCH_ROLE_EDIT, async (values) => {
  const original = await findRole(values.id);
  await userService.updateRole(values.id, toRolePayload(values, original));
  return findRole(values.id);
});

export const getViewRoleEditMiddleware = masterThunk(GET_VIEW_ROLE, findRole);

export const getPatchRoleEditMiddleware = masterThunk(GET_PATCH_ROLE, findRole);

export const getSearchRoleMiddleware = masterThunk(GET_SERACH_ROLE, async (query) => {
  const text = searchText(query).toLowerCase();
  return (await loadRoles()).filter((role) =>
    [role.roleName, role.roleCode].some((value) => String(value || "").toLowerCase().includes(text))
  );
});
