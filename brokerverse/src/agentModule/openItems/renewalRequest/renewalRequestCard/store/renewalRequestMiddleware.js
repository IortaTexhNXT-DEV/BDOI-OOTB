import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_RENEWALREQUESTTABLE_DATA,
  GET_RENEWALREQUEST_SEARCH,
} from "../../../../../redux/actionTypes";
import ClientListing from "../../../../quoteModule/clientListing";

export const getrenewalrequesttableMiddleware = createAsyncThunk(
  GET_RENEWALREQUESTTABLE_DATA,

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

export const getrenewalrequestSearchDataMiddleWare = createAsyncThunk(
  GET_RENEWALREQUEST_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "find renewal search");
    const { agentRenewalrequestMainReducers } = getState();
    const { renewalrequesttabledata } = agentRenewalrequestMainReducers;
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter((item) => {
        if (field === "Name") {
          return item.Name.toLowerCase().includes(lowercasedValue);
        } else if (field === "PolicyNumber") {
          return item.PolicyNumber.toLowerCase().includes(lowercasedValue);
        }
        return (
          item.Name.toLowerCase().includes(lowercasedValue) ||
          item.PolicyNumber.toLowerCase().includes(lowercasedValue)
        );
      });
      return outputData;
    }
    try {
      const filteredPayments = filterPaymentsByField(
        renewalrequesttabledata,
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
