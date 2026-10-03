import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_RECEIPT_VOUCHER_LIST,
  GET_RECEIPT_VOUCHER_SEARCH,
  POST_ADD_RECEIPT_VOUCHER,
  GET_ADD_RECEIPT_TABLE_VOUCHER,
  GET_VIEW_RECEIPT_VOUCHER,
} from "../../../../redux/actionTypes";
import pettyCashService from "../../../../services/pettyCashService";
import { formatDisplayDate, optionCode } from "../../pettyCashFormat";

const errorMessage = (error) => error?.message || "Something went wrong";

/** A petty cash receipt (cash returned to the fund) as a row of the Receipts screens. */
export const toReceiptRow = (r) => ({
  id: r.id,
  ReceiptNo: r.receiptNumber,
  RequesterName: r.requesterName || "",
  Branchcode: r.branchCode || "",
  Transactioncode: r.transactionCode || "",
  BankCode: r.bankCode || "",
  SubAccount: r.creditAccount || "",
  TransactionNumber: r.transactionNumber,
  Date: formatDisplayDate(r.date),
  line: {
    id: r.id,
    TransactionCode: r.pettyCashCode,
    RequestNumber: r.receiptNumber,
    Date: formatDisplayDate(r.date),
    Amount: r.amount,
    Remarks: r.remarks || "",
  },
});

/** A disbursement the cash can be returned against (Add Receipt table). */
const toDisbursedRow = (d) => ({
  id: d.id,
  PettyCashCode: d.pettyCashCode,
  TransactionCode: d.transactionNumber,
  RequestNumber: d.requestNumber || "",
  Date: formatDisplayDate(d.date),
  Amount: d.netAmount,
  Remarks: d.remarks || "",
});

export const getReceiptListMiddleware = createAsyncThunk(
  GET_RECEIPT_VOUCHER_LIST,
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("receipts", params || {});
      return (data || []).map(toReceiptRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getReceiptSearchMiddleware = createAsyncThunk(
  GET_RECEIPT_VOUCHER_SEARCH,
  async ({ value }, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("receipts", { search: value });
      return (data || []).map(toReceiptRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Header of a new receipt (requester, bank, credit account, codes); the amounts are chosen next. */
export const getAddReceiptTableMiddleware = createAsyncThunk(
  GET_ADD_RECEIPT_TABLE_VOUCHER,
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("disbursements");
      return (data || []).map(toDisbursedRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Records the cash returned for each selected disbursement (Dr Petty Cash / Cr credit account). */
export const postAddReceiptMiddleware = createAsyncThunk(
  POST_ADD_RECEIPT_VOUCHER,
  async (rows, { getState, rejectWithValue }) => {
    const { AddReceipt: header = {} } = getState().pettyCashReceiptsReducer || {};
    const created = [];
    try {
      for (const row of rows) {
        const receipt = await pettyCashService.create("receipts", {
          pettyCashCode: row.PettyCashCode,
          amount: row.Amount,
          requesterName: header.Requester?.label || optionCode(header.Requester),
          creditAccount: optionCode(header.SubAccountCode),
          bankCode: optionCode(header.BankCode),
          branchCode: optionCode(header.BranchCode),
          transactionCode: optionCode(header.TransactionCode),
          remarks: row.Remarks || undefined,
        });
        created.push(toReceiptRow(receipt));
      }
      return created;
    } catch (error) {
      return rejectWithValue(
        created.length ? `${created.length} receipt(s) saved; ${errorMessage(error)}` : errorMessage(error)
      );
    }
  }
);

export const getViewReceiptMiddleware = createAsyncThunk(
  GET_VIEW_RECEIPT_VOUCHER,
  async (row) => row
);
