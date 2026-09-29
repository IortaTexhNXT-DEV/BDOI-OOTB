import { createAsyncThunk } from "@reduxjs/toolkit";
import {
    POST_ORDER_SUMMARY
} from "../../../../redux/agentActionTypes";

export const postOrderSummaryMiddleware = createAsyncThunk(
  POST_ORDER_SUMMARY,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find add datas in leomaxvj");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);