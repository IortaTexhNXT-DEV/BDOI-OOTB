import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  PATCH_PERSONAL_DETAILS,
  GET_PERSONAL_DETAILS,
  GET_ENDORSEMENT_POLICY_DETAILS,
} from "../../../../redux/agentActionTypes";
import policyService from "../../../../services/policyService";

export const getEndorsementPolicyDetailsMiddleware = createAsyncThunk(
  GET_ENDORSEMENT_POLICY_DETAILS,
  async ({ policyId }, { rejectWithValue }) => {
    if (!policyId) {
      return rejectWithValue("Policy ID is required");
    }

    try {
      const response = await policyService.getPolicyEndorsementDetails(
        policyId
      );

      if (!response.success) {
        return rejectWithValue(
          response.error || "Failed to fetch policy details"
        );
      }

      return response.data;
    } catch (error) {
      const message =
        error?.message || "Failed to fetch policy endorsement details";
      console.error("Endorsement policy details middleware error:", message);
      return rejectWithValue(message);
    }
  }
);

export const getpersonalDetailsMiddleware = createAsyncThunk(
  GET_PERSONAL_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const patchpersonalDetailsMiddleware = createAsyncThunk(
  PATCH_PERSONAL_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
