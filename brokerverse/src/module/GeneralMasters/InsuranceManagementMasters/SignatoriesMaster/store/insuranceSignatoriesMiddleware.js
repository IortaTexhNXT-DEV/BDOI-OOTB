import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_INSURANCE_SIGNATORIES_LIST,
  GET_INSURANCE_SIGNATORIES_SEARCH_LIST,
  PATCH_INSURANCE_SIGNATORIES_DATA,
  POST_INSURANCE_SIGNATORIES_DATA,
} from "../../../../../redux/actionTypes";

const TYPE = "signatory";

export const getInsuranceSignatoriesMiddleWare = masterThunk(GET_INSURANCE_SIGNATORIES_LIST, (params) =>
  mastersService.list(TYPE, params));

export const postInsuranceSignatoriesMiddleWare = masterThunk(POST_INSURANCE_SIGNATORIES_DATA, (values) =>
  mastersService.create(TYPE, values));

export const patchInsuranceSignatoriesMiddleWare = masterThunk(PATCH_INSURANCE_SIGNATORIES_DATA, async (values) => {
  await mastersService.update(TYPE, values.id, values);
  return mastersService.list(TYPE);
});

export const getSearchInsuranceSignatoriesMiddleware = masterThunk(GET_INSURANCE_SIGNATORIES_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
