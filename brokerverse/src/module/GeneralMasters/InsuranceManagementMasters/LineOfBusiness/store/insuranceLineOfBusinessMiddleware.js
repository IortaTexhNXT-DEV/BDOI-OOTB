import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_INSURANCE_LIST_OF_BUSINESS_LIST,
  GET_INSURANCE_LIST_OF_BUSINESS_SEARCH_LIST,
  PATCH_INSURANCE_LIST_OF_BUSINESS_DATA,
  POST_INSURANCE_LIST_OF_BUSINESS_DATA,
} from "../../../../../redux/actionTypes";

const TYPE = "line-of-business";

export const getInsurancelineOfBusinessListMiddleWare = masterThunk(GET_INSURANCE_LIST_OF_BUSINESS_LIST, (params) =>
  mastersService.list(TYPE, params));

export const postInsurancelineOfBusinessMiddleWare = masterThunk(POST_INSURANCE_LIST_OF_BUSINESS_DATA, (values) =>
  mastersService.create(TYPE, values));

export const patchInsurancelineOfBusinessMiddleWare = masterThunk(PATCH_INSURANCE_LIST_OF_BUSINESS_DATA, async (values) => {
  await mastersService.update(TYPE, values.id, values);
  return mastersService.list(TYPE);
});

export const getSearchInsurancelineOfBusinessMiddleware = masterThunk(GET_INSURANCE_LIST_OF_BUSINESS_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
