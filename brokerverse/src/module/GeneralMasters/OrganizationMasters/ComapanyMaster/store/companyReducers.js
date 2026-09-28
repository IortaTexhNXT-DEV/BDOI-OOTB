import { createSlice } from "@reduxjs/toolkit";
import {
  getCompanyListMiddleware,
  getCompanyListByIdMiddleware,
  postAddCompanyMiddleware,
  patchCompanyEditMiddleware,
  getSearchCompanyMiddleware,
  getComapnyListByIdMiddleware,
  getCompanyView,
  getCompanyViewMiddleWare,
  getCompanyEditData,
} from "./companyMiddleware";

const initialState = {
  loading: false,
  error: "",
  companyTableList: [],
  companySearchList: [],
  companyView: {},
  getcompanyEdit:{}
};
let nextId = 3;
const receiptsReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getCompanyListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCompanyListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.companyTableList = [action.payload];
    });
    builder.addCase(getCompanyListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.companyTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getComapnyListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getComapnyListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.companyDetailList = action.payload;
    });
    builder.addCase(getComapnyListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.companyDetailList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchCompanyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchCompanyMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.companySearchList = action.payload;
    });
    builder.addCase(getSearchCompanyMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.companySearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddCompanyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddCompanyMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = { ...action.payload, id: nextId++ };
      state.companyTableList = [...state.companyTableList, newItem2];
    });
    builder.addCase(postAddCompanyMiddleware.rejected, (state, action) => {
      state.loading = false;

      //   state.paymentVocherList = state.paymentVocherList;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getCompanyViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getCompanyViewMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.companyView = action.payload;
        console.log( state.companyView = action.payload," state.companyView = action.payload;");
   
      }
    );
    builder.addCase(
      getCompanyViewMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.companyView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    
    builder.addCase(getCompanyEditData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getCompanyEditData.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getcompanyEdit= action.payload;
      }
    );
    builder.addCase(
      getCompanyEditData.rejected,
      (state, action) => {
        state.loading = false;
        state.getcompanyEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

  
    builder.addCase(patchCompanyEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchCompanyEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.companyTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.companyTableList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.companyTableList = updatedCurrencyList;
        } else {
          state.companyTableList = [...state.companyTableList, action.payload];
        }
      }
    );
    builder.addCase(patchCompanyEditMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.editList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default receiptsReducer.reducer;
