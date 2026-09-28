import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_INSURANCE_PRODUCT_LIST,
  GET_INSURANCE_PRODUCT_SEARCH_LIST,
  PATCH_INSURANCE_PRODUCT_DATA,
  POST_INSURANCE_PRODUCT_DATA,
} from "../../../../../redux/actionTypes";

const TYPE = "product";

export const getInsuranceProductListMiddleWare = masterThunk(GET_INSURANCE_PRODUCT_LIST, (params) =>
  mastersService.list(TYPE, params));

export const postInsuranceProductMiddleWare = masterThunk(POST_INSURANCE_PRODUCT_DATA, (values) =>
  mastersService.create(TYPE, values));

export const patchInsuranceProductMiddleWare = masterThunk(PATCH_INSURANCE_PRODUCT_DATA, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchInsuranceProductMiddleware = masterThunk(GET_INSURANCE_PRODUCT_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
