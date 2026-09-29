import { createSlice } from "@reduxjs/toolkit";
import {
  getMainAccountList,
  getMainAccountSearchList,
  postMainAccountStatus,
  getAddMainAccount,
  patchMainAccountDetailEdit,
  getMainAccountDetailView,
  getPatchMainAccountDetailEdit
} from "./mainAccoutMiddleware";
const initialState = {
  loading: false,
  error: "",
  MainAccountDetailView: {},
  MainAccountList: [
    {
      id: "1",
      mainAccountCode: "1101001",
      mainAccountName: "FIXED ASSETS - LAND AND BUILDING",
      description: "FIXED ASSETS - LAND AND BUILDING",
      accountType: "Credit",
      openEntry: "Yes",
      openEntryType: "credit",
      accountCategoryCode: "acc123",
      companyCode: "001",
      currencyCode: "cc112"
    },
    {
      id: "2",
      mainAccountCode: "1101002",
      mainAccountName: "FIXED ASSETS - LEASE HOLD ",
      description: "FIXED ASSETS - LAND AND BUILDING AMORTIZATION AC",
      accountType: "Debit",
      openEntry: "No",
      openEntryType: "debit",
      accountCategoryCode: "acc456",
      companyCode: "002",
      currencyCode: "cc223"
    },
    // {
    //   id: "3",
    //   mainAccountCode: "main789",
    //   mainAccountName: "yetAnotherAccountName",
    //   description: "yet another description",
    //   accountType: "Credit",
    //   openEntry: "789",
    //   openEntryType: "credit",
    //   accountCategoryCode: "acc789",
    //   companyCode: "cc789",
    //   currencyCode: "cc334"
    // },
    // {
    //   id: "4",
    //   mainAccountCode: "main101",
    //   mainAccountName: "accountName4",
    //   description: "description4",
    //   accountType: "Debit",
    //   openEntry: "101",
    //   openEntryType: "debit",
    //   accountCategoryCode: "acc101",
    //   companyCode: "cc101",
    //   currencyCode: "cc445"
    // },
    // {
    //   id: "5",
    //   mainAccountCode: "main202",
    //   mainAccountName: "accountName5",
    //   description: "description5",
    //   accountType: "Credit",
    //   openEntry: "202",
    //   openEntryType: "credit",
    //   accountCategoryCode: "acc202",
    //   companyCode: "cc202",
    //   currencyCode: "cc556"
    // }
  ]

}
let nextId = 3
const mainAccountMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {

    //MainAccountList

    builder.addCase(getMainAccountList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getMainAccountList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.MainAccountList = action.payload;
      }
    );
    builder.addCase(
      getMainAccountList.rejected,
      (state, action) => {
        state.loading = false;

        state.MainAccountList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //MainAccountSearchList

    builder.addCase(getMainAccountSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getMainAccountSearchList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.MainAccountSearchList = action.payload;
      }
    );
    builder.addCase(
      getMainAccountSearchList.rejected,
      (state, action) => {
        state.loading = false;

        state.MainAccountSearchList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );




    builder.addCase(postMainAccountStatus.pending, (state) => {
      state.loading = true;
    });
    //   builder.addCase(
    //     postMainAccountStatus.fulfilled, (state, action) => {
    //         state.loading = false;
    //         const newItem = { ...action.payload, id: nextId++ };
    //         state.MainAccountList = [...state.MainAccountList, newItem];
    //         console.log(state.MainAccountList, "newItem")
    //     }
    // );
    builder.addCase(postMainAccountStatus.fulfilled, (state, action) => {
      console.log(action.payload, 'find action.payload')
      state.loading = false;
      state.MainAccountList = [...state.MainAccountList, action.payload];
    });
    builder.addCase(
      postMainAccountStatus.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //AddMainAccount

    builder.addCase(getAddMainAccount.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAddMainAccount.fulfilled,
      (state, action) => {
        state.loading = false;
        state.AddMainAccount = action.payload;
      }
    );
    builder.addCase(
      getAddMainAccount.rejected,
      (state, action) => {
        state.loading = false;

        state.AddMainAccount = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //MainAccountDetailEdit

    builder.addCase(patchMainAccountDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchMainAccountDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.MainAccountList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.MainAccountList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.MainAccountList = updatedCurrencyList;
        } else {
          state.MainAccountList = [...state.MainAccountList, action.payload];

        }
      }
    );

    builder.addCase(
      patchMainAccountDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.mainAccountDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //getPatchMainAccountDetailEdit
    builder.addCase(getPatchMainAccountDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getPatchMainAccountDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getMainAccountDetailEdit = action.payload;
        console.log(state.getMainAccountDetailEdit, "ll")
      }
    );
    builder.addCase(
      getPatchMainAccountDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.getMainAccountDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //MainAccountDetailView

    builder.addCase(getMainAccountDetailView.pending, (state) => {
      state.loading = true;
    });

    builder.addCase(
      getMainAccountDetailView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.MainAccountDetailView = action.payload;
        console.log(state.MainAccountDetailView, "state.MainAccountDetailView");
      }
    );

    builder.addCase(
      getMainAccountDetailView.rejected,
      (state, action) => {
        state.loading = false;
        state.MainAccountDetailView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  }
});

export default mainAccountMasterReducer.reducer;