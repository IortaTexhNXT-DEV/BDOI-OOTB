import { createSlice } from "@reduxjs/toolkit";

import {
  getClaimDetailsViewData,
  postClaimDetailsData,
  getClaimDetailsForEdit,
} from "./claimDetailsMiddleWare";

const initialState = {
  loading: false,
  error: "",
  claimDetailsViewData: {},
  claimThirdParty: {},
  policyHolderName: "",
  policyNumber: "",
  claimNumber: "",
};

const claimDetailsReducers = createSlice({
  name: "claimDetailsReducers",
  initialState,
  reducers: {
    setPolicyHolderData: (state, action) => {
      state.policyHolderName = action.payload.policyHolderName || "";
      state.policyNumber = action.payload.policyNumber || "";
      state.claimNumber = action.payload.claimNumber || "";
      console.log("=== REDUX POLICY HOLDER DATA STORED ===");
      console.log("Policy Holder Name:", action.payload.policyHolderName);
      console.log("Policy Number:", action.payload.policyNumber);
      console.log("Claim Number:", action.payload.claimNumber);
      console.log("=== END REDUX POLICY HOLDER DATA STORED ===");
    },
    clearPolicyHolderData: (state) => {
      state.policyHolderName = "";
      state.policyNumber = "";
      state.claimNumber = "";
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getClaimDetailsViewData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getClaimDetailsViewData.fulfilled, (state, action) => {
      state.loading = false;
      state.claimDetailsViewData = action.payload;
      console.log("=== REDUX STORE UPDATED ===");
      console.log("Claim details view data updated in store");
      console.log(
        "Policy Holder Name in store:",
        action.payload?.PolicyHolderName
      );
      console.log("Policy Number in store:", action.payload?.policyNumber);
      console.log("=== END REDUX STORE UPDATED ===");
    });
    builder.addCase(getClaimDetailsViewData.rejected, (state, action) => {
      state.loading = false;
      state.claimDetailsViewData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(postClaimDetailsData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postClaimDetailsData.fulfilled, (state, action) => {
      state.loading = false;
      state.claimThirdParty = action.payload;
    });
    builder.addCase(postClaimDetailsData.rejected, (state, action) => {
      state.loading = false;
      state.claimThirdParty = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Handle getClaimDetailsForEdit actions
    builder.addCase(getClaimDetailsForEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getClaimDetailsForEdit.fulfilled, (state, action) => {
      state.loading = false;
      state.claimDetailsViewData = action.payload;
    });
    builder.addCase(getClaimDetailsForEdit.rejected, (state, action) => {
      state.loading = false;
      state.claimDetailsViewData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export const { setPolicyHolderData, clearPolicyHolderData } =
  claimDetailsReducers.actions;
export default claimDetailsReducers.reducer;
