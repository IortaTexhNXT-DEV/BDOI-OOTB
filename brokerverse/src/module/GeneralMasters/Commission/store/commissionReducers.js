import { createSlice } from "@reduxjs/toolkit";
import {
  addLevelPatchEditPopup,
  getCommission,
  getCommissionPopupView,
  getCommissionSearchList,
  getCommissionView,
  getEditCommissionPopup,
  getLevelCommissionSharing,
  getPatchCommissionEdit,
  getPatchCommissionEditMiddleware,
  patchCommissionEdit,
  postAddCommission,
  postAddLevelShareRatingCommission,
} from "./commissionMiddleWare";
const initialState = {
  loading: false,
  error: "",
  addCommission: {},
  commissionSearchList: [],
  commissionView: {},
  popupEditData: {},
  CommissionEdit: {},
  getCommissionEdit: {},
  commissionList: [],
  addLevelCommissionSharing: [],
  commissionPopupView: {},
};
const commissionReducers = createSlice({
  name: "commission",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getCommission.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCommission.fulfilled, (state, action) => {
      state.loading = false;
      state.commissionList = action.payload;
    });
    builder.addCase(getCommission.rejected, (state, action) => {
      state.loading = false;

      state.commissionList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //addCommission
    builder.addCase(postAddCommission.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddCommission.fulfilled, (state, action) => {
      state.loading = false;
      // const newItem = action.payload;
      state.commissionList = [...state.commissionList, action.payload];
    });
    builder.addCase(postAddCommission.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //commissionSearchList

    builder.addCase(getCommissionSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCommissionSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.commissionSearchList = action.payload;
    });
    builder.addCase(getCommissionSearchList.rejected, (state, action) => {
      state.loading = false;

      state.commissionSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getLevelCommissionSharing.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getLevelCommissionSharing.fulfilled, (state, action) => {
      state.loading = false;
      state.addLevelCommissionSharing = action.payload;
    });
    builder.addCase(getLevelCommissionSharing.rejected, (state, action) => {
      state.loading = false;
      state.addLevelCommissionSharing = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddLevelShareRatingCommission.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddLevelShareRatingCommission.fulfilled,
      (state, action) => {
        state.loading = false;
        state.addLevelCommissionSharing = [
          ...state.addLevelCommissionSharing,
          action.payload,
        ];
      }
    );
    builder.addCase(
      postAddLevelShareRatingCommission.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //CommissionDetail

    builder.addCase(getPatchCommissionEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getPatchCommissionEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getCommissionEdit = action.payload;
        state.addLevelCommissionSharing = (action.payload?.sharing || []).map((row, index) => ({
          ...row,
          id: `saved-${index + 1}`,
        }));
      }
    );
    builder.addCase(
      getPatchCommissionEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.getCommissionEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(patchCommissionEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(patchCommissionEdit.fulfilled, (state, action) => {
      state.loading = false;
      const updatedIndex = state.commissionList.findIndex(
        (item) => item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        const updatedCurrencyList = [...state.commissionList];
        updatedCurrencyList[updatedIndex] = action.payload;
        state.commissionList = updatedCurrencyList;
      } else {
        state.commissionList = [...state.commissionList, action.payload];
      }
    });
    builder.addCase(patchCommissionEdit.rejected, (state, action) => {
      state.loading = false;

      state.CommissionEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getCommissionView

    builder.addCase(getCommissionView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCommissionView.fulfilled, (state, action) => {
      state.loading = false;
      state.commissionView = action.payload;
      state.addLevelCommissionSharing = (action.payload?.sharing || []).map((row, index) => ({
        ...row,
        id: `saved-${index + 1}`,
      }));
    });
    builder.addCase(getCommissionView.rejected, (state, action) => {
      state.loading = false;

      state.commissionView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getEditCommissionPopup.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getEditCommissionPopup.fulfilled, (state, action) => {
      state.loading = false;
      state.popupEditData = action.payload;
    });
    builder.addCase(getEditCommissionPopup.rejected, (state, action) => {
      state.loading = false;

      state.popupEditData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(addLevelPatchEditPopup.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(addLevelPatchEditPopup.fulfilled, (state, action) => {
      state.loading = false;
      const updatedIndex = state.addLevelCommissionSharing.findIndex(
        (item) => item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        const updatedCurrencyList = [...state.addLevelCommissionSharing];
        updatedCurrencyList[updatedIndex] = action.payload;
        state.addLevelCommissionSharing = updatedCurrencyList;
      } else {
        state.addLevelCommissionSharing = [
          ...state.addLevelCommissionSharing,
          action.payload,
        ];
      }
    });
    builder.addCase(addLevelPatchEditPopup.rejected, (state, action) => {
      state.loading = false;

      // state.popupEditData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getCommissionPopupView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCommissionPopupView.fulfilled, (state, action) => {
      state.loading = false;
      state.commissionPopupView = action.payload;
    });
    builder.addCase(getCommissionPopupView.rejected, (state, action) => {
      state.loading = false;

      state.commissionPopupView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default commissionReducers.reducer;
