import { createAsyncThunk } from "@reduxjs/toolkit";
import { POST_SETTLEMENT_CLAIM_DATA } from "../../../../redux/actionTypes";
import claimsService from "../../../../services/claimsService";

export const postSettlementClaimMiddleware = createAsyncThunk(
  POST_SETTLEMENT_CLAIM_DATA,
  async (payload, { rejectWithValue, getState }) => {
    console.log("=== SETTLEMENT CLAIM MIDDLEWARE ===");
    console.log("Settlement payload:", payload);
    console.log("=== END SETTLEMENT CLAIM MIDDLEWARE ===");

    try {
      const { claimId, settlementData } = payload;

      const result = await claimsService.settleClaim(claimId, settlementData);

      if (result.success) {
        console.log("Settlement API call successful:", result.data);
        return result.data;
      } else {
        console.error("Settlement API call failed:", result.error);
        return rejectWithValue(result.error);
      }
    } catch (error) {
      console.error("Settlement middleware error:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);
