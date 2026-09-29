import { createSlice } from "@reduxjs/toolkit";
import { postSettlementClaimMiddleware } from "./claimSettlementMiddleware";

const initialState = {
  loading: false,
  error: "",
  claimsettlementddata: {},
};
const leadReducer = createSlice({
  name: "claimReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //postClaimSettlementMiddleware

    builder.addCase(postSettlementClaimMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postSettlementClaimMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.claimsettlementddata = action.payload;
      }
    );
    builder.addCase(postSettlementClaimMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default leadReducer.reducer;
