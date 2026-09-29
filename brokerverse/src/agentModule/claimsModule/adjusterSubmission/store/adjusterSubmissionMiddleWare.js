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

export const postAdjusterSubmission = createAsyncThunk(
  POST_ADJUSTER_SUBMISSION_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      const { claimId, adjusterData } = payload;

      const result = await claimsService.updateClaim(claimId, adjusterData);

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
