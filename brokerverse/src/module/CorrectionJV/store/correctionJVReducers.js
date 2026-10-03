import { createSlice } from "@reduxjs/toolkit";
import {
  getCorrectionJVTabelData,
  getCorrectionJVView,
  getPatchCorrectionJVEdit,
  patchCorrectionJVEdit,
  postCorrectionJVData,
} from "./correctionJVMiddleWare";

const initialState = {
  loading: false,
  error: "",
  originalVoucher: {},
  createdVoucher: {},
  correctionJVView: {},
  correctionJVList: [],
  getCorrectionJVEdit: {},
};

const errorText = (action) =>
  typeof action.payload === "string" ? action.payload : "";

const correctionJVReducers = createSlice({
  name: "correctionJV",
  initialState,
  reducers: {
    resetCorrectionJV: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCorrectionJVTabelData.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(getCorrectionJVTabelData.fulfilled, (state, action) => {
        state.loading = false;
        state.originalVoucher = action.payload.voucher || {};
        state.correctionJVList = action.payload.rows;
      })
      .addCase(getCorrectionJVTabelData.rejected, (state, action) => {
        state.loading = false;
        state.correctionJVList = [];
        state.error = errorText(action);
      })
      .addCase(postCorrectionJVData.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(postCorrectionJVData.fulfilled, (state, action) => {
        state.loading = false;
        state.createdVoucher = action.payload?.data || {};
      })
      .addCase(postCorrectionJVData.rejected, (state, action) => {
        state.loading = false;
        state.error = errorText(action);
      })
      .addCase(getCorrectionJVView.fulfilled, (state, action) => {
        state.correctionJVView = action.payload?.data || {};
      })
      .addCase(getPatchCorrectionJVEdit.fulfilled, (state, action) => {
        state.getCorrectionJVEdit = action.payload;
      })
      .addCase(patchCorrectionJVEdit.fulfilled, (state, action) => {
        state.correctionJVList = state.correctionJVList.map((row) =>
          row.id === action.payload.id ? action.payload : row
        );
      });
  },
});

export const { resetCorrectionJV } = correctionJVReducers.actions;
export default correctionJVReducers.reducer;
