import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_REQUEST_VOUCHER_LIST,
  GET_REQUEST_VOUCHER_SEARCH,
  POST_ADD_REQUEST_VOUCHER,
  GET_ADD_REQUEST_TABLE_VOUCHER,
  POST_EDIT_REQUEST_VOUCHER,
  GET_EDIT_REQUEST,
  PATCH_UPDATE_COMPANYDATA,
} from "../../../../redux/actionTypes";
import pettyCashService from "../../../../services/pettyCashService";
import { formatDisplayDate, optionCode, toApiDate } from "../../pettyCashFormat";

const errorMessage = (error) => error?.message || "Something went wrong";

const toLineRow = (line, index) => ({
  id: line.id ?? index + 1,
  Narration: line.narration,
  Amount: String(line.amount),
  ExpenseAccount: line.expenseAccount || "",
});

/** A petty cash request as a row of the Request screens. */
export const toRequestRow = (request) => ({
  id: request.id,
  RequestNumber: request.requestNumber,
  TransactionNumber: request.requestNumber,
  PettycashCode: request.pettyCashCode,
  RequesterName: request.requesterName,
  RequestDate: formatDisplayDate(request.requestDate),
  Branchcode: request.branchCode || "",
  Departmentcode: request.departmentCode || "",
  TotalAmount: String(request.totalAmount ?? ""),
  Date: formatDisplayDate(request.createdAt),
  status: request.status,
  rejectionReason: request.rejectionReason,
  createdBy: request.createdBy,
  approvedAt: request.approvedAt,
  approvedByName: request.approvedByName || null,
  purpose: request.purpose || "",
  requestDateValue: request.requestDate,
  lines: (request.lines || []).map(toLineRow),
});

const toApiLines = (rows = []) =>
  rows.map((row) => ({
    narration: row.Narration,
    amount: row.Amount,
    expenseAccount: row.ExpenseAccount || undefined,
  }));

const requesterName = (value) =>
  typeof value === "object" && value ? value.label || value.Name : value;

export const getRequestListMiddleware = createAsyncThunk(
  GET_REQUEST_VOUCHER_LIST,
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("requests", params || {});
      return (data || []).map(toRequestRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getRequestSearchMiddleware = createAsyncThunk(
  GET_REQUEST_VOUCHER_SEARCH,
  async ({ value }, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("requests", { search: value });
      return (data || []).map(toRequestRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Creates the request from the header (Add Request form) and the lines; submit sends it for approval. */
export const postAddRequestMiddleware = createAsyncThunk(
  POST_ADD_REQUEST_VOUCHER,
  async ({ submit = false } = {}, { getState, rejectWithValue }) => {
    const { RequestDraft = {}, AddRequestTable = [] } = getState().pettyCashRequestReducer || {};
    try {
      const request = await pettyCashService.create("requests", {
        pettyCashCode: optionCode(RequestDraft.PettyCashCode),
        requesterName: requesterName(RequestDraft.RequesterName),
        requestDate: toApiDate(RequestDraft.RequestDate),
        lines: toApiLines(AddRequestTable),
        submit,
      });
      return toRequestRow(request);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Saves an edited draft / rejected request (lines replace the saved ones). */
export const patchupdateRequestMiddleware = createAsyncThunk(
  PATCH_UPDATE_COMPANYDATA,
  async (values, { getState, rejectWithValue }) => {
    const { AddRequestTable = [] } = getState().pettyCashRequestReducer || {};
    try {
      const request = await pettyCashService.updateRequest(values.id, {
        requesterName: requesterName(values.RequesterName),
        requestDate: toApiDate(values.RequestDate),
        lines: toApiLines(AddRequestTable),
      });
      return toRequestRow(request);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** submit | approve | reject a request ({ id, action, reason }). */
export const transitionRequestMiddleware = createAsyncThunk(
  "pettyCashrequest/TRANSITION_REQUEST",
  async ({ id, action, reason }, { rejectWithValue }) => {
    try {
      return toRequestRow(await pettyCashService.transitionRequest(id, action, reason));
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getAddRequestTableMiddleware = createAsyncThunk(
  GET_ADD_REQUEST_TABLE_VOUCHER,
  async (payload) => payload
);

/** Adds a line (narration, amount) to the request being edited. */
export const postEditRequestMiddleware = createAsyncThunk(
  POST_EDIT_REQUEST_VOUCHER,
  async (payload) => ({
    id: `line-${Date.now()}`,
    Narration: payload?.Narration,
    Amount: payload?.Amount,
  })
);

/** Loads a request (with its lines) for the view / edit screen. */
export const geteditrequestMiddleware = createAsyncThunk(
  GET_EDIT_REQUEST,
  async (row, { rejectWithValue }) => {
    try {
      return toRequestRow(await pettyCashService.get("requests", row?.id || row));
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);
