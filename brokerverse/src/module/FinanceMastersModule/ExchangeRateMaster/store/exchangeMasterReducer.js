import { createSlice } from "@reduxjs/toolkit";
import {
  getExchangeList,
  getExchangeSearchList,
  postExchangeStatus,
  getAddExchange,
  patchExchangeDetailEdit,
  getExchangeDetailView,
  getExchangeDetailEdit
} from "./exchangeMasterMiddleware";
const initialState = {
  loading: false,
  error: "",
  ExchangeList: [],
  ExchangeSearchList: [],
  ExchangeStatus: {},
  AddExchange: {},
  ExchangeDetailView: {},
  exchangeDetailEdit: {},
  getExchangeEdit: {},

};
const exchangeMasterReducer = createSlice({
  name: "exchangeMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {

    //ExchangeList

    builder.addCase(getExchangeList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getExchangeList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.ExchangeList = action.payload;
      }
    );
    builder.addCase(
      getExchangeList.rejected,
      (state, action) => {
        state.loading = false;

        state.ExchangeList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //ExchangeSearchList

    builder.addCase(getExchangeSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getExchangeSearchList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.ExchangeSearchList = action.payload;
      }
    );
    builder.addCase(
      getExchangeSearchList.rejected,
      (state, action) => {
        state.loading = false;

        state.ExchangeSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //ExchangeStatus

    builder.addCase(postExchangeStatus.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postExchangeStatus.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = action.payload;
      state.ExchangeList = [...state.ExchangeList, newItem2];
    });
    builder.addCase(
      postExchangeStatus.rejected,
      (state, action) => {
        state.loading = false;

        state.ExchangeStatus = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //AddExchange

    builder.addCase(getAddExchange.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAddExchange.fulfilled,
      (state, action) => {
        state.loading = false;
        state.AddExchange = action.payload;
      }
    );
    builder.addCase(
      getAddExchange.rejected,
      (state, action) => {
        state.loading = false;

        state.AddExchange = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //ExchangeDetailEdit

    // builder.addCase(patchExchangeDetailEdit.pending, (state) => {
    //   state.loading = true;
    // });
    // builder.addCase(
    //   patchExchangeDetailEdit.fulfilled,
    //   (state, action) => {
    //     state.loading = false;
    //     state.ExchangeDetailEdit = action.payload;
    //   }
    // );
    // builder.addCase(
    //   patchExchangeDetailEdit.rejected,
    //   (state, action) => {
    //     state.loading = false;

    //     state.ExchangeDetailEdit = {};
    //     state.error = typeof action.payload === "string" ? action.payload : "";
    //   }
    // );
    builder.addCase(patchExchangeDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchExchangeDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.ExchangeList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.ExchangeList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.ExchangeList = updatedCurrencyList;
        } else {
          state.ExchangeList = [...state.ExchangeList, action.payload];
        }
      }
    );

    builder.addCase(
      patchExchangeDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.exchangeDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //getExchangeDetailEdit
    builder.addCase(getExchangeDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getExchangeDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getExchangeEdit = action.payload;
      }
    );
    builder.addCase(
      getExchangeDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.getExchangeEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //ExchangeDetailView

    builder.addCase(getExchangeDetailView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getExchangeDetailView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.ExchangeDetailView = action.payload;
      }
    );
    builder.addCase(
      getExchangeDetailView.rejected,
      (state, action) => {
        state.loading = false;

        state.ExchangeDetailView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default exchangeMasterReducer.reducer;