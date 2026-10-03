import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_SERACH_STATE,
  GET_STATE_BY_ID,
  GET_STATE_DETAILS,
  PATCH_STATE_EDIT,
  POST_ADD_STATE,
} from "../../../../../redux/actionTypes";

const TYPE = "state";

export const getStateMiddleware = masterThunk(GET_STATE_DETAILS, (params) =>
  mastersService.list(TYPE, params));

export const getStateListByIdMiddleware = masterThunk(GET_STATE_BY_ID, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const postAddStateMiddleware = masterThunk(POST_ADD_STATE, (values) =>
  mastersService.create(TYPE, values));

export const patchStateEditMiddleware = masterThunk(PATCH_STATE_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchStateMiddleware = masterThunk(GET_SERACH_STATE, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
