import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_ADJUSTER_SUBMISSION_DATA,
  GET_CLAIM_DETAILS_DATA,
} from "../../../../redux/actionTypes";
import claimsService from "../../../../services/claimsService";

export const getClaimDetails = createAsyncThunk(
  GET_CLAIM_DETAILS_DATA,
  async (claimId, { rejectWithValue }) => {
    try {
      const result = await claimsService.getClaimDetails(claimId);

      if (result.success) {
        console.log("Claim details fetched successfully:", result.data);
        return result.data;
      } else {
        console.error("Failed to fetch claim details:", result.error);
        return rejectWithValue(result.error);
      }
    } catch (error) {
      console.error("Get claim details middleware error:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);

export const postAdjusterSubmission = createAsyncThunk(
  POST_ADJUSTER_SUBMISSION_DATA,
  async (payload, { rejectWithValue }) => {
    console.log("=== ADJUSTER SUBMISSION MIDDLEWARE ===");
    console.log("Adjuster submission payload:", payload);
    console.log("=== END ADJUSTER SUBMISSION MIDDLEWARE ===");

    try {
      const { claimId, adjusterData } = payload;

      const result = await claimsService.updateClaim(claimId, adjusterData);

      if (result.success) {
        console.log("Adjuster submission API call successful:", result.data);
        return result.data;
      } else {
        console.error("Adjuster submission API call failed:", result.error);
        return rejectWithValue(result.error);
      }
    } catch (error) {
      console.error("Adjuster submission middleware error:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);
