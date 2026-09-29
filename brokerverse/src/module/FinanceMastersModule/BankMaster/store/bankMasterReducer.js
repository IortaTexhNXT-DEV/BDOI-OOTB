import { createSlice } from "@reduxjs/toolkit";
import {
  getBankList,
  getBankSearchList,
  postBankStatus,
  getAddBank,
  patchBankDetailEdit,
  getBankDetailView,
  postAddBank,
  postAddBankMiddleware,
  postAddAccountDetails,
  getAccountDetailsView,
  getPatchAccountDetailsView,
  postPatchAccountDetailEdit,
  getChequeListData,
  postChequeDataMiddleWare,
  getChequeEditDataMiddleWare,
  postChequeEditDataMiddleWare,
  getSeachAddAccountDetails
} from "./bankMasterMiddleware";
import SvgArrow from "../../../../assets/icons/SvgArrow";
const initialState = {
  loading: false,
  error: "",
  BankList: [],
  AccountDetailsList: [
    {
      id: 1,
      AccountNumber: "124",
      AccountName: "ayesha",
      AccountType: "Credit",
      MainAccount: "Main123",
      MainAccountDescription: "MainAccountDescription",
      TransactionLimit: "0",
      MaxTransactionLimit: "0"
    },
    {
      id: 2,
      AccountNumber: "124",
      AccountName: "ayesha",
      AccountType: "Credit",
      MainAccount: "Main123",
      MainAccountDescription: "MainAccountDescription",
      TransactionLimit: "0",
      MaxTransactionLimit: "0"
    }
  ],
  searchAccountDetails: [],

  BankAccountList: [

  ],
  accountDetailsView: {},
  BankSearchList: [],
  BankStatus: {},
  AddBank: {},
  PostAddBank: {},
  BankDetailEdit: {},
  BankDetailView: {},
  AccountPatchDetailView: {},
  chequeListData: [
    {
      id: "1",
      chequeBookNo: "chequeBookNo",
      chequeLeafBegining: "chequeLeafBegining",
      chequeLeafEnd: "chequeLeafEnd"
    },
    {
      id: "2",
      chequeBookNo: "chequeBookNo",
      chequeLeafBegining: "chequeLeafBegining",
      chequeLeafEnd: "chequeLeafEnd"
    }
  ],
  postCheque: {},
  getEditChequeData: {},
  postEditChequeData: {}
};

const bankMasterReducer = createSlice({
  name: "bankMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //BankList

    builder.addCase(getBankList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getBankList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.BankList = action.payload;
      }
    );
    builder.addCase(
      getBankList.rejected,
      (state, action) => {
        state.loading = false;

        state.BankList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //BankSearchList

    builder.addCase(getBankSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getBankSearchList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.BankSearchList = action.payload;
      }
    );
    builder.addCase(
      getBankSearchList.rejected,
      (state, action) => {
        state.loading = false;

        state.BankSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //chequeListData

    builder.addCase(getChequeListData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getChequeListData.fulfilled,
      (state, action) => {
        state.loading = false;
        state.chequeListData = action.payload;
      }
    );
    builder.addCase(
      getChequeListData.rejected,
      (state, action) => {
        state.loading = false;

        state.chequeListData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //BankStatus

    builder.addCase(postAddBankMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddBankMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.BankList = [...state.BankList, action.payload];
    });
    builder.addCase(
      postAddBankMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.BankStatus = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(postAddAccountDetails.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddAccountDetails.fulfilled, (state, action) => {
      state.loading = false;
      state.AccountDetailsList = [...state.AccountDetailsList, action.payload];
    });

    builder.addCase(
      postAddAccountDetails.rejected,
      (state, action) => {
        state.loading = false;

        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getSeachAddAccountDetails.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSeachAddAccountDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.searchAccountDetails = action.payload
      }
    );

    builder.addCase(
      getSeachAddAccountDetails.rejected,
      (state, action) => {
        state.loading = false;

        state.searchAccountDetails = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //AddBank

    builder.addCase(getAddBank.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAddBank.fulfilled,
      (state, action) => {
        state.loading = false;
        state.BankList = [...state.BankList, action.payload];
      }
    );
    builder.addCase(
      getAddBank.rejected,
      (state, action) => {
        state.loading = false;

        state.AddBank = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //PostAdd

    builder.addCase(postAddBank.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddBank.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = action.payload;
        state.BankList = [...state.BankList, newItem2];
      }
    );
    
    builder.addCase(
      postAddBank.rejected,
      (state, action) => {
        state.loading = false;

        state.PostAddBank = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //BankDetailEdit

    builder.addCase(patchBankDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchBankDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.BankList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedBankList = [...state.BankList];
          updatedBankList[updatedIndex] = action.payload;
          state.BankList = updatedBankList;
        } else {
          state.BankList = [...state.BankList, action.payload];
        }
      }
    );

    builder.addCase(
      patchBankDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.BankDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(postPatchAccountDetailEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postPatchAccountDetailEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.AccountDetailsList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.AccountDetailsList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.AccountDetailsList = updatedCurrencyList;
        } else {
          state.AccountDetailsList = [...state.AccountDetailsList, action.payload];
        }
      }
    );

    builder.addCase(
      postPatchAccountDetailEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.BankDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //BankDetailView

    builder.addCase(getBankDetailView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getBankDetailView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.BankDetailView = action.payload;
      }
    );
    builder.addCase(
      getBankDetailView.rejected,
      (state, action) => {
        state.loading = false;

        state.BankDetailView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    builder.addCase(getPatchAccountDetailsView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getPatchAccountDetailsView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.AccountPatchDetailView = action.payload;
      }
    );
    builder.addCase(
      getPatchAccountDetailsView.rejected,
      (state, action) => {
        state.loading = false;

        state.AccountPatchDetailView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getAccountDetailsView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAccountDetailsView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.accountDetailsView = action.payload;
      }
    );
    builder.addCase(
      getAccountDetailsView.rejected,
      (state, action) => {
        state.loading = false;

        state.accountDetailsView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    builder.addCase(postChequeDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postChequeDataMiddleWare.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = action.payload;
        state.chequeListData = [...state.chequeListData, newItem2];
      }
    );
    builder.addCase(
      postChequeDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.postCheque = {}
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getChequeEditDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getChequeEditDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getEditChequeData = action.payload;
      }
    );
    builder.addCase(
      getChequeEditDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.getEditChequeData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(postChequeEditDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postChequeEditDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.chequeListData.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedBankList = [...state.chequeListData];
          updatedBankList[updatedIndex] = action.payload;
          state.chequeListData = updatedBankList;
        } else {
          state.chequeListData = [...state.chequeListData, action.payload];
        }
      }
    );

    builder.addCase(
      postChequeEditDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.postEditChequeData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default bankMasterReducer.reducer;