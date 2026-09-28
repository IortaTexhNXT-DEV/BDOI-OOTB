import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_HIERARCHY_BY_ID,
  GET_HIERARCHY_DETAILS,
  GET_HIERARCHY_PATCH_DETAILS,
  GET_HIERARCHY_VIEW_DETAILS,
  GET_SERACH_HIERARCHY,
  PATCH_HIERARCHY_EDIT,
  POST_ADD_HIERARCHY,
} from "../../../../../redux/actionTypes";

const TYPE = "hierarchy";

export const getHirarchyListMiddleware = masterThunk(GET_HIERARCHY_DETAILS, (params) =>
  mastersService.list(TYPE, params));

export const getHirarchyListByIdMiddleware = masterThunk(GET_HIERARCHY_BY_ID, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const postAddHirarchyMiddleware = masterThunk(POST_ADD_HIERARCHY, (values) =>
  mastersService.create(TYPE, values));

export const patchHirarchyEditMiddleware = masterThunk(PATCH_HIERARCHY_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchHirarchyMiddleware = masterThunk(GET_SERACH_HIERARCHY, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getHierarchyViewMiddleWare = masterThunk(GET_HIERARCHY_VIEW_DETAILS, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getHierarchyPatchMiddleWare = masterThunk(GET_HIERARCHY_PATCH_DETAILS, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
