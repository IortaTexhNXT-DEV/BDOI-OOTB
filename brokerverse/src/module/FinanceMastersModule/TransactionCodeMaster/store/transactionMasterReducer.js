import { createSlice } from "@reduxjs/toolkit";
import {
  getTransactioncodeListMiddleware,
  getTransactioncodeListsearch,
  postAddTransaction,
  postStatus,
  getTransactionCodeSetup,
  getUserGroupAccess,
  postAddTransactionCodeSetup,
  postAddUserGroupAccess,
  getTrascationcodeDetailsView,
  patchTrascationcodeDetailsEdit,
  getpatchTrascationcodeDetailsEdit,
  getUserEditData,
  patchUserRoleAccess,
} from "./transactionCodeMasterMiddleware";

const initialState = {
  loading: false,
  error: "",
  TransactioncodeList: [
    {
      id: 1,
      TransactionCode: "RVQP",
      TransactionName: "RV Cheque - Premium",
      TransactionBasis: "TB123",
      BranchCode: "B123",
      DepartmentCode: "Dept123",
      MainAccountCode: "12",
      MainAccountDescription: "hii",
      SubAccountCode: "88",
      SubAccountDescription: "sub99",
      BranchDescription: "branch66",
      DepartmentDescription: "dept12",
      Description: "description",
      Status: true,
    },
    {
      id: 2,
      TransactionCode: "RVCP",
      TransactionName: "RV Transfer - Premium",
      TransactionBasis: "TB123",
      BranchCode: "B123",
      DepartmentCode: "Dept123",
      MainAccountCode: "12",
      MainAccountDescription: "hii",
      SubAccountCode: "88",
      SubAccountDescription: "sub99",
      BranchDescription: "branch66",
      DepartmentDescription: "dept12",
      Description: "description",
      Status: true,
    },
  ],
  TransactioncodeListsearch: [],
  TrascationcodeDetailsView: [],
  AddTransaction: {},
  Status: {},
  getUserAccessData: {},
  TransactionCodeSetup: [
    {
      id: 1,
      AccountingPeriodStart: "12/1/2023",
      AccountingPeriodEnd: "12/1/2023",
      TransactionNumberFrom: "123",
      TransactionNumberTo: "12",
      lastUsed: "0",
    },
  ],
  UserGroupAccessList: [
    {
      id: 1,
      UserRole: "UR",
      MinimumTransaction: "333",
      MaximumTransaction: "663",
    },
  ],
  AddTransactionCodeSetup: {},
  AddUserGroupAccess: {},
  TrascationcodeDetailsView: {},
  TrascationcodeDetailsEdit: {},
  getTrascationcodeDetailsEdit: {},
};
let nextId = 2;
let nextId2 = 2;
const transactionCodeMasterReducer = createSlice({
  name: "transactioncodeList",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //TransactioncodeList

    builder.addCase(getTransactioncodeListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getTransactioncodeListMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.TransactioncodeList = [action.payload];
      }
    );
    builder.addCase(
      getTransactioncodeListMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.TransactioncodeList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //TransactioncodeListsearch

    builder.addCase(getTransactioncodeListsearch.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTransactioncodeListsearch.fulfilled, (state, action) => {
      state.loading = false;
      state.TransactioncodeListsearch = action.payload;
    });
    builder.addCase(getTransactioncodeListsearch.rejected, (state, action) => {
      state.loading = false;

      // state.TransactioncodeList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //Status

    builder.addCase(postStatus.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postStatus.fulfilled, (state, action) => {
      state.loading = false;
      state.Status = action.payload;
    });
    builder.addCase(postStatus.rejected, (state, action) => {
      state.loading = false;

      state.Status = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AddTransaction

    builder.addCase(postAddTransaction.pending, (state) => {
      state.loading = true;
    });
    // builder.addCase(postAddTransaction.fulfilled, (state, action) => {
    //   state.loading = false;
    //   const newItem2 = { ...action.payload, id: nextId++ };
    //   state.TransactioncodeList = [...state.TransactioncodeList, newItem2];
    //   console.log(state.TransactioncodeList, "g")
    // });
    builder.addCase(postAddTransaction.fulfilled, (state, action) => {
      console.log(action.payload, "find action.payload");
      state.loading = false;
      state.TransactioncodeList = [
        ...state.TransactioncodeList,
        action.payload,
      ];
    });
    builder.addCase(postAddTransaction.rejected, (state, action) => {
      state.loading = false;

      // state.postTCdata = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //TransactionCodeSetup

    builder.addCase(getTransactionCodeSetup.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTransactionCodeSetup.fulfilled, (state, action) => {
      state.loading = false;
      state.TransactionCodeSetup = [action.payload];
    });
    builder.addCase(getTransactionCodeSetup.rejected, (state, action) => {
      state.loading = false;

      state.TransactionCodeSetup = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // UserGroupAccess

    builder.addCase(getUserGroupAccess.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getUserGroupAccess.fulfilled, (state, action) => {
      state.loading = false;
      state.UserGroupAccessList = [action.payload];
    });
    builder.addCase(getUserGroupAccess.rejected, (state, action) => {
      state.loading = false;

      state.UserGroupAccessList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AddTransactionCodeSetup
    builder.addCase(postAddTransactionCodeSetup.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddTransactionCodeSetup.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = { ...action.payload, id: nextId++ };
      state.TransactionCodeSetup = [...state.TransactionCodeSetup, newItem2];
      console.log(state.TransactionCodeSetup, "g");
    });
    builder.addCase(postAddTransactionCodeSetup.rejected, (state, action) => {
      state.loading = false;

      // state.postTCdata = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //postAddUserGroupAccess

    builder.addCase(postAddUserGroupAccess.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddUserGroupAccess.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = { ...action.payload, id: nextId2++ };
      state.UserGroupAccessList = [...state.UserGroupAccessList, newItem2];
      console.log(state.UserGroupAccessList, "jj");
    });
    builder.addCase(postAddUserGroupAccess.rejected, (state, action) => {
      state.loading = false;

      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //TrascationcodeDetailsView
    builder.addCase(getTrascationcodeDetailsView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTrascationcodeDetailsView.fulfilled, (state, action) => {
      state.loading = false;
      state.TrascationcodeDetailsView = action.payload;
    });
    builder.addCase(getTrascationcodeDetailsView.rejected, (state, action) => {
      state.loading = false;

      state.TrascationcodeDetailsView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //TrascationcodeDetailsEdit

    builder.addCase(patchTrascationcodeDetailsEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchTrascationcodeDetailsEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.TransactioncodeList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.TransactioncodeList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.TransactioncodeList = updatedCurrencyList;
        } else {
          state.TransactioncodeList = [
            ...state.TransactioncodeList,
            action.payload,
          ];
        }
      }
    );
    builder.addCase(
      patchTrascationcodeDetailsEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.TrascationcodeDetailsEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    builder.addCase(getpatchTrascationcodeDetailsEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getpatchTrascationcodeDetailsEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getTrascationcodeDetailsEdit = action.payload;
      }
    );
    builder.addCase(
      getpatchTrascationcodeDetailsEdit.rejected,
      (state, action) => {
        state.loading = false;

        state.getTrascationcodeDetailsEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getUserEditData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getUserEditData.fulfilled, (state, action) => {
      state.loading = false;
      state.getUserAccessData = action.payload;
    });
    builder.addCase(getUserEditData.rejected, (state, action) => {
      state.loading = false;

      state.getUserAccessData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(patchUserRoleAccess.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(patchUserRoleAccess.fulfilled, (state, action) => {
      state.loading = false;
      const updatedIndex = state.UserGroupAccessList.findIndex(
        (item) => item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        const updatedCurrencyList = [...state.UserGroupAccessList];
        updatedCurrencyList[updatedIndex] = action.payload;
        state.UserGroupAccessList = updatedCurrencyList;
      } else {
        state.UserGroupAccessList = [
          ...state.UserGroupAccessList,
          action.payload,
        ];
      }
    });
    builder.addCase(patchUserRoleAccess.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default transactionCodeMasterReducer.reducer;
