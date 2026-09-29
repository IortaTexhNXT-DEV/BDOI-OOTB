import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_PETTY_CASH_VOUCHER_INITIAT_TABLE,
  GET_PETTY_CASH_VOUCHER_INITIAT_SEARCH,
  POST_PETTY_CASH_VOUCHER_INITIAT,
  GET_PETTY_CASH_VOUCHER_INITIAT_VIEW,
} from "../../../../redux/actionTypes";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";

export const getInitiateListMiddleware = createAsyncThunk(
  GET_PETTY_CASH_VOUCHER_INITIAT_TABLE,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getInitiateListSearchMiddleware = createAsyncThunk(
  GET_PETTY_CASH_VOUCHER_INITIAT_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { pettyCashInitiateReducer } = getState();
    const { InitiateList } = pettyCashInitiateReducer;
    function filterReceiptsByField(receipts, field, value) {
      const lowercasedValue = value.toLowerCase();
      return receipts.filter(receipt => receipt[field].toLowerCase().startsWith(lowercasedValue));
    }

    // Example usage:

    // const filteredData = paymentVocherList.filter((item) => item.id === 1);
    try {
      const filteredReceipts = filterReceiptsByField(InitiateList, field, value);

      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return filteredReceipts;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postInitiateMiddleware = createAsyncThunk(
  POST_PETTY_CASH_VOUCHER_INITIAT,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "leomaxvj");
    const currentDate = new Date(); // Get current date
    const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
    const TableData = {
      id: payload?.id,
      TransactionDate:formattedDate,
      TransactionCode: "",
      TransactionNumber: "Trans001",
      Pettycashcode: payload?.PettyCashCodes?.PettyCashCodes,
      PettyCashdescription: "",
      Pettycashsize: payload?.PettyCashSize,
      BankCode: "",
  BankAccountCode:"",
  MainAccountCode: "",
  SubAccountCode: "",
  Currency: "",
  Currencydescription: "",
  Branchcode: payload?.BranchCode?.Branchcode,
  Branchdescription: "",
  Departmentcode: payload?.DepartmentCode?.Departcode,
  Departmentdescription: "",
  AvailableCash: "",
  MaxLimit: payload?.MaxLimit,
  MinimumCashbox: "",
    
      // Date: formattedDate,
    };

    try {
      console.log(TableData, "TableData");
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return TableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getInitiateDetailsMiddleware = createAsyncThunk(
  GET_PETTY_CASH_VOUCHER_INITIAT_VIEW,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      console.log("first1",payload)
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
