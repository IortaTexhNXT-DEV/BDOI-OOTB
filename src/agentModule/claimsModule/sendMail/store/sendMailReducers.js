import { createSlice } from "@reduxjs/toolkit";
import { postSendData, storeClaimResponseData } from "./sendMailMiddleWare";

const initialState = {
  loading: false,
  error: "",
  sendData: {},
  claimResponseData: {
    claimNumber: null,
    claimId: null,
    fullResponse: null,
  },
};

const sendMailReducers = createSlice({
  name: "sendMailReducers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(postSendData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postSendData.fulfilled, (state, action) => {
      state.loading = false;
      state.sendData = action.payload;
    });
    builder.addCase(postSendData.rejected, (state, action) => {
      state.loading = false;
      state.sendData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Handle storeClaimResponseData actions
    builder.addCase(storeClaimResponseData.pending, (state) => {
      // No loading state needed for this action
    });
    builder.addCase(storeClaimResponseData.fulfilled, (state, action) => {
      state.claimResponseData = action.payload;
    });
    builder.addCase(storeClaimResponseData.rejected, (state, action) => {
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default sendMailReducers.reducer;
