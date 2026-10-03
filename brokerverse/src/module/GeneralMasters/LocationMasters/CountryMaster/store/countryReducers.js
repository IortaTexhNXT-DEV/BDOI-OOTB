import { createSlice } from "@reduxjs/toolkit";
import { getCountryMiddleware, getCountryListByIdMiddleware, postAddCountryMiddleware, patchCountryEditMiddleware, getSearchCountryMiddleware } from "./countryMiddleware";
const initialState = {
  loading: false,
  error: "",
  countryTableList: [],
  countryDetailList: {},
  postAddCountry: "",
  getSearchCountry: [],
  patchCountry: ""
};
const countryReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getCountryMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCountryMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.countryTableList = action.payload;
    });
    builder.addCase(getCountryMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.countryTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getCountryListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCountryListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.countryDetailList = action.payload;
    });
    builder.addCase(getCountryListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.countryDetailList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchCountryMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchCountryMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.getSearchCountry = action.payload;
    });
    builder.addCase(getSearchCountryMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.getSearchCountry = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddCountryMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddCountryMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.countryTableList = [...state.countryTableList, action.payload];
    });
    builder.addCase(postAddCountryMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(patchCountryEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchCountryEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.countryTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedAddDisbursmentTable = [...state.countryTableList];
          updatedAddDisbursmentTable[updatedIndex] = action.payload;
          state.countryTableList = updatedAddDisbursmentTable;
        } else {
          state.countryTableList = [...state.countryTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchCountryEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );



  },
});

export default countryReducer.reducer;
