import { createSlice } from "@reduxjs/toolkit";
import {
  getReplenishListMiddleware,
  getReplenishSearchMiddleware,
  postAddReplenishMiddleware,
  getAddReplenishTableMiddleware,
  getViewReplenishMiddleware,
} from "./pettyCashReplenishMiddleware";

const initialState = {
  loading: false,
  error: "",
  ReplenishList: [],
  ReplenishSearch: [],
  AddReplenish: {},
  ReplenishFund: {},
  AddReplenishTable: [],
  ViewReplenish: {},
};

const errorText = (action) =>
  typeof action.payload === "string" ? action.payload : "";

const PettyCashReplenishReducer = createSlice({
  name: "pettycashreplenish",
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
      .addCase(getReplenishListMiddleware.pending, pending)
      .addCase(getReplenishListMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.ReplenishList = action.payload;
      })
      .addCase(getReplenishListMiddleware.rejected, rejected)
      .addCase(getReplenishSearchMiddleware.pending, pending)
      .addCase(getReplenishSearchMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.ReplenishSearch = action.payload;
      })
      .addCase(getReplenishSearchMiddleware.rejected, rejected)
      .addCase(getAddReplenishTableMiddleware.pending, pending)
      .addCase(getAddReplenishTableMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.AddReplenish = action.payload.header;
        state.ReplenishFund = action.payload.fund || {};
        state.AddReplenishTable = action.payload.rows;
      })
      .addCase(getAddReplenishTableMiddleware.rejected, rejected)
      .addCase(postAddReplenishMiddleware.pending, pending)
      .addCase(postAddReplenishMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.ReplenishList = [action.payload, ...state.ReplenishList];
      })
      .addCase(postAddReplenishMiddleware.rejected, rejected)
      .addCase(getViewReplenishMiddleware.fulfilled, (state, action) => {
        state.ViewReplenish = action.payload;
        state.AddReplenishTable = [
          {
            id: action.payload?.id,
            Transactioncode: action.payload?.Transactioncode,
            DocNumber: action.payload?.TransactionNumber,
            Narration: action.payload?.Remarks,
            Date: action.payload?.Date,
            Remarks: action.payload?.Remarks,
            Amount: action.payload?.Amount,
          },
        ];
      });
  },
});

export default PettyCashReplenishReducer.reducer;
