import { createSlice } from "@reduxjs/toolkit";
import {
  getQuotependingSearchDataMiddleWare,
  getquotependingtableMiddleware,
} from "./quotePendingMiddleware";

const initialState = {
  loading: false,
  error: "",
  quotependingtabledata: [],
  quotependingSearchList: [],
};

const expiringReducer = createSlice({
  name: "expiringReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //getquotependingtableMiddleware

    builder.addCase(getquotependingtableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getquotependingtableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.quotependingtabledata = action.payload;
      }
    );
    builder.addCase(
      getquotependingtableMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // getQuotependingSearchDataMiddleWare

    builder.addCase(getQuotependingSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getQuotependingSearchDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.quotependingSearchList = action.payload;
      }
    );
    builder.addCase(
      getQuotependingSearchDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.quotependingSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default expiringReducer.reducer;
