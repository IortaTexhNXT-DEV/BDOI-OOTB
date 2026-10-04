import { createSlice } from "@reduxjs/toolkit";
import { getReversalTabelData, postReversalJVData } from "./reversalMiddleWare";

const initialState = {
  loading: false,
  error: "",
  originalVoucher: {},
  reversalJVList: [],
  reversalJVGetDataList: [],
};

const errorText = (action) =>
  typeof action.payload === "string" ? action.payload : "";

const reversalJVReducers = createSlice({
  name: "reversalJV",
  initialState,
  reducers: {
    resetReversalJV: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(getReversalTabelData.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(getReversalTabelData.fulfilled, (state, action) => {
        state.loading = false;
        state.originalVoucher = action.payload.voucher || {};
        state.reversalJVGetDataList = action.payload.rows;
      })
      .addCase(getReversalTabelData.rejected, (state, action) => {
        state.loading = false;
        state.reversalJVGetDataList = [];
        state.error = errorText(action);
      })
      .addCase(postReversalJVData.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(postReversalJVData.fulfilled, (state, action) => {
        state.loading = false;
        state.reversalJVList = [action.payload?.data, ...state.reversalJVList];
      })
      .addCase(postReversalJVData.rejected, (state, action) => {
        state.loading = false;
        state.error = errorText(action);
      });
  },
});

export const { resetReversalJV } = reversalJVReducers.actions;
export default reversalJVReducers.reducer;
