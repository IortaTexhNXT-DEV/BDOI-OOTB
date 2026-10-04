import { createAsyncThunk } from "@reduxjs/toolkit";
import { POST_SETTLEMENT_CLAIM_DATA } from "../../../../redux/actionTypes";
import claimsService from "../../../../services/claimsService";

export const postSettlementClaimMiddleware = createAsyncThunk(
  POST_SETTLEMENT_CLAIM_DATA,
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { claimId, settlementData } = payload;

      const result = await claimsService.settleClaim(claimId, settlementData);

      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);
