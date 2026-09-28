import { createSlice } from "@reduxjs/toolkit";
import { postOrderSummaryMiddleware } from "./orderSummaryMiddleware";

const initialState = {
  loading: false,
  error: "",
  OrderSummary: {},
};
const OrderSummaryReducer = createSlice({
  name: "OrderSummaryReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {

    //postOrderSummaryMiddleware

    builder.addCase(postOrderSummaryMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postOrderSummaryMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.OrderSummary = action.payload;
    });
    builder.addCase(postOrderSummaryMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default OrderSummaryReducer.reducer;
