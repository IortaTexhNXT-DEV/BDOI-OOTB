import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../common/masterThunk";
import {
  ADD_LEVEL_PATCH_COMMISSION_EDIT_POPUP,
  GET_COMMISSION,
  GET_COMMISSION_BY_ID,
  GET_COMMISSION_POPUP_VIEW,
  GET_COMMISSION_SEARCH_LIST,
  GET_COMMISSION_SHARING,
  GET_COMMISSION_VIEW,
  GET_PATCH_COMMISSION_EDIT,
  GET_PATCH_COMMISSION_EDIT_POPUP,
  PATCH_COMMISSION_EDIT,
  POST_ADD_SHARINGRATE_COMMISSION,
  POST_COMMISSION,
} from "../../../../redux/actionTypes";

const TYPE = "commission";

/** Level-wise sharing rows as stored on the commission record (the in-screen id is dropped). */
const toSharing = (rows = []) =>
  rows.map(({ level, commissionCode, sharingRate }) => ({ level, commissionCode, sharingRate }));

/** Commission record with the sharing rows currently in the screen's level-wise table. */
const toRecord = (values, getState) => ({
  ...values,
  sharing: toSharing(getState().commissionMianReducers?.addLevelCommissionSharing),
});

let nextSharingId = 1;
const withSharingId = (row) => ({ ...row, id: row.id ?? `share-${nextSharingId++}` });

export const CommissionData = masterThunk(GET_COMMISSION, (params) => mastersService.list(TYPE, params));

export const getCommission = masterThunk(GET_COMMISSION_BY_ID, (params) => mastersService.list(TYPE, params));

export const postAddCommission = masterThunk(POST_COMMISSION, (values, { getState }) =>
  mastersService.create(TYPE, toRecord(values, getState))
);

export const getCommissionSearchList = masterThunk(GET_COMMISSION_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) })
);

export const getCommissionView = masterThunk(GET_COMMISSION_VIEW, (row) => mastersService.get(TYPE, row?.id ?? row));

export const patchCommissionEdit = masterThunk(PATCH_COMMISSION_EDIT, (values, { getState }) =>
  mastersService.update(TYPE, values.id, toRecord(values, getState))
);

export const getPatchCommissionEditMiddleware = masterThunk(GET_PATCH_COMMISSION_EDIT, (row) =>
  mastersService.get(TYPE, row?.id ?? row)
);

/** Replaces the level-wise sharing table (e.g. [] for a new commission, or a record's sharing rows). */
export const getLevelCommissionSharing = masterThunk(GET_COMMISSION_SHARING, (rows) =>
  (Array.isArray(rows) ? rows : []).map(withSharingId)
);

export const postAddLevelShareRatingCommission = masterThunk(POST_ADD_SHARINGRATE_COMMISSION, (row) =>
  withSharingId({ level: row?.level, commissionCode: row?.commissionCode, sharingRate: row?.sharingRate })
);

export const getEditCommissionPopup = masterThunk(GET_PATCH_COMMISSION_EDIT_POPUP, (row) => row);

export const addLevelPatchEditPopup = masterThunk(ADD_LEVEL_PATCH_COMMISSION_EDIT_POPUP, (row) => ({
  id: row?.id,
  level: row?.level,
  commissionCode: row?.commissionCode,
  sharingRate: row?.sharingRate,
}));

export const getCommissionPopupView = masterThunk(GET_COMMISSION_POPUP_VIEW, (row) => row);
