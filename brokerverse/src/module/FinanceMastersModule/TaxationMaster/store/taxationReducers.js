import { createSlice } from "@reduxjs/toolkit";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import {
  getTaxationData,
  getTaxationSearchList,
  getTaxationView,
  getpatchTaxationEdit,
  patchTaxationEdit,
  postAddTaxationMiddileware,
} from "./taxationMiddleWare";
const initialState = {
  loading: false,
  error: "",
  addTaxation: {},
  taxationSearchList: [],
  taxationView: {},
  taxationEdit: {},
  getTaxationEdit: {},
  taxationList: [],
};
// let nextId = 3
const taxationReducers = createSlice({
  name: "commission",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getTaxationData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTaxationData.fulfilled, (state, action) => {
      state.loading = false;
      state.taxationList = action.payload;
    });
    builder.addCase(getTaxationData.rejected, (state, action) => {
      state.loading = false;
      state.taxationList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //addCommission
    builder.addCase(postAddTaxationMiddileware.pending, (state) => {
      state.loading = true;
    });
    // builder.addCase(postAddTaxationMiddileware.fulfilled, (state, action) => {
    //     state.loading = false;
    //     const newItem2 = action.payload;
    //     state.taxationList = [...state.taxationList, newItem2];
    //     console.log(state.taxationList, "taxationListtaxationList")
    // });
    builder.addCase(postAddTaxationMiddileware.fulfilled, (state, action) => {
      state.loading = false;
      state.taxationList = [...state.taxationList, action.payload];
    });

    builder.addCase(postAddTaxationMiddileware.rejected, (state, action) => {
      state.loading = false;
      state.addTaxation = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //getTaxationSearchList

    builder.addCase(getTaxationSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTaxationSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.taxationSearchList = action.payload;
    });
    builder.addCase(getTaxationSearchList.rejected, (state, action) => {
      state.loading = false;

      state.taxationSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //patchTaxationEdit

    builder.addCase(patchTaxationEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(patchTaxationEdit.fulfilled, (state, action) => {
      state.loading = false;
      const updatedIndex = state.taxationList.findIndex(
        (item) => item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        const updatedCurrencyList = [...state.taxationList];
        updatedCurrencyList[updatedIndex] = action.payload;
        state.taxationList = updatedCurrencyList;
      } else {
        state.taxationList = [...state.taxationList, action.payload];
      }
    });
    builder.addCase(patchTaxationEdit.rejected, (state, action) => {
      state.loading = false;
      state.taxationEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getpatchTaxationEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getpatchTaxationEdit.fulfilled, (state, action) => {
      state.loading = false;
      state.getTaxationEdit = action.payload;
    });
    builder.addCase(getpatchTaxationEdit.rejected, (state, action) => {
      state.loading = false;

      state.getTaxationEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getTaxationView

    builder.addCase(getTaxationView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTaxationView.fulfilled, (state, action) => {
      state.loading = false;
      state.taxationView = action.payload;
    });
    builder.addCase(getTaxationView.rejected, (state, action) => {
      state.loading = false;

      state.taxationView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default taxationReducers.reducer;
