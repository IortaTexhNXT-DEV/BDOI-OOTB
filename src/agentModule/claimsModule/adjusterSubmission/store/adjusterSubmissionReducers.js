import { createSlice } from "@reduxjs/toolkit";
import {
  postAdjusterSubmission,
  getClaimDetails,
} from "./adjusterSubmissionMiddleWare";

const initialState = {
  loading: false,
  error: "",
  adjusterSubmission: {},
  claimDetails: {},
  claimDetailsLoading: false,
  claimDetailsError: "",
};

const adjusterSubmissionReducers = createSlice({
  name: "claimDetailsReducers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(postAdjusterSubmission.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAdjusterSubmission.fulfilled, (state, action) => {
      state.loading = false;
      state.adjusterSubmission = action.payload;
    });
    builder.addCase(postAdjusterSubmission.rejected, (state, action) => {
      state.loading = false;
      state.adjusterSubmission = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Handle getClaimDetails actions
    builder.addCase(getClaimDetails.pending, (state) => {
      state.claimDetailsLoading = true;
      state.claimDetailsError = "";
    });
    builder.addCase(getClaimDetails.fulfilled, (state, action) => {
      state.claimDetailsLoading = false;
      state.claimDetails = action.payload;
    });
    builder.addCase(getClaimDetails.rejected, (state, action) => {
      state.claimDetailsLoading = false;
      state.claimDetails = {};
      state.claimDetailsError =
        typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default adjusterSubmissionReducers.reducer;
