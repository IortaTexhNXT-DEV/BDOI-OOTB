import { createAsyncThunk } from "@reduxjs/toolkit";
import {GET_QUOTETABLE_DATA, GET_QUOTE_SEARCH } from "../../../../../redux/actionTypes";

export const getquotetableMiddleware = createAsyncThunk(
  GET_QUOTETABLE_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      // Simulate an API call if needed
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

/** Filters the quotations on screen (GET /quotations) by insurer name or quotation number. */
export const getQuoteSearchDataMiddleWare = createAsyncThunk(
  GET_QUOTE_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { agentQuoteMainReducers, quotationReducers } = getState();
    const rows = quotationReducers?.quotations || agentQuoteMainReducers?.quotetabledata || [];
    const needle = String(value || "").toLowerCase();
    const company = (item) => String(item?.participantDetails?.[0]?.insuranceCompanyName || "").toLowerCase();
    const number = (item) => String(item?.quotationNumber || "").toLowerCase();
    try {
      return rows.filter((item) => {
        if (field === "Company") return company(item).includes(needle);
        if (field === "QuoteID") return number(item).includes(needle);
        return company(item).includes(needle) || number(item).includes(needle);
      });
    } catch (error) {
      return rejectWithValue(error?.message);
    }
  }
);
