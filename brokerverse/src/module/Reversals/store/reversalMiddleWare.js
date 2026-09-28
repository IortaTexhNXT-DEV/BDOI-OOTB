import { createAsyncThunk } from "@reduxjs/toolkit";
import journalVoucherService, {
  apiErrorMessage,
} from "../../../services/journalVoucherService";
import { GET_REVERSAL_JV_LIST, POST_REVERSAL_JV } from "../../../redux/actionTypes";

const OPPOSITE = { Debit: "Credit", Credit: "Debit" };

/** The reversal preview: the original voucher's lines with Debit / Credit swapped. */
const toReversalRow = (entry) => ({
  id: entry.lineId || entry.id,
  mainAccount: entry.mainAccount,
  subAccount: entry.subAccount,
  branchCode: entry.branchCode,
  departmentCode: entry.departmentCode,
  remarks: entry.remarks,
  currencyCode: entry.currencyCode,
  localAmount: entry.localAmount,
  entryType: OPPOSITE[entry.entryType] || entry.entryType,
});

export const getReversalTabelData = createAsyncThunk(
  GET_REVERSAL_JV_LIST,
  async (transactionNumber, { rejectWithValue }) => {
    try {
      const voucher = await journalVoucherService.getVoucher(transactionNumber);
      return { voucher, rows: (voucher?.entries || []).map(toReversalRow) };
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, "Journal voucher not found"));
    }
  }
);

export const postReversalJVData = createAsyncThunk(
  POST_REVERSAL_JV,
  async (payload, { rejectWithValue }) => {
    try {
      return await journalVoucherService.createReversal(payload);
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error));
    }
  }
);
