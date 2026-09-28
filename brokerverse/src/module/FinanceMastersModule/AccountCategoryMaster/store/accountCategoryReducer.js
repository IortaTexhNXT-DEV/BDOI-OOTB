import { createSlice } from "@reduxjs/toolkit";
import {
  getAccountCategoryList,
  getAccountCategorySearchList,
  postAccountCategoryStatus,
  getAddAccountCategoryMiddleWare,
  getAccountCategoryDetailEditMiddleWare,
  getAccountCategoryDetailViewMiddleWare,
  patchAccountCategoryDetailEditMiddleWare,
} from "./accountCategoryMeddleware";
const initialState = {
  loading: false,
  error: "",

  AccountCategoryList: [
    {
      id: 1,
      accountCategoryCode: "AC00123",
      accountCategoryName: "Debtor",
      description:"description",
      status: 0,
      action: 1,
    },
    {
      id: 2,
      accountCategoryCode: "AC00234",
      accountCategoryName: "Creditor",
      description:"description",
      status: 1,
      action: 2,
    },
    {
      id: 3,
      accountCategoryCode: "AC00345",
      accountCategoryName: "Supplier",
      description:"description",
      status: 0,
      action: 1,
    },
    {
      id: 4,
      accountCategoryCode: "AC00456",
      accountCategoryName: "Customer",
      description:"description",
      status: 1,
      action: 2,
    },
    {
      id: 5,
      accountCategoryCode: "AC00567",
      accountCategoryName: "Vendor",
      description:"description",
      status: 0,
      action: 1,
    },
    {
      id: 6,
      accountCategoryCode: "AC00678",
      accountCategoryName: "Investor",
      description:"description",
      status: 1,
      action: 2,
    },
    {
      id: 7,
      accountCategoryCode: "AC00789",
      accountCategoryName: "Lender",
      description:"description",
      status: 0,
      action: 1,
    },
    {
      id: 8,
      accountCategoryCode: "AC00890",
      accountCategoryName: "Borrower",
      description:"description",
      status: 1,
      action: 2,
    },
    {
      id: 9,
      accountCategoryCode: "AC00901",
      accountCategoryName: "Partner",
      description:"description",
      status: 0,
      action: 1,
    },
    {
      id: 10,
      accountCategoryCode: "AC01012",
      accountCategoryName: "Shareholder",
      description:"description",
      status: 1,
      action: 2,
    }
  ],
  AccountCategorySearchList: [],
  AccountCategoryStatus: {},
  AddAccountCategory: {},
  AccountCategoryDetailEdit: {},
  AccountCategoryDetailView: {},
};
const accountCategoryMasterReducer = createSlice({
  name: "accountCategoryMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //AccountCategoryList

    builder.addCase(getAccountCategoryList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getAccountCategoryList.fulfilled, (state, action) => {
      state.loading = false;
      state.AccountCategoryList = action.payload;
    });
    builder.addCase(getAccountCategoryList.rejected, (state, action) => {
      state.loading = false;

      state.AccountCategoryList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AccountCategorySearchList

    builder.addCase(getAccountCategorySearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getAccountCategorySearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.AccountCategorySearchList = action.payload;
    });
    builder.addCase(getAccountCategorySearchList.rejected, (state, action) => {
      state.loading = false;

      state.AccountCategorySearchList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AccountCategoryStatus

    builder.addCase(postAccountCategoryStatus.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAccountCategoryStatus.fulfilled, (state, action) => {
      state.loading = false;
      state.AccountCategoryStatus = action.payload;
    });
    builder.addCase(postAccountCategoryStatus.rejected, (state, action) => {
      state.loading = false;

      state.AccountCategoryStatus = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AddAccountCategory

    builder.addCase(getAddAccountCategoryMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAddAccountCategoryMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.AccountCategoryList = [
          ...state.AccountCategoryList,
          action.payload,
        ];
        // state.AddBank = action.payload;
      }
    );
    builder.addCase(
      getAddAccountCategoryMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.AddAccountCategory = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //AccountCategoryDetailEdit

    builder.addCase(getAccountCategoryDetailEditMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAccountCategoryDetailEditMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.AccountCategoryDetailEdit = action.payload;
      }
    );
    builder.addCase(
      getAccountCategoryDetailEditMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.AccountCategoryDetailEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //AccountCategoryDetailView

    builder.addCase(getAccountCategoryDetailViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAccountCategoryDetailViewMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.AccountCategoryDetailView = action.payload;
      }
    );
    builder.addCase(
      getAccountCategoryDetailViewMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.AccountCategoryDetailView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // patch data

    builder.addCase(
      patchAccountCategoryDetailEditMiddleWare.pending,
      (state) => {
        state.loading = true;
      }
    );
    builder.addCase(
      patchAccountCategoryDetailEditMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        console.log(action.payload, "find red");
        state.AccountCategoryList = state.AccountCategoryList?.map((item) => {
          if (item.id === parseInt(action.payload?.id)) {
            return {
              ...item,
              accountCategoryCode: action.payload?.categoryCode,
              accountCategoryName: action.payload?.categoryName,
            };
          }
          return item;
        });
        // state.AccountCategoryDetailView = action.payload;
      }
    );
    builder.addCase(
      patchAccountCategoryDetailEditMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default accountCategoryMasterReducer.reducer;
