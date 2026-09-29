import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_POLICY_DETAILED_DATA } from "../../../../redux/actionTypes";
import policyService from "../../../../services/policyService";

export const getpolicyDetailedMiddleware = createAsyncThunk(
  GET_POLICY_DETAILED_DATA,
  async ({ policyId }, { rejectWithValue }) => {
    console.log(policyId, "fetching policy details for ID");

    try {
      const response = await policyService.getPolicyDetails(policyId);

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      const policyData = response.data;
      console.log("Policy details API response:", policyData);

      // Transform the policy data to match the expected format
      const transformedData = policyService.transformPolicyData(policyData);

      return transformedData;
    } catch (error) {
      console.error("Policy details middleware error:", error);
      return rejectWithValue(error.message || "Failed to fetch policy details");
    }
  }
);
