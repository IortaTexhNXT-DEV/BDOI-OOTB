import { createSlice } from "@reduxjs/toolkit";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import {
  getPatchPettyCashEdit,
  getPettyCashSearchList,
  getPettyCashView,
  patchPettyCashEdit,
  pettyCashMaster,
  postAddPettyCash,
} from "./pettyCashMasterMiddleWare";
const initialState = {
  loading: false,
  error: "",
  addPettyCash: {},
  pettyCashSearchList: [],
  pettyCashView: {},
  pettyCashEdit: {},
  getPettyCashEdit: {},
  pettyCashList: [],
  postPettyCash: {},
};

const pettyCashMasterReducers = createSlice({
  name: "pettyCashMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(pettyCashMaster.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(pettyCashMaster.fulfilled, (state, action) => {
      state.loading = false;
      state.pettyCashList = action.payload;
    });
    builder.addCase(pettyCashMaster.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //postAddPettyCash
    builder.addCase(postAddPettyCash.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddPettyCash.fulfilled, (state, action) => {
      state.loading = false;
      state.pettyCashList = [...state.pettyCashList, action.payload];
    });
    builder.addCase(postAddPettyCash.rejected, (state, action) => {
      state.loading = false;
      state.postPettyCash = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getPettyCashSearchList

    builder.addCase(getPettyCashSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPettyCashSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.pettyCashSearchList = action.payload;
    });
    builder.addCase(getPettyCashSearchList.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // patchPettyCashEdit

    builder.addCase(patchPettyCashEdit.pending, (state) => {
      state.loading = true;
    });

    builder.addCase(patchPettyCashEdit.fulfilled, (state, action) => {
      state.loading = false;
      const updatedIndex = state.pettyCashList.findIndex(
        (item) => item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        const updatedCurrencyList = [...state.pettyCashList];
        updatedCurrencyList[updatedIndex] = action.payload;
        state.pettyCashList = updatedCurrencyList;
      } else {
        state.pettyCashList = [...state.pettyCashList, action.payload];
      }
    });
    builder.addCase(patchPettyCashEdit.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getPatchPettyCashEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPatchPettyCashEdit.fulfilled, (state, action) => {
      state.loading = false;
      state.getPettyCashEdit = action.payload;
    });
    builder.addCase(getPatchPettyCashEdit.rejected, (state, action) => {
      state.loading = false;
      state.getPettyCashEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getPettyCashView

    builder.addCase(getPettyCashView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPettyCashView.fulfilled, (state, action) => {
      state.loading = false;
      state.pettyCashView = action.payload;
    });
    builder.addCase(getPettyCashView.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default pettyCashMasterReducers.reducer;
