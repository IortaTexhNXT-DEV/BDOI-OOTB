import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_CITY_BY_ID,
  GET_CITY_DETAILS,
  GET_SERACH_CITY,
  PATCH_CITY_EDIT,
  POST_ADD_CITY,
} from "../../../../../redux/actionTypes";

const TYPE = "city";

export const getCityMiddleware = masterThunk(GET_CITY_DETAILS, (params) =>
  mastersService.list(TYPE, params));

export const getCityListByIdMiddleware = masterThunk(GET_CITY_BY_ID, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const postAddCityMiddleware = masterThunk(POST_ADD_CITY, (values) =>
  mastersService.create(TYPE, values));

export const patchCityEditMiddleware = masterThunk(PATCH_CITY_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchCityMiddleware = masterThunk(GET_SERACH_CITY, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
