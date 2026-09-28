import { createSlice } from "@reduxjs/toolkit";
import {
    getCurrencyList,
    getCurrencySearchList,
    postCurrencyStatus,
    postAddCurrency,
    patchCurrencyDetailEdit,
    getCurrencyDetailEdit,
    getCurrencyDetailView
} from "./currencyMasterMiddlewar";
const initialState = {
  loading: false,
  error: "",
  CurrencyList: [],
  CurrencySearchList:[],
  CurrencyStatus:{},
  AddCurrency:{},
  CurrencyDetailEdit:{},
  getCurrecyDetailEdit:{},
  CurrencyDetailView:{}
};
const currencyMasterReducer = createSlice({
  name: "currencyMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {

    //CurrencyList

    builder.addCase(getCurrencyList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
        getCurrencyList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.CurrencyList = action.payload;
      }
    );
    builder.addCase(
        getCurrencyList.rejected,
      (state, action) => {
        state.loading = false;

        state.CurrencyList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //CurrencySearchList

    builder.addCase(getCurrencySearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getCurrencySearchList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.CurrencySearchList = action.payload;
      }
    );
    builder.addCase(
      getCurrencySearchList.rejected,
      (state, action) => {
        state.loading = false;

        state.CurrencySearchList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //CurrencyStatus
    
    builder.addCase(postCurrencyStatus.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postCurrencyStatus.fulfilled,
      (state, action) => {
        state.loading = false;
        state.CurrencyStatus = action.payload;
      }
    );
    builder.addCase(
      postCurrencyStatus.rejected,
      (state, action) => {
        state.loading = false;

        state.CurrencyStatus = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //postAddCurrency

    builder.addCase(postAddCurrency.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddCurrency.fulfilled,
      (state, action) => {
        state.loading = false;
        state.CurrencyList = [...state.CurrencyList, action.payload];
      }
    );
    builder.addCase(
      postAddCurrency.rejected,
      (state, action) => {
        state.loading = false;

        state.AddCurrency = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //CurrencyDetailEdit

    builder.addCase(patchCurrencyDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchCurrencyDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.CurrencyList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.CurrencyList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.CurrencyList = updatedCurrencyList; 
        } else {
          state.CurrencyList = [...state.CurrencyList, action.payload];
        }
      }
    );
    
    builder.addCase(
      patchCurrencyDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.CurrencyDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //getCurrecyDetailEdit
    builder.addCase(getCurrencyDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getCurrencyDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getCurrecyDetailEdit = action.payload;
      }
    );
    builder.addCase(
      getCurrencyDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.getCurrecyDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //CurrencyDetailView

    builder.addCase(getCurrencyDetailView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getCurrencyDetailView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.CurrencyDetailView = action.payload;
      }
    );
    builder.addCase(
      getCurrencyDetailView.rejected,
      (state, action) => {
        state.loading = false;

        state.CurrencyDetailView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
},
});

export default currencyMasterReducer.reducer;