import { createSlice } from "@reduxjs/toolkit";
import {
  getInitiateListMiddleware,
  getInitiateListSearchMiddleware,
  getInitiateDetailsMiddleware,
  postInitiateMiddleware,
} from "./pettyCashInitiateMiddleware";
const initialState = {
  loading: false,
  error: "",
  InitiateList: [],
  Initiate: {},
  InitiateListSearch: [],
  InitiateDetails: [],
};
const PettyCashInitiateReducer = createSlice({
  name: "pettycashinitiate",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInitiateListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInitiateListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.InitiateList = action.payload;
    });
    builder.addCase(getInitiateListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.InitiateList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //InitiateListSearchMiddleware

    builder.addCase(getInitiateListSearchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInitiateListSearchMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InitiateListSearch = action.payload;
      }
    );
    builder.addCase(
      getInitiateListSearchMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.InitiateListSearch = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // InitiateList

    builder.addCase(postInitiateMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postInitiateMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.InitiateList = [action.payload, ...state.InitiateList];
    });
    builder.addCase(postInitiateMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.Initiate = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getInitiateDetailsMiddleware

    builder.addCase(getInitiateDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInitiateDetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.InitiateDetails = action.payload;
    });
    builder.addCase(getInitiateDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.InitiateDetails = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default PettyCashInitiateReducer.reducer;
