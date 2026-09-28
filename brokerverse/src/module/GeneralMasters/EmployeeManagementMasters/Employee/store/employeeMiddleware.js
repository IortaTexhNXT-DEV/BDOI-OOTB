import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_EDIT_EMPLOYEE,
  GET_EMPLOYEE_BY_ID,
  GET_EMPLOYEE_DETAILS,
  GET_SERACH_EMPLOYEE,
  GET_VIEW_EMPLOYEE,
  PATCH_EMPLOYEE_EDIT,
  POST_ADD_EMPLOYEE,
} from "../../../../../redux/actionTypes";

const TYPE = "employee";

export const getEmployeeListMiddleware = masterThunk(GET_EMPLOYEE_DETAILS, (params) =>
  mastersService.list(TYPE, params));

export const getEmployeeListByIdMiddleware = masterThunk(GET_EMPLOYEE_BY_ID, (params) =>
  mastersService.list(TYPE, params));

export const postAddEmployeeMiddleware = masterThunk(POST_ADD_EMPLOYEE, (values) =>
  mastersService.create(TYPE, values));

export const patchEmployeeEditMiddleware = masterThunk(PATCH_EMPLOYEE_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchEmployeeMiddleware = masterThunk(GET_SERACH_EMPLOYEE, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getEmployeViewMiddleWare = masterThunk(GET_VIEW_EMPLOYEE, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getEmployeEditMiddleWare = masterThunk(GET_EDIT_EMPLOYEE, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
