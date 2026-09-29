import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_RECEIPT_VOUCHER_LIST,
  GET_RECEIPT_VOUCHER_SEARCH,
  POST_ADD_RECEIPT_VOUCHER,
  GET_ADD_RECEIPT_TABLE_VOUCHER,
  GET_VIEW_RECEIPT_VOUCHER,
} from "../../../../redux/actionTypes";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";

export const getReceiptListMiddleware = createAsyncThunk(
  GET_RECEIPT_VOUCHER_LIST,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getReceiptSearchMiddleware = createAsyncThunk(
  GET_RECEIPT_VOUCHER_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { pettyCashReceiptsReducer } = getState();
    const { ReceiptList } = pettyCashReceiptsReducer;
    function filterReceiptsByField(receipts, field, value) {
      const lowercasedValue = value.toLowerCase();
      return receipts.filter(receipt => receipt[field].toLowerCase().startsWith(lowercasedValue));
    }

    try {
      const filteredReceipts = filterReceiptsByField(ReceiptList, field, value);

      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return filteredReceipts;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postAddReceiptMiddleware = createAsyncThunk(
  POST_ADD_RECEIPT_VOUCHER,
  async (payload, { rejectWithValue }) => {

    console.log(payload, "postAddReceiptMiddleware")

    const currentDate = new Date(); // Get current date
    const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1
      }/${currentDate.getFullYear()}`;
    const randomnumber = Math.floor(Math.random() * 50000) + 10000;
    const TableData = {
      id: payload?.id,
      ReceiptNo: payload.ReceiptNumber,
      RequesterName: payload.Requester.Name,
      Branchcode: payload.BranchCode.Branchcode,
      Transactioncode: payload.TransactionCode.Transcode,
      BankCode: payload.BankCode.BankAccountCode,
      SubAccount: payload.SubAccountCode.SubAccount,
      TransactionNumber: randomnumber,
      Date: formattedDate,
    };
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return TableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAddReceiptTableMiddleware = createAsyncThunk(
  GET_ADD_RECEIPT_TABLE_VOUCHER,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getViewReceiptMiddleware = createAsyncThunk(
  GET_VIEW_RECEIPT_VOUCHER,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
