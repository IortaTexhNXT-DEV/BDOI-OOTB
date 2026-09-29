import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceSignatoriesMiddleWare,
  postInsuranceSignatoriesMiddleWare,
  patchInsuranceSignatoriesMiddleWare,
  getSearchInsuranceSignatoriesMiddleware,
} from "./insuranceSignatoriesMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsuranceSignatoriesList: [
    {
      id: 1,
      modifiedby: "John",
      modifiedOn: "12/12/2023",
      Status: "ACTIVE",
      signatoriesCode: "SIGN001",
      signatoryName: "Chona M. Jacinto",
      signatoryDescription: "NULL",
      action: 4,
    },
    {
      id: 2,
      modifiedby: "John",
      modifiedOn: "12/12/2023",
      Status: "ACTIVE",
      signatoriesCode: "SIGN002",
      signatoryName: "Jesus D. Gomez",
      signatoryDescription: "NULL",
      action: 1,
    },
    {
      id: 3,
      modifiedby: "John",
      modifiedOn: "12/12/2023",
      Status: "ACTIVE",
      signatoriesCode: "SIGN003",
      signatoryName: "Rina G. Bautista",
      signatoryDescription: "NULL",
      action: 2,
    },
    {
      id: 4,
      modifiedby: "John",
      modifiedOn: "12/12/2023",
      Status: "ACTIVE",
      signatoriesCode: "SIGN004",
      signatoryName: "Noel B. Tolete",
      signatoryDescription: "NULL",
      action: 3,
    },

  ],
  SearchTableList: [],
};
const insuranceManagementSignatoriesMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceSignatoriesMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInsuranceSignatoriesMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceSignatoriesList = action.payload;
      }
    );
    builder.addCase(
      getInsuranceSignatoriesMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsuranceSignatoriesList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //postInsuranceSignatories

    builder.addCase(postInsuranceSignatoriesMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsuranceSignatoriesMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceSignatoriesList = [
          ...state.InsuranceSignatoriesList,
          action.payload,
        ];
      }
    );
    builder.addCase(
      postInsuranceSignatoriesMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //EditInsuranceSignatories
    builder.addCase(patchInsuranceSignatoriesMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceSignatoriesMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsuranceSignatoriesList = action.payload;
      }
    );
    builder.addCase(
      patchInsuranceSignatoriesMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //searchInsuranceSignatories
    builder.addCase(
      getSearchInsuranceSignatoriesMiddleware.pending,
      (state) => {
        state.loading = true;
      }
    );
    builder.addCase(
      getSearchInsuranceSignatoriesMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceSignatoriesMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementSignatoriesMasterReducer.reducer;
