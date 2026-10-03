import { createSlice } from "@reduxjs/toolkit";
import {
  policyListDataMiddleWare,
  policyListSerachDataMiddleWare,
  policyDetailsDataMiddleWare,
} from "./policyMiddleWare";

const initialState = {
  loading: false,
  detailLoading: false,
  error: "",
  policyListData: [],
  policyListSearchData: [],
  policyDetails: null, // Store individual policy details
  rawPolicyData: null, // Store original policy details API response
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  rawApiData: [], // Store original API response for reference
};

const policyReducers = createSlice({
  name: "policy",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(policyListDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(policyListDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.policyListData = action.payload.transformedData || [];
      state.rawApiData = action.payload.rawData || [];
      state.pagination = action.payload.pagination || {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      };
    });
    builder.addCase(policyListDataMiddleWare.rejected, (state, action) => {
      state.loading = false;
      // keep the rows already on screen; the error is shown instead of an empty table
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(policyListSerachDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      policyListSerachDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.policyListSearchData = action.payload;
      }
    );
    builder.addCase(
      policyListSerachDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.policyListSearchData = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // Policy Details reducers
    // own flag, so opening a policy does not put the policy list into its loading state
    builder.addCase(policyDetailsDataMiddleWare.pending, (state) => {
      state.detailLoading = true;
    });
    builder.addCase(policyDetailsDataMiddleWare.fulfilled, (state, action) => {
      state.detailLoading = false;
      state.policyDetails = action.payload.policyDetails;
      state.rawPolicyData = action.payload.rawPolicyData;
    });
    builder.addCase(policyDetailsDataMiddleWare.rejected, (state, action) => {
      state.detailLoading = false;
      state.policyDetails = null;
      state.rawPolicyData = null;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default policyReducers.reducer;
