import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";
import {
  GET_ACCOUNT_CATEGORY_DETAIL_EDIT,
  GET_ACCOUNT_CATEGORY_DETAIL_VIEW,
  GET_ACCOUNT_CATEGORY_LIST,
  GET_ACCOUNT_CATEGORY_SEARCH_LIST,
  GET_ADD_ACCOUNT_CATEGORY,
  PATCH_ACCOUNT_CATEGORY_DETAIL_EDIT,
  POST_ACCOUNT_CATEGORY_STATUS,
} from "../../../../redux/actionTypes";

const TYPE = "account-category";

export const getAccountCategoryList = masterThunk(GET_ACCOUNT_CATEGORY_LIST, (params) =>
  mastersService.list(TYPE, params));

export const getAccountCategorySearchList = masterThunk(GET_ACCOUNT_CATEGORY_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const postAccountCategoryStatus = masterThunk(POST_ACCOUNT_CATEGORY_STATUS, ({ id, active }) =>
  mastersService.setStatus(TYPE, id, active));

export const getAddAccountCategoryMiddleWare = masterThunk(GET_ADD_ACCOUNT_CATEGORY, (values) =>
  mastersService.create(TYPE, values));

export const getAccountCategoryDetailEditMiddleWare = masterThunk(GET_ACCOUNT_CATEGORY_DETAIL_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getAccountCategoryDetailViewMiddleWare = masterThunk(GET_ACCOUNT_CATEGORY_DETAIL_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const patchAccountCategoryDetailEditMiddleWare = masterThunk(PATCH_ACCOUNT_CATEGORY_DETAIL_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));
