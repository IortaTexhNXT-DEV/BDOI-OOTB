import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";
import {
  GET_PATCH_TAXATION_EDIT,
  GET_TAXATION_BY_ID,
  GET_TAXATION_SEARCH_LIST,
  GET_TAXATION_VIEW,
  PATCH_TAXATION_EDIT,
  POST_TAXATION,
} from "../../../../redux/actionTypes";

const TYPE = "taxation";

export const getTaxationData = masterThunk(GET_TAXATION_BY_ID, (params) =>
  mastersService.list(TYPE, params));

export const postAddTaxationMiddileware = masterThunk(POST_TAXATION, (values) =>
  mastersService.create(TYPE, values));

export const getTaxationSearchList = masterThunk(GET_TAXATION_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getTaxationView = masterThunk(GET_TAXATION_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const patchTaxationEdit = masterThunk(PATCH_TAXATION_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getpatchTaxationEdit = masterThunk(GET_PATCH_TAXATION_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
