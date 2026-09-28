import { createSlice } from "@reduxjs/toolkit";
import {
  quotationListDataMiddleWare,
  quotationSearchListDataMiddleWare,
} from "./quotationMiddleWare";

const initialState = {
  loading: false,
  error: "",
  quotationListData: [],
  quotationListSearchData: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
  },
};

const quotationReducers = createSlice({
  name: "quotation",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(quotationListDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(quotationListDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.quotationListData = action.payload.data || [];
      state.pagination = {
        page: action.payload.page || 1,
        pageSize: action.payload.pageSize || 10,
        total: action.payload.total || 0,
      };
    });
    builder.addCase(quotationListDataMiddleWare.rejected, (state, action) => {
      state.loading = false;
      state.quotationListData = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(quotationSearchListDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      quotationSearchListDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.quotationListSearchData = action.payload;
      }
    );
    builder.addCase(
      quotationSearchListDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.quotationListSearchData = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});
export default quotationReducers.reducer;
