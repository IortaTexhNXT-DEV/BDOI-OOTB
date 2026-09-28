import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";
import {
  GET_PATCH_SUB_ACCOUNT_EDIT,
  GET_SUB_ACCOUNT_SEARCH_LIST,
  GET_SUB__ACCOUNT_BY_ID,
  GET_SUB__ACCOUNT_VIEW,
  PATCH_SUB__ACCOUNT_EDIT,
  POST_SUB__ACCOUNT,
} from "../../../../redux/actionTypes";

const TYPE = "sub-account";

export const getSubAccount = masterThunk(GET_SUB__ACCOUNT_BY_ID, (params) =>
  mastersService.list(TYPE, params));

export const postSubAccount = masterThunk(POST_SUB__ACCOUNT, (values) =>
  mastersService.create(TYPE, values));

export const getSubAccountSearchList = masterThunk(GET_SUB_ACCOUNT_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));

export const getSubAccountView = masterThunk(GET_SUB__ACCOUNT_VIEW, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const getSubAccountEdit = masterThunk(GET_PATCH_SUB_ACCOUNT_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row));

export const patchSubAccountEdit = masterThunk(PATCH_SUB__ACCOUNT_EDIT, async (values) => {
  await mastersService.update(TYPE, values.id, values);
  return mastersService.list(TYPE);
});
