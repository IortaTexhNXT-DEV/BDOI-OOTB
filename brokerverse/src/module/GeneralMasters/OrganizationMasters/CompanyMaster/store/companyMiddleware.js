import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_COMPANY_BY_ID,
  GET_COMPANY_DETAILS,
  GET_COMPANY_EDIT,
  GET_COMPANY_VIEW,
  GET_SERACH_COMPANY,
  PATCH_COMPANY_EDIT,
  POST_ADD_COMPANY,
} from "../../../../../redux/actionTypes";

const TYPE = "company";

export const getCompanyListMiddleware = masterThunk(GET_COMPANY_DETAILS, (params) =>
  mastersService.list(TYPE, params));

export const getComapnyListByIdMiddleware = masterThunk(GET_COMPANY_BY_ID, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const postAddCompanyMiddleware = masterThunk(POST_ADD_COMPANY, (values) =>
  mastersService.create(TYPE, values));

export const getCompanyViewMiddleWare = masterThunk(GET_COMPANY_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getCompanyEditData = masterThunk(GET_COMPANY_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const patchCompanyEditMiddleware = masterThunk(PATCH_COMPANY_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchCompanyMiddleware = masterThunk(GET_SERACH_COMPANY, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
