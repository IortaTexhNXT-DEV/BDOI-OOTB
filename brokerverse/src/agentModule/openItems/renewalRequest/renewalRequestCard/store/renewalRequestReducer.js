import { createSlice } from "@reduxjs/toolkit";
import {
  getrenewalrequestSearchDataMiddleWare,
  getrenewalrequesttableMiddleware,
} from "./renewalRequestMiddleware";

const initialState = {
  loading: false,
  error: "",
  renewalrequesttabledata: [],
  renewalrequestSearchList: [],
};

const expiringReducer = createSlice({
  name: "expiringReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //getrenewalrequesttableMiddleware

    builder.addCase(getrenewalrequesttableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getrenewalrequesttableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.renewalrequesttabledata = action.payload;
      }
    );
    builder.addCase(
      getrenewalrequesttableMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // getrenewalrequestSearchDataMiddleWare

    builder.addCase(getrenewalrequestSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getrenewalrequestSearchDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.renewalrequestSearchList = action.payload;
      }
    );
    builder.addCase(
      getrenewalrequestSearchDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.renewalrequestSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default expiringReducer.reducer;
