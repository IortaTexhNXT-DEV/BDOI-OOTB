import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceProductListMiddleWare,
  postInsuranceProductMiddleWare,
  patchInsuranceProductMiddleWare,
  getSearchInsuranceProductMiddleware,
} from "./insuranceProductMiddleware";

const initialState = {
  loading: false,
  error: "",
  InsuranceProductList: [],
  searchInsuranceProductList: [],
};

const InsuranceProductReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceProductListMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInsuranceProductListMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceProductList = action.payload;
      }
    );
    builder.addCase(
      getInsuranceProductListMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsuranceProductList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(postInsuranceProductMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsuranceProductMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const newItem2 = action.payload;
        state.InsuranceProductList = [
          ...state.InsuranceProductList,
          newItem2,
        ];
      }
    );
    builder.addCase(
      postInsuranceProductMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getSearchInsuranceProductMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsuranceProductMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.searchInsuranceProductList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceProductMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.searchInsuranceProductList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(patchInsuranceProductMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceProductMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.InsuranceProductList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.InsuranceProductList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.InsuranceProductList = updatedCurrencyList;
        } else {
          state.InsuranceProductList = [
            ...state.InsuranceProductList,
            action.payload,
          ];
        }
      }
    );
    builder.addCase(
      patchInsuranceProductMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default InsuranceProductReducer.reducer;