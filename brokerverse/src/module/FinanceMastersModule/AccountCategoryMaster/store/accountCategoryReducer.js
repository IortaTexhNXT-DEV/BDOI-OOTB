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

  AccountCategoryList: [],
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

      state.AccountCategoryList = [];
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

      state.AccountCategorySearchList = [];
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
        state.AccountCategoryList = state.AccountCategoryList?.map((item) =>
          item.id === action.payload?.id ? action.payload : item
        );
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
