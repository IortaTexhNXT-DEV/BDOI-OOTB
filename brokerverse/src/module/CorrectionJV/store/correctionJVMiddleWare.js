import { createAsyncThunk } from "@reduxjs/toolkit";
import journalVoucherService, {
  apiErrorMessage,
} from "../../../services/journalVoucherService";
import {
  GET_CORRECTION_JV_LIST,
  GET_CORRECTION_JV_VIEW,
  GET_PATCH_CORRECTION_JV_EDIT,
  PATCH_CORRECTION_JV_EDIT,
  POST_CORRECTION_JV,
} from "../../../redux/actionTypes";

/** A voucher line as an editable correction row. */
export const toCorrectionRow = (entry) => ({
  id: entry.lineId || entry.id,
  mainAccount: entry.mainAccount || "",
  mainAccountDescription: entry.mainAccountDescription || "",
  entryType: entry.entryType || "",
  subAccount: entry.subAccount || "",
  subAccountDescription: entry.subAccountDescription || "",
  branchCode: entry.branchCode || "",
  branchCodeDescription: entry.branchCodeDescription || "",
  departmentCode: entry.departmentCode || "",
  departmentDescription: entry.departmentDescription || "",
  currencyCode: entry.currencyCode || "",
  currencyDescription: entry.currencyDescription || "",
  foreignAmount: String(entry.foreignAmount ?? entry.localAmount ?? ""),
  localAmount: String(entry.localAmount ?? ""),
  remarks: entry.remarks || "",
});

/** Loads the posted voucher (transactionNumber) whose lines are to be corrected. */
export const getCorrectionJVTabelData = createAsyncThunk(
  GET_CORRECTION_JV_LIST,
  async (transactionNumber, { rejectWithValue }) => {
    try {
      const voucher = await journalVoucherService.getVoucher(transactionNumber);
      return { voucher, rows: (voucher?.entries || []).map(toCorrectionRow) };
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, "Journal voucher not found"));
    }
  }
);

/** Posts the correction JV: reverses the original and books the corrected lines. */
export const postCorrectionJVData = createAsyncThunk(
  POST_CORRECTION_JV,
  async (payload, { rejectWithValue }) => {
    try {
      return await journalVoucherService.createCorrection(payload);
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error));
    }
  }
);

export const getCorrectionJVView = createAsyncThunk(
  GET_CORRECTION_JV_VIEW,
  async (payload) => payload
);

export const getPatchCorrectionJVEdit = createAsyncThunk(
  GET_PATCH_CORRECTION_JV_EDIT,
  async (payload) => payload
);

/** Applies an edited line to the correction rows (local until the correction is posted). */
export const patchCorrectionJVEdit = createAsyncThunk(
  PATCH_CORRECTION_JV_EDIT,
  async (payload, { getState }) => {
    const { correctionJVList = [] } = getState().correctionJVMainReducers || {};
    const current = correctionJVList.find((row) => row.id === payload?.id) || {};
    const oldForeign = parseFloat(current.foreignAmount);
    const oldLocal = parseFloat(current.localAmount);
    const newForeign = parseFloat(payload?.foreignAmount);
    const rate =
      current.currencyCode === payload?.currencyCode && oldForeign > 0
        ? oldLocal / oldForeign
        : null;
    return {
      ...current,
      ...payload,
      localAmount:
        rate && newForeign > 0 ? (newForeign * rate).toFixed(2) : "",
    };
  }
);
