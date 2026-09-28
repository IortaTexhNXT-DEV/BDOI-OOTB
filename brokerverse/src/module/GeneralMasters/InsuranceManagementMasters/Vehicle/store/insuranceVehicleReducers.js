import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceVehicleMiddleWare,
  postInsuranceVehicleMiddleWare,
  patchInsuranceVehicleMiddleWare,
  getSearchInsuranceVehicleMiddleware,
} from "./insuranceVehicleMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsuranceVehicleList: [],
  SearchTableList: [],
};
const insuranceManagementVehicleMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceVehicleMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInsuranceVehicleMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceVehicleList = action.payload;
      }
    );
    builder.addCase(getInsuranceVehicleMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.InsuranceVehicleList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //postInsuranceVehicle

    builder.addCase(postInsuranceVehicleMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsuranceVehicleMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceVehicleList = [
          ...state.InsuranceVehicleList,
          action.payload,
        ];
      }
    );
    builder.addCase(
      postInsuranceVehicleMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //EditInsuranceVehicle
    builder.addCase(patchInsuranceVehicleMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceVehicleMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsuranceVehicleList = action.payload;
      }
    );
    builder.addCase(
      patchInsuranceVehicleMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //searchInsuranceVehicle
    builder.addCase(getSearchInsuranceVehicleMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsuranceVehicleMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceVehicleMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementVehicleMasterReducer.reducer;
