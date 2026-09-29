import { createAsyncThunk } from "@reduxjs/toolkit";
import {GET_QUOTETABLE_DATA, GET_QUOTE_SEARCH } from "../../../../../redux/actionTypes";




export const getquotetableMiddleware = createAsyncThunk(
  GET_QUOTETABLE_DATA,
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





export const getQuoteSearchDataMiddleWare = createAsyncThunk(
  GET_QUOTE_SEARCH,
  async ({ field, value}, { rejectWithValue, getState }) => {
    console.log( field, value, "kkkk");
    const { agentQuoteMainReducers } = getState();
    const { quotetabledata } = agentQuoteMainReducers;
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter(item => {
       
          if (field === 'Company') {
            return item.Company.toLowerCase().includes(lowercasedValue);
          } else if (field === 'QuoteID') {
            return item.QuoteID.toLowerCase().includes(lowercasedValue);
          }
          return (
            (item.Company.toLowerCase().includes(lowercasedValue) ||
              item.QuoteID.toLowerCase().includes(lowercasedValue)
              )
          );
        
      
      });
      return outputData
    }
    try {
      const filteredPayments = filterPaymentsByField(quotetabledata, field, value);
      console.log(filteredPayments, "filteredPayments");
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
