import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceCoverMiddleWare,
  postInsuranceCoverMiddleWare,
  patchInsuranceCoverMiddleWare,
  getSearchInsuranceCoverMiddleware,
} from "./insuranceCoverMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsuranceCoverList: [],
  SearchTableList: [],
};
const insuranceManagementCoverMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceCoverMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInsuranceCoverMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.InsuranceCoverList = action.payload;
    });
    builder.addCase(getInsuranceCoverMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.InsuranceCoverList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //postInsuranceCover

    builder.addCase(postInsuranceCoverMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postInsuranceCoverMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.InsuranceCoverList = [...state.InsuranceCoverList, action.payload];
    });
    builder.addCase(postInsuranceCoverMiddleWare.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //EditInsuranceCover
    builder.addCase(patchInsuranceCoverMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceCoverMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsuranceCoverList = action.payload;
      }
    );
    builder.addCase(patchInsuranceCoverMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.editList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //searchInsuranceCover
    builder.addCase(getSearchInsuranceCoverMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsuranceCoverMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceCoverMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementCoverMasterReducer.reducer;
