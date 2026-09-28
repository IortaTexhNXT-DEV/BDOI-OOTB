import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_PAYMENT_DATA,
  GET_PAYMENTTABLE_DATA,
  GET_PAYMENT_SEARCH,
  GET_PAYMENT_PAID_SEARCH,
  GET_PAYMENT_PENDING_SEARCH,
  GET_PAYMENTTABLE_PENDING_DATA,
  GET_PAYMENTTABLE_REWING_DATA,
} from "../../../redux/actionTypes";
import paymentsService from "../../../services/paymentsService";

const errorMessage = (error) => error?.message || "Something went wrong";
const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const SOURCE_LABEL = { policy: "Policy", renewal: "Renewal Policy", endorsement: "Endorsement" };

/** A premium bill as a row of the Payments tables. */
export const toPaymentRow = (p) => ({
  id: p.id,
  policyId: p.policyId,
  type: SOURCE_LABEL[p.source] || p.source || "",
  name: p.clientName || "",
  clintid: p.clientId || "",
  policyNo: p.policyNumber || "",
  grosspremium: money(p.grossPremium),
  outstanding: p.outstanding,
  commission: p.commission,
  policyIssued: p.date || "",
  policyExpird: p.dueDate || "",
  status: p.status,
});

/** Policy number filters on its own column; anything else uses the free-text search. */
const searchParams = (field, value) =>
  field === "PolicyNumber" ? { policyNumber: value } : { search: value };

const loadPayments = (status, params = {}) =>
  paymentsService.getPayments({ status, ...params });

const listThunk = (type, status) =>
  createAsyncThunk(type, async (params, { rejectWithValue }) => {
    try {
      const result = await loadPayments(status, params || {});
      return (result.data || []).map(toPaymentRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  });

const searchThunk = (type, status) =>
  createAsyncThunk(type, async ({ field, value }, { rejectWithValue }) => {
    try {
      const result = await loadPayments(status, searchParams(field, value));
      return (result.data || []).map(toPaymentRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  });

export const getpaymenttableMiddleware = listThunk(GET_PAYMENTTABLE_DATA, "PAID");
export const getpaymentPendingtableMiddleware = listThunk(GET_PAYMENTTABLE_PENDING_DATA, "PENDING");
export const getpaymentRewivingtableMiddleware = listThunk(GET_PAYMENTTABLE_REWING_DATA, "REVIEWING");

export const getPaymentSearchDataMiddleWare = searchThunk(GET_PAYMENT_SEARCH, "REVIEWING");
export const getPaymentPaidSearchDataMiddleWare = searchThunk(GET_PAYMENT_PAID_SEARCH, "PAID");
export const getPaymentPendingSearchDataMiddleWare = searchThunk(GET_PAYMENT_PENDING_SEARCH, "PENDING");

/** Summary cards: gross premium, collected, receivables and commission earned on paid bills. */
export const postpaymentdataMiddleWare = createAsyncThunk(
  POST_PAYMENT_DATA,
  async (_, { rejectWithValue }) => {
    try {
      const paid = await loadPayments("PAID", { pageSize: 500 });
      const summary = paid.summary || {};
      const buckets = ["paid", "pending", "reviewing"].map((k) => summary[k] || {});
      const gross = buckets.reduce((sum, b) => sum + (b.grossPremium || 0), 0);
      const receivables = buckets.reduce((sum, b) => sum + (b.outstanding || 0), 0);
      const commission = (paid.data || []).reduce((sum, p) => sum + (Number(p.commission) || 0), 0);
      return { gross, collected: gross - receivables, receivables, commission };
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);
