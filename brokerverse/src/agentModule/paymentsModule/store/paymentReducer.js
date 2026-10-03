import { createSlice } from "@reduxjs/toolkit";
import { getPaymentPaidSearchDataMiddleWare, getPaymentPendingSearchDataMiddleWare, getPaymentSearchDataMiddleWare, getpaymentPendingtableMiddleware, getpaymentRewivingtableMiddleware, getpaymenttableMiddleware, postpaymentdataMiddleWare } from "./paymentMiddleware";

const initialState = {
  loading: false,
  error: "",
  paymenttabledata: [],
  paymentPendingtabledata: [],
  paymentRewiwingtabledata: [],
  paymentSearchList: [],
  postpaymentdata: {},
  paymentPendingSearchList: [],
  paymentPaidSearchList: []
};

const paymentReducer = createSlice({
  name: "paymentReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {

    //getpaymenttableMiddleware

    builder.addCase(getpaymenttableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getpaymenttableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.paymenttabledata = action.payload
      }
    );
    builder.addCase(
      getpaymenttableMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getpaymentPendingtableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getpaymentPendingtableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.paymentPendingtabledata = action.payload
      }
    );
    builder.addCase(
      getpaymentPendingtableMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getpaymentRewivingtableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getpaymentRewivingtableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.paymentRewiwingtabledata = action.payload
      }
    );
    builder.addCase(
      getpaymentRewivingtableMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );




    //postpaymentdataMiddleWare

    builder.addCase(postpaymentdataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postpaymentdataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.postpaymentdata = action.payload
      }
    );
    builder.addCase(
      postpaymentdataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getPaymentSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPaymentSearchDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.paymentSearchList = action.payload;
    });
    builder.addCase(getPaymentSearchDataMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.paymentSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(getPaymentPendingSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPaymentPendingSearchDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.paymentPendingSearchList = action.payload;
    });
    builder.addCase(getPaymentPendingSearchDataMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.paymentPendingSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(getPaymentPaidSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPaymentPaidSearchDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.paymentPaidSearchList = action.payload;
    });
    builder.addCase(getPaymentPaidSearchDataMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.paymentPaidSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

  },
});

export default paymentReducer.reducer;