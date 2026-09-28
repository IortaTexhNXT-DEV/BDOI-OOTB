import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_INSURANCE_COVER_LIST,
  GET_INSURANCE_COVER_SEARCH_LIST,
  PATCH_INSURANCE_COVER_DATA,
  POST_INSURANCE_COVER_DATA,
} from "../../../../../redux/actionTypes";

const TYPE = "cover";

export const getInsuranceCoverMiddleWare = masterThunk(GET_INSURANCE_COVER_LIST, (params) =>
  mastersService.list(TYPE, params));

export const postInsuranceCoverMiddleWare = masterThunk(POST_INSURANCE_COVER_DATA, (values) =>
  mastersService.create(TYPE, values));

export const patchInsuranceCoverMiddleWare = masterThunk(PATCH_INSURANCE_COVER_DATA, async (values) => {
  await mastersService.update(TYPE, values.id, values);
  return mastersService.list(TYPE);
});

export const getSearchInsuranceCoverMiddleware = masterThunk(GET_INSURANCE_COVER_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
