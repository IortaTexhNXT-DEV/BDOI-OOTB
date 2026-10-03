import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_INSURANCE_COMPANY_LIST,
  GET_INSURANCE_COMPANY_SEARCH_LIST,
  GET_INSURANCE_PATCH_DATA,
  GET_INSURANCE_VIEW,
  PATCH_INSURANCE_COMPANY_DATA,
  POST_INSURANCE_COMPANY_DATA,
} from "../../../../../redux/actionTypes";

const TYPE = "insurance-company";

export const getInsuranceCompanyListMiddleWare = masterThunk(GET_INSURANCE_COMPANY_LIST, (params) =>
  mastersService.list(TYPE, params));

export const postInsuranceCompanyMiddleWare = masterThunk(POST_INSURANCE_COMPANY_DATA, (values) =>
  mastersService.create(TYPE, values));

export const patchInsuranceCompanyMiddleWare = masterThunk(PATCH_INSURANCE_COMPANY_DATA, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchInsuranceCompanyMiddleware = masterThunk(GET_INSURANCE_COMPANY_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getInsuranceViewMiddleWare = masterThunk(GET_INSURANCE_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getInsurancePatchData = masterThunk(GET_INSURANCE_PATCH_DATA, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
