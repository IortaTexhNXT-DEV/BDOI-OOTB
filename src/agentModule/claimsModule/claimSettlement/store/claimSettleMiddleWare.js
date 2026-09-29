import { createAsyncThunk } from "@reduxjs/toolkit";
import {GET_CLAIM_SETTLE_DATA} from "../../../../redux/actionTypes";



export const getClaimSettleViewData = createAsyncThunk(
  GET_CLAIM_SETTLE_DATA,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");

    try {
      return payload
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

