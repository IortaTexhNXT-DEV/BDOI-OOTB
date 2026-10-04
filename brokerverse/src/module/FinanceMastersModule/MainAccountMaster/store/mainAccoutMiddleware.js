import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";
import {
  GET_ADD_MAIN_ACCOUNT,
  GET_MAIN_ACCOUNT_LIST,
  GET_MAIN_ACCOUNT_SEARCH_LIST,
  GET_MAIN_ACCOUNT_VIEW,
  GET_PATCH_MAIN_ACCOUNT_DETAIL_EDIT,
  PATCH_MAIN_ACCOUNT_DETAIL_EDIT,
  POST_MAIN_ACCOUNT_STATUS,
} from "../../../../redux/actionTypes";

const TYPE = "main-account";

export const getMainAccountList = masterThunk(GET_MAIN_ACCOUNT_LIST, (params) =>
  mastersService.list(TYPE, params));

export const getMainAccountSearchList = masterThunk(GET_MAIN_ACCOUNT_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const postMainAccountStatus = masterThunk(POST_MAIN_ACCOUNT_STATUS, (values) =>
  mastersService.create(TYPE, values));

export const getAddMainAccount = masterThunk(GET_ADD_MAIN_ACCOUNT, (payload) => payload);

export const getPatchMainAccountDetailEdit = masterThunk(GET_PATCH_MAIN_ACCOUNT_DETAIL_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const patchMainAccountDetailEdit = masterThunk(PATCH_MAIN_ACCOUNT_DETAIL_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getMainAccountDetailView = masterThunk(GET_MAIN_ACCOUNT_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
