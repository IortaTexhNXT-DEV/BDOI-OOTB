import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";
import {
  GET_PATCH_PETTY_CASH_EDIT,
  GET_PETTY_CASH_BY_ID,
  GET_PETTY_CASH_SEARCH_LIST,
  GET_PETTY_CASH_VIEW,
  PATCH_PETTY_CASH_EDIT,
  POST_ADD_PETTY_CASH,
} from "../../../../redux/actionTypes";

const TYPE = "petty-cash";

export const pettyCashMaster = masterThunk(GET_PETTY_CASH_BY_ID, (params) =>
  mastersService.list(TYPE, params));

export const postAddPettyCash = masterThunk(POST_ADD_PETTY_CASH, (values) =>
  mastersService.create(TYPE, values));

export const getPettyCashSearchList = masterThunk(GET_PETTY_CASH_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getPettyCashView = masterThunk(GET_PETTY_CASH_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const patchPettyCashEdit = masterThunk(PATCH_PETTY_CASH_EDIT, (values) =>
  mastersService.update(TYPE, values.id, values));

export const getPatchPettyCashEdit = masterThunk(GET_PATCH_PETTY_CASH_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));
