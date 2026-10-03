import { createSlice } from "@reduxjs/toolkit";
import {
  claimListDatMiddleWare,
  claimListSearchDataDatMiddleWare,
} from "./claimMiddleWare";

const initialState = {
  loading: false,
  error: "",
  claimsTabelList: [],
  claimSeachData: [],
};

const claimReducers = createSlice({
  name: "claims",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(claimListDatMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(claimListDatMiddleWare.fulfilled, (state, action) => {
      state.loading = false;

      // Handle API response structure - check if payload has data.claims array
      if (
        action.payload?.data?.claims &&
        Array.isArray(action.payload.data.claims)
      ) {
        state.claimsTabelList = action.payload.data.claims;
      } else if (action.payload && Array.isArray(action.payload)) {
        state.claimsTabelList = action.payload;
      } else if (action.payload?.data && Array.isArray(action.payload.data)) {
        state.claimsTabelList = action.payload.data;
      } else {
        // Fallback to empty array if structure is unexpected
        state.claimsTabelList = [];
      }
    });
    builder.addCase(claimListDatMiddleWare.rejected, (state, action) => {
      state.loading = false;
      state.claimsTabelList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(claimListSearchDataDatMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      claimListSearchDataDatMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.claimSeachData = action.payload;
      }
    );
    builder.addCase(
      claimListSearchDataDatMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.claimSeachData = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default claimReducers.reducer;
