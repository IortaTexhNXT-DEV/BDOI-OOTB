import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_EXPIRINGTABLE_DATA,
  GET_EXPIRING_SEARCH,
} from "../../../../../redux/actionTypes";
import ClientListing from "../../../../quoteModule/clientListing";

export const getexpiringtableMiddleware = createAsyncThunk(
  GET_EXPIRINGTABLE_DATA,

  async (payload, { rejectWithValue }) => {
    try {
      // Simulate an API call if needed
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      // return filteredData[0];
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const getExpiringSearchDataMiddleWare = createAsyncThunk(
  GET_EXPIRING_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "sssss");
    const { agentExpiringMainReducers } = getState();
    const { expiringtabledata } = agentExpiringMainReducers;
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter((item) => {
        if (field === "AssuredName") {
          return item.AssuredName.toLowerCase().includes(lowercasedValue);
        } else if (field === "PolicyNumber") {
          return item.PolicyNumber.toLowerCase().includes(lowercasedValue);
        }
        return (
          item.AssuredName.toLowerCase().includes(lowercasedValue) ||
          item.PolicyNumber.toLowerCase().includes(lowercasedValue)
        );
      });
      return outputData;
    }
    try {
      const filteredPayments = filterPaymentsByField(
        expiringtabledata,
        field,
        value
      );
      console.log(filteredPayments, "filteredPayments");
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
