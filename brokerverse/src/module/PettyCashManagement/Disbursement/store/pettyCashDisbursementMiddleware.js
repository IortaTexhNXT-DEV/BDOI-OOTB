import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_DISBURSMENT_VOUCHER_LIST,
  GET_DISBURSMENT_VOUCHER_SEARCH,
  POST_ADD_DISBURSMENT_VOUCHER,
  GET_ADD_DISBURSMENT_TABLE_VOUCHER,
  POST_EDIT_DISBURSMENT_VOUCHER,
  GET_VIEW_DISBURSMENT_VOUCHER,
  GET_ADD_DISBURSMENT_REQUEST_TABLE_VOUCHER,
  GET_DISBURSMENT_REQUEST_PATCH_DATA,
  POST_DISBURSMENT_REQUEST_PATCH_DATA,
  POST_DISBURSMENT_REQUEST,
  GET_DISBURSMENT_VIEW_DATA,
} from "../../../../redux/actionTypes";
import pettyCashService from "../../../../services/pettyCashService";
import { formatDisplayDate, optionCode, toApiDate } from "../../pettyCashFormat";

const errorMessage = (error) => error?.message || "Something went wrong";
const amount = (value) => parseFloat(value) || 0;

/** A saved petty cash disbursement as a row of the Disbursement screens (with its single line). */
export const toDisbursementRow = (d) => ({
  id: d.id,
  PettyCashCode: d.pettyCashCode,
  Date: formatDisplayDate(d.date),
  TransactionCode: d.transactionCode || "",
  TransactionNumber: d.transactionNumber,
  Criteria: d.criteria || "",
  VATMainAccount: d.vatAccount || "",
  VATSubAccount: "",
  WHTMainAccount: d.whtAccount || "",
  WHTSubAccount: "",
  Remarks: d.remarks || "",
  line: {
    id: d.id,
    RequestNumber: d.requestNumber || "",
    ExpenseCode: d.expenseAccount,
    SubAc: "",
    Purpose: "",
    Remarks: d.remarks || "",
    Amount: d.amount,
    VAT: d.vat,
    WHT: d.wht,
    NetAmount: d.netAmount,
  },
});

/** Line entered on the Add Disbursement table. */
const toLine = (values, id) => ({
  id,
  RequestNumber: optionCode(values.RequestNumber) || "",
  requestLabel: values.RequestNumber?.label || optionCode(values.RequestNumber) || "",
  ExpenseCode: optionCode(values.ExpenseCode) || "",
  SubAc: optionCode(values.SubAc) || "",
  Purpose: values.Purpose || "",
  Remarks: values.Remarks || "",
  Amount: values.Amount,
  VAT: values.VAT || "0",
  WHT: values.WHT || "0",
  NetAmount: (amount(values.Amount) - amount(values.WHT)).toFixed(2),
});

export const getDisbursmentListMiddleware = createAsyncThunk(
  GET_DISBURSMENT_VOUCHER_LIST,
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("disbursements", params || {});
      return (data || []).map(toDisbursementRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getDisbursmentSearchMiddleware = createAsyncThunk(
  GET_DISBURSMENT_VOUCHER_SEARCH,
  async ({ value }, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("disbursements", { search: value });
      return (data || []).map(toDisbursementRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Header of a new disbursement (fund, criteria, VAT / WHT accounts); lines follow on the next screen. */
export const postAddDisbursmentMiddleware = createAsyncThunk(
  POST_ADD_DISBURSMENT_VOUCHER,
  async (values) => values
);

/** Posts one disbursement per line (each journalised and paid from the fund). */
export const postEditDisbursmentMiddleware = createAsyncThunk(
  POST_EDIT_DISBURSMENT_VOUCHER,
  async (lines, { getState, rejectWithValue }) => {
    const { AddDisbursment: header = {} } = getState().pettyCashDisbursementReducers || {};
    const created = [];
    try {
      for (const line of lines) {
        const saved = await pettyCashService.create("disbursements", {
          pettyCashCode: optionCode(header.PettyCashCode),
          criteria: optionCode(header.Criteria),
          date: toApiDate(header.Date),
          vatAccount: optionCode(header.VATSubAccount) || optionCode(header.VATMainAccount),
          whtAccount: optionCode(header.WHTSubAccount) || optionCode(header.WHTMainAccount),
          requestId: line.RequestNumber || undefined,
          expenseAccount: line.SubAc || line.ExpenseCode,
          amount: line.Amount,
          vat: line.VAT,
          wht: line.WHT,
          remarks: line.Remarks || line.Purpose || header.Remarks || undefined,
        });
        created.push(toDisbursementRow(saved));
      }
      return created;
    } catch (error) {
      return rejectWithValue(
        created.length
          ? `${created.length} line(s) saved; ${errorMessage(error)}`
          : errorMessage(error)
      );
    }
  }
);

/** Lines pre-filled from the approved requests selected on the Add Disbursement screen. */
export const getAddDisbursmentTableMiddleware = createAsyncThunk(
  GET_ADD_DISBURSMENT_TABLE_VOUCHER,
  async (requests = []) =>
    requests.map((request) =>
      toLine(
        {
          RequestNumber: request,
          Amount: String(request.totalAmount),
          Purpose: request.purpose,
        },
        `line-${request.id}`
      )
    )
);

/** Approved requests of the selected fund, for the "Requested By" dropdown. */
export const getAddDisbursmentRequestListTableMiddleware = createAsyncThunk(
  GET_ADD_DISBURSMENT_REQUEST_TABLE_VOUCHER,
  async (pettyCashCode, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("requests", {
        pettyCashCode,
        status: "approved",
      });
      return (data || []).map((r) => ({
        id: r.id,
        TransactionCode: r.pettyCashCode,
        DocumentNumber: r.requestNumber,
        RequesterName: r.requesterName,
        label: `${r.requestNumber} - ${r.requesterName}`,
        value: r.requestNumber,
        totalAmount: r.totalAmount,
        purpose: r.purpose || "",
      }));
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getViewDisbursmentMiddleware = createAsyncThunk(
  GET_VIEW_DISBURSMENT_VOUCHER,
  async (row) => row
);

export const getPatchDisbursementData = createAsyncThunk(
  GET_DISBURSMENT_REQUEST_PATCH_DATA,
  async (row) => row
);

export const postDisbursementData = createAsyncThunk(
  POST_DISBURSMENT_REQUEST,
  async (values) => toLine(values, `line-${Date.now()}`)
);

export const postPatchDisbursementData = createAsyncThunk(
  POST_DISBURSMENT_REQUEST_PATCH_DATA,
  async (values) => toLine(values, values.id)
);

export const getDisbursmentViewMiddleware = createAsyncThunk(
  GET_DISBURSMENT_VIEW_DATA,
  async (row) => row
);
