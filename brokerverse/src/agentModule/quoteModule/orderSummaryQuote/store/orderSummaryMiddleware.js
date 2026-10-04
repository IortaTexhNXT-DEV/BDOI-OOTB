import { createAsyncThunk } from "@reduxjs/toolkit";
import {
    POST_ORDER_SUMMARY
} from "../../../../redux/agentActionTypes";

export const postOrderSummaryMiddleware = createAsyncThunk(
  POST_ORDER_SUMMARY,
  async (payload, { rejectWithValue, getState }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);