import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_QUOTEPENDINGTABLE_DATA,
  GET_QUOTEPENDING_SEARCH,
} from "../../../../../redux/actionTypes";
import ClientListing from "../../../../quoteModule/clientListing";

export const getquotependingtableMiddleware = createAsyncThunk(
  GET_QUOTEPENDINGTABLE_DATA,

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

export const getQuotependingSearchDataMiddleWare = createAsyncThunk(
  GET_QUOTEPENDING_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "find midd data");
    const { agentQuotependingMainReducers } = getState();
    const { quotependingtabledata } = agentQuotependingMainReducers;
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter((item) => {
        if (field === "Name") {
          return item.Name.toLowerCase().includes(lowercasedValue);
        } else if (field === "QuoteId") {
          return item.QuoteId.toLowerCase().includes(lowercasedValue);
        }
        return (
          item.Name.toLowerCase().includes(lowercasedValue) ||
          item.QuoteId.toLowerCase().includes(lowercasedValue)
        );
      });
      return outputData;
    }
    try {
      const filteredPayments = filterPaymentsByField(
        quotependingtabledata,
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
