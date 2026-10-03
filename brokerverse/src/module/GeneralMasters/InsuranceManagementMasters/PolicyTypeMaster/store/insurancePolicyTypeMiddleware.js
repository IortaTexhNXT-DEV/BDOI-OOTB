import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_INSURANCE_POLICY_TYPE_LIST,
  GET_INSURANCE_POLICY_TYPE_SEARCH_LIST,
  PATCH_INSURANCE_POLICY_TYPE_DATA,
  POST_INSURANCE_POLICY_TYPE_DATA,
} from "../../../../../redux/actionTypes";

const TYPE = "policy-type";

export const getInsurancePolicyTypeMiddleWare = masterThunk(GET_INSURANCE_POLICY_TYPE_LIST, (params) =>
  mastersService.list(TYPE, params));

export const postInsurancePolicyTypeMiddleWare = masterThunk(POST_INSURANCE_POLICY_TYPE_DATA, (values) =>
  mastersService.create(TYPE, values));

export const patchInsurancePolicyTypeMiddleWare = masterThunk(PATCH_INSURANCE_POLICY_TYPE_DATA, async (values) => {
  await mastersService.update(TYPE, values.id, values);
  return mastersService.list(TYPE);
});

export const getSearchInsurancePolicyTypeMiddleware = masterThunk(GET_INSURANCE_POLICY_TYPE_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
