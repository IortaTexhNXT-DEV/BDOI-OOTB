import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_DESIGNATION_BY_ID,
  GET_DESIGNATION_EDIT,
  GET_DESIGNATION_VIEW,
  GET_SERACH_DESIGANTION,
  PATCH_DESIGNATION_EDIT,
  POST_ADD_DESIGNATION,
} from "../../../../../redux/actionTypes";

const TYPE = "designation";

export const getDesignationListByIdMiddleware = masterThunk(GET_DESIGNATION_BY_ID, (params) =>
  mastersService.list(TYPE, params));

export const postAddDesignationMiddleware = masterThunk(POST_ADD_DESIGNATION, (values) =>
  mastersService.create(TYPE, values));

export const patchDesignationEditMiddleware = masterThunk(PATCH_DESIGNATION_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getSearchDesignationMiddleware = masterThunk(GET_SERACH_DESIGANTION, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getDesignationViewData = masterThunk(GET_DESIGNATION_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getDesignationPatchData = masterThunk(GET_DESIGNATION_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
