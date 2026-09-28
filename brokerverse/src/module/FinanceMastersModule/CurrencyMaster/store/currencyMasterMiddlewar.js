import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";
import {
  GET_CURRENCY_DETAIL_EDIT,
  GET_CURRENCY_DETAIL_VIEW,
  GET_CURRENCY_LIST,
  GET_CURRENCY_SEARCH_LIST,
  PATCH_CURRENCY_DETAIL_EDIT,
  POST_ADD_CURRENCY,
  POST_CURRENCY_STATUS,
} from "../../../../redux/actionTypes";

const TYPE = "currency";

export const getCurrencyList = masterThunk(GET_CURRENCY_LIST, (params) =>
  mastersService.list(TYPE, params));

export const getCurrencySearchList = masterThunk(GET_CURRENCY_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const postCurrencyStatus = masterThunk(POST_CURRENCY_STATUS, ({ id, active }) =>
  mastersService.setStatus(TYPE, id, active));

export const postAddCurrency = masterThunk(POST_ADD_CURRENCY, (values) =>
  mastersService.create(TYPE, values));

export const getCurrencyDetailEdit = masterThunk(GET_CURRENCY_DETAIL_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const patchCurrencyDetailEdit = masterThunk(PATCH_CURRENCY_DETAIL_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getCurrencyDetailView = masterThunk(GET_CURRENCY_DETAIL_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
