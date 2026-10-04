import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_COUNTRY_DETAILS,
  GET_COUNTRY_BY_ID,
  POST_ADD_COUNTRY,
  PATCH_COUNTRY_EDIT,
  GET_SERACH_COUNTRY,
} from "../../../../../redux/actionTypes";

const TYPE = "country";

export const getCountryMiddleware = masterThunk(GET_COUNTRY_DETAILS, (params) =>
  mastersService.list(TYPE, params)
);

export const getCountryListByIdMiddleware = masterThunk(GET_COUNTRY_BY_ID, (row) =>
  mastersService.get(TYPE, row?.id ?? row)
);

export const getSearchCountryMiddleware = masterThunk(GET_SERACH_COUNTRY, (query) =>
  mastersService.list(TYPE, { search: searchText(query) })
);

export const postAddCountryMiddleware = masterThunk(POST_ADD_COUNTRY, (values) =>
  mastersService.create(TYPE, values)
);

export const patchCountryEditMiddleware = masterThunk(PATCH_COUNTRY_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values)
);
