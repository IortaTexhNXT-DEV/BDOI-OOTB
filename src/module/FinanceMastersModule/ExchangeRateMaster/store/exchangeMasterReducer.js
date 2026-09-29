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
  ExchangeList: [
    {
      id: "1",
      EffectiveFrom: '1/24/2023',
      EffectiveTo: '1/23/2023',
      CurrencyCode: "C123",
      ToCurrencyCode: "TC123",
      ExchangeRate: "99",
      CurrencyDescription: "CurrencyDescription",
      ToCurrencyDescription: "ToCurrencyDescription"
    },
    {
      id: "2",
      EffectiveFrom: '2/24/2023',
      EffectiveTo: '2/23/2023',
      CurrencyCode: "C456",
      ToCurrencyCode: "TC456",
      ExchangeRate: "88",
      CurrencyDescription: "AnotherCurrencyDescription",
      ToCurrencyDescription: "AnotherToCurrencyDescription"
    },
    {
      id: "3",
      EffectiveFrom: '3/24/2023',
      EffectiveTo: '3/23/2023',
      CurrencyCode: "C789",
      ToCurrencyCode: "TC789",
      ExchangeRate: "77",
      CurrencyDescription: "YetAnotherCurrencyDescription",
      ToCurrencyDescription: "YetAnotherToCurrencyDescription"
    },
    {
      id: "4",
      EffectiveFrom: '4/24/2023',
      EffectiveTo: '4/23/2023',
      CurrencyCode: "C101",
      ToCurrencyCode: "TC101",
      ExchangeRate: "66",
      CurrencyDescription: "Description4",
      ToCurrencyDescription: "ToDescription4"
    },
    {
      id: "5",
      EffectiveFrom: '5/24/2023',
      EffectiveTo: '5/23/2023',
      CurrencyCode: "C202",
      ToCurrencyCode: "TC202",
      ExchangeRate: "55",
      CurrencyDescription: "Description5",
      ToCurrencyDescription: "ToDescription5"
    },
    {
      id: "6",
      EffectiveFrom: '6/24/2023',
      EffectiveTo: '6/23/2023',
      CurrencyCode: "C303",
      ToCurrencyCode: "TC303",
      ExchangeRate: "44",
      CurrencyDescription: "Description6",
      ToCurrencyDescription: "ToDescription6"
    },
    {
      id: "7",
      EffectiveFrom: '7/24/2023',
      EffectiveTo: '7/23/2023',
      CurrencyCode: "C404",
      ToCurrencyCode: "TC404",
      ExchangeRate: "33",
      CurrencyDescription: "Description7",
      ToCurrencyDescription: "ToDescription7"
    },
    {
      id: "8",
      EffectiveFrom: '8/24/2023',
      EffectiveTo: '8/23/2023',
      CurrencyCode: "C505",
      ToCurrencyCode: "TC505",
      ExchangeRate: "22",
      CurrencyDescription: "Description8",
      ToCurrencyDescription: "ToDescription8"
    },
    {
      id: "9",
      EffectiveFrom: '9/24/2023',
      EffectiveTo: '9/23/2023',
      CurrencyCode: "C606",
      ToCurrencyCode: "TC606",
      ExchangeRate: "11",
      CurrencyDescription: "Description9",
      ToCurrencyDescription: "ToDescription9"
    },
    {
      id: "10",
      EffectiveFrom: '10/24/2023',
      EffectiveTo: '10/23/2023',
      CurrencyCode: "C707",
      ToCurrencyCode: "TC707",
      ExchangeRate: "10",
      CurrencyDescription: "Description10",
      ToCurrencyDescription: "ToDescription10"
    }
  ],
  ExchangeSearchList: [],
  ExchangeStatus: {},
  AddExchange: {},
  ExchangeDetailView: {},
  exchangeDetailEdit: {},
  getExchangeEdit: {},

};
let nextId = 2
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
        state.ExchangeList = [action.payload];
      }
    );
    builder.addCase(
      getExchangeList.rejected,
      (state, action) => {
        state.loading = false;

        state.ExchangeList = {};
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

        state.ExchangeSearchList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //ExchangeStatus

    builder.addCase(postExchangeStatus.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postExchangeStatus.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = { ...action.payload, id: nextId++ };
      state.ExchangeList = [...state.ExchangeList, newItem2];
      console.log(state.ExchangeList, "kkk")
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
        console.log(state.getExchangeEdit, "")
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