import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_REPLENISH_VOUCHER_LIST,
  GET_REPLENISH_VOUCHER_SEARCH,
  POST_ADD_REPLENISH_VOUCHER,
  GET_ADD_REPLENISH_TABLE_VOUCHER,
  GET_VIEW_REPLENISH_VOUCHER,
} from "../../../../redux/actionTypes";
import pettyCashService from "../../../../services/pettyCashService";
import { formatDisplayDate, optionCode } from "../../pettyCashFormat";

const errorMessage = (error) => error?.message || "Something went wrong";

/** A replenishment as a row of the Replenish screens. */
export const toReplenishRow = (r) => ({
  id: r.id,
  Pettycashcode: r.pettyCashCode,
  Branchcode: r.branchCode || "",
  Transactioncode: r.transactionCode || "",
  BankCode: r.bankCode || "",
  SubAccount: r.subAccount || "",
  TransactionNumber: r.transactionNumber,
  Date: formatDisplayDate(r.date),
  dateValue: r.date,
  Amount: r.amount,
  Remarks: r.remarks || "",
});

/** A disbursement paid from the fund (the expenses a replenishment reimburses). */
const toExpenseRow = (d) => ({
  id: d.id,
  Transactioncode: d.transactionCode || d.transactionNumber,
  DocNumber: d.transactionNumber,
  Narration: d.remarks || d.expenseAccount,
  Date: formatDisplayDate(d.date),
  Remarks: d.requestNumber || "",
  Amount: d.netAmount,
});

export const getReplenishListMiddleware = createAsyncThunk(
  GET_REPLENISH_VOUCHER_LIST,
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("replenishments", params || {});
      return (data || []).map(toReplenishRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getReplenishSearchMiddleware = createAsyncThunk(
  GET_REPLENISH_VOUCHER_SEARCH,
  async ({ value }, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("replenishments", { search: value });
      return (data || []).map(toReplenishRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Header of the replenishment (fund, bank, sub account); loads the fund's disbursements. */
export const getAddReplenishTableMiddleware = createAsyncThunk(
  GET_ADD_REPLENISH_TABLE_VOUCHER,
  async (header, { rejectWithValue }) => {
    try {
      const pettyCashCode = optionCode(header?.PettycashCode);
      const [{ data }, fund] = await Promise.all([
        pettyCashService.list("disbursements", { pettyCashCode }),
        pettyCashService.get("funds", pettyCashCode),
      ]);
      return { header, fund, rows: (data || []).map(toExpenseRow) };
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Replenishes the fund by the amount of the selected expenses (Dr Petty Cash / Cr Cash in Bank). */
export const postAddReplenishMiddleware = createAsyncThunk(
  POST_ADD_REPLENISH_VOUCHER,
  async (amount, { getState, rejectWithValue }) => {
    const { AddReplenish: header = {} } = getState().pettyCashReplenishReducer || {};
    try {
      const saved = await pettyCashService.create("replenishments", {
        pettyCashCode: optionCode(header.PettycashCode),
        amount: amount > 0 ? amount : undefined,
        bankCode: optionCode(header.BankCode),
        subAccountCode: optionCode(header.SubAccountCode),
        transactionCode: optionCode(header.TransactionCode),
        branchCode: optionCode(header.BranchCode),
        remarks: header.Remarks || undefined,
      });
      return toReplenishRow(saved);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getViewReplenishMiddleware = createAsyncThunk(
  GET_VIEW_REPLENISH_VOUCHER,
  async (row) => row
);
