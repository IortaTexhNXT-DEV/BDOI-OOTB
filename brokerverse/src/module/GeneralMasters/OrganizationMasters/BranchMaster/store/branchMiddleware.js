import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_BRANCH_BY_ID,
  GET_BRANCH_DETAILS,
  GET_DEPARTMENT_LUST_DETAILS,
  GET_DEPARTMENT_VIEW,
  GET_ORGANIZATION_BRANCH_VIEW,
  GET_PATCH_BRANCH_EDIT,
  GET_PATCH_DEPARTMENT_EDIT,
  GET_SERACH_BRANCH,
  PATCH_BRANCH_EDIT,
  POST_ADD_BRANCH,
  POST_ADD_DEPARTMENT,
  POST_PATCH_DEPARTMENT_EDIT,
} from "../../../../../redux/actionTypes";

const TYPE = "branch";

export const getBranchListMiddleware = masterThunk(GET_BRANCH_DETAILS, (params) =>
  mastersService.list(TYPE, params));

export const getDepartmentListMiddleware = masterThunk(GET_DEPARTMENT_LUST_DETAILS, (params) =>
  mastersService.list("department", params));

export const postAddDepartment = masterThunk(POST_ADD_DEPARTMENT, (values) =>
  mastersService.create("department", values));

export const getBranchListByIdMiddleware = masterThunk(GET_BRANCH_BY_ID, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const postAddBranchMiddleware = masterThunk(POST_ADD_BRANCH, (values) =>
  mastersService.create(TYPE, values));

export const getOrganizationBranchView = masterThunk(GET_ORGANIZATION_BRANCH_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getDepatmentView = masterThunk(GET_DEPARTMENT_VIEW, (payload) => payload);

export const patchBranchEditMiddleware = masterThunk(PATCH_BRANCH_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchBranchMiddleware = masterThunk(GET_SERACH_BRANCH, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getPatchBranchData = masterThunk(GET_PATCH_BRANCH_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const postPatchDepatmentEdit = masterThunk(POST_PATCH_DEPARTMENT_EDIT, (values) =>
  mastersService.update("department", values.id, values));

export const getDepatmentEditData = masterThunk(GET_PATCH_DEPARTMENT_EDIT, (payload) => payload);
