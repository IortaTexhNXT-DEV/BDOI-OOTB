import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";
import {
  GET_ADD_EXCHANGE,
  GET_EXCHANGE_DETAIL_VIEW,
  GET_EXCHANGE_EDIT,
  GET_EXCHANGE_LIST,
  GET_EXCHANGE_SEARCH_LIST,
  PATCH_EXCHANGE_DETAIL_EDIT,
  POST_EXCHANGE_STATUS,
} from "../../../../redux/actionTypes";

const TYPE = "exchange-rate";

export const getExchangeList = masterThunk(GET_EXCHANGE_LIST, (params) =>
  mastersService.list(TYPE, params));

export const getExchangeSearchList = masterThunk(GET_EXCHANGE_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const postExchangeStatus = masterThunk(POST_EXCHANGE_STATUS, (values) =>
  mastersService.create(TYPE, values));

export const getAddExchange = masterThunk(GET_ADD_EXCHANGE, (payload) => payload);

export const patchExchangeDetailEdit = masterThunk(PATCH_EXCHANGE_DETAIL_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getExchangeDetailEdit = masterThunk(GET_EXCHANGE_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getExchangeDetailView = masterThunk(GET_EXCHANGE_DETAIL_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
