import { createSlice } from "@reduxjs/toolkit";
import {
  getInsurancelineOfBusinessListMiddleWare,
  postInsurancelineOfBusinessMiddleWare,
  patchInsurancelineOfBusinessMiddleWare,
  getSearchInsurancelineOfBusinessMiddleware,
} from "./insuranceLineOfBusinessMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsuranceLineOfBusinessList: [],
  SearchTableList: [],
};
const insuranceManagementlineOfBusinessMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(
      getInsurancelineOfBusinessListMiddleWare.pending,
      (state) => {
        state.loading = true;
      }
    );
    builder.addCase(
      getInsurancelineOfBusinessListMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceLineOfBusinessList = action.payload;
      }
    );
    builder.addCase(
      getInsurancelineOfBusinessListMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsuranceLineOfBusinessList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //postInsurancelineOfBusiness

    builder.addCase(postInsurancelineOfBusinessMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsurancelineOfBusinessMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceLineOfBusinessList = [
          ...state.InsuranceLineOfBusinessList,
          action.payload,
        ];
      }
    );
    builder.addCase(
      postInsurancelineOfBusinessMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //EditInsurancelineOfBusiness
    builder.addCase(patchInsurancelineOfBusinessMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsurancelineOfBusinessMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsuranceLineOfBusinessList = action.payload;
      }
    );
    builder.addCase(
      patchInsurancelineOfBusinessMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //searchInsurancelineOfBusiness
    builder.addCase(
      getSearchInsurancelineOfBusinessMiddleware.pending,
      (state) => {
        state.loading = true;
      }
    );
    builder.addCase(
      getSearchInsurancelineOfBusinessMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsurancelineOfBusinessMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementlineOfBusinessMasterReducer.reducer;
