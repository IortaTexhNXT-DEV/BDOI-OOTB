import { createSlice } from "@reduxjs/toolkit";
import {
  getDisbursmentListMiddleware,
  getDisbursmentSearchMiddleware,
  postAddDisbursmentMiddleware,
  getAddDisbursmentTableMiddleware,
  getAddDisbursmentRequestListTableMiddleware,
  postEditDisbursmentMiddleware,
  getViewDisbursmentMiddleware,
  getPatchDisbursementData,
  postDisbursementData,
  postPatchDisbursementData,
  getDisbursmentViewMiddleware,
} from "./pettyCashDisbursementMiddleware";

const initialState = {
  loading: false,
  error: "",
  DisbursmentList: [],
  DisbursmentSearch: [],
  AddDisbursment: {},
  AddDisbursmentTable: [],
  AddDisbursmentRequestTable: [],
  ViewDisbursment: {},
  getPatchDisbursment: {},
  getViewDisbursment: {},
};

const errorText = (action) =>
  typeof action.payload === "string" ? action.payload : "";

const PettyCashDisbursementReducer = createSlice({
  name: "pettycashdisbursement",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const pending = (state) => {
      state.loading = true;
      state.error = "";
    };
    const rejected = (state, action) => {
      state.loading = false;
      state.error = errorText(action);
    };
    builder
      .addCase(getDisbursmentListMiddleware.pending, pending)
      .addCase(getDisbursmentListMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.DisbursmentList = action.payload;
      })
      .addCase(getDisbursmentListMiddleware.rejected, rejected)
      .addCase(getDisbursmentSearchMiddleware.pending, pending)
      .addCase(getDisbursmentSearchMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.DisbursmentSearch = action.payload;
      })
      .addCase(getDisbursmentSearchMiddleware.rejected, rejected)
      .addCase(postAddDisbursmentMiddleware.fulfilled, (state, action) => {
        state.AddDisbursment = action.payload;
        state.AddDisbursmentTable = [];
      })
      .addCase(getAddDisbursmentTableMiddleware.fulfilled, (state, action) => {
        state.AddDisbursmentTable = action.payload || [];
      })
      .addCase(getAddDisbursmentRequestListTableMiddleware.fulfilled, (state, action) => {
        state.AddDisbursmentRequestTable = action.payload;
      })
      .addCase(postEditDisbursmentMiddleware.pending, pending)
      .addCase(postEditDisbursmentMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.DisbursmentList = [...action.payload, ...state.DisbursmentList];
        state.AddDisbursmentTable = [];
      })
      .addCase(postEditDisbursmentMiddleware.rejected, rejected)
      .addCase(getViewDisbursmentMiddleware.fulfilled, (state, action) => {
        state.ViewDisbursment = action.payload;
      })
      .addCase(getPatchDisbursementData.fulfilled, (state, action) => {
        state.getPatchDisbursment = action.payload;
      })
      .addCase(postDisbursementData.fulfilled, (state, action) => {
        state.AddDisbursmentTable = [...state.AddDisbursmentTable, action.payload];
      })
      .addCase(postPatchDisbursementData.fulfilled, (state, action) => {
        state.AddDisbursmentTable = state.AddDisbursmentTable.map((line) =>
          line.id === action.payload.id ? action.payload : line
        );
      })
      .addCase(getDisbursmentViewMiddleware.fulfilled, (state, action) => {
        state.getViewDisbursment = action.payload;
        state.AddDisbursmentTable = action.payload?.line ? [action.payload.line] : [];
      });
  },
});

export default PettyCashDisbursementReducer.reducer;
