import { createSlice } from "@reduxjs/toolkit";
import { getCityMiddleware, getCityListByIdMiddleware, postAddCityMiddleware, patchCityEditMiddleware, getSearchCityMiddleware } from "./cityMiddleware";

const initialState = {
  loading: false,
  error: "",
  cityTableList: [],
  CityListById: "",
  SearchCity: [],
  CityEdit: ""
};
const cityReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getCityMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCityMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.cityTableList = action.payload;
    });
    builder.addCase(getCityMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.userTableList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getCityListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCityListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.CityListById = action.payload;
    });
    builder.addCase(getCityListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.CityListById = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchCityMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchCityMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.SearchCity = action.payload;
    });
    builder.addCase(getSearchCityMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.SearchCity = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddCityMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddCityMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.cityTableList = [...state.cityTableList, action.payload];
    });
    builder.addCase(postAddCityMiddleware.rejected, (state, action) => {
      state.loading = false;

      //   state.paymentVocherList = state.paymentVocherList;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(patchCityEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchCityEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.cityTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedAddDisbursmentTable = [...state.cityTableList];
          updatedAddDisbursmentTable[updatedIndex] = action.payload;
          state.cityTableList = updatedAddDisbursmentTable;
        } else {
          state.cityTableList = [...state.cityTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchCityEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.CityEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );



  },
});

export default cityReducer.reducer;
