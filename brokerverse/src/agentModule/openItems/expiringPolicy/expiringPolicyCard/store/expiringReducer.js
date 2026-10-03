import { createSlice } from "@reduxjs/toolkit";
import {
  getExpiringSearchDataMiddleWare,
  getexpiringtableMiddleware,
} from "./expiringMiddleware";

const initialState = {
  loading: false,
  error: "",
  expiringtabledata: [],
  expiringSearchList: [],
};

const expiringReducer = createSlice({
  name: "expiringReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //getexpiringtableMiddleware

    builder.addCase(getexpiringtableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getexpiringtableMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.expiringtabledata = action.payload;
    });
    builder.addCase(getexpiringtableMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // getExpiringSearchDataMiddleWare

    builder.addCase(getExpiringSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getExpiringSearchDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.expiringSearchList = action.payload;
      }
    );
    builder.addCase(
      getExpiringSearchDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.expiringSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default expiringReducer.reducer;
