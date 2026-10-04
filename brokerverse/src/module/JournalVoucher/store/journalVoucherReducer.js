import { createSlice } from "@reduxjs/toolkit";
import {
  getJournalVoucherSearchList,
  getJournalVoucherViewData,
  journalVoucherMiddleware,
  journalVoucherPostTabel,
  patchJVMiddleware,
  postAddJournalVoucher,
  postTCJournalVoucher,
  getJournalVoucherHistory,
  getJournalVoucherDetails,
  postApproveJournalVoucher,
} from "./journalVoucherMiddleware";

const initialState = {
  loading: false,
  error: "",
  postAddJV: {},
  addJournalVoucher: {},
  journalVoucherSearchList: [],
  journalVoucherView: {},
  postTCdata: {},
  journalVoucherPostTabelData: [],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  },
  journalVoucherDetailsPagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  journalVoucherList: [],
};
let transactionNumber = 1345;
let nextId2 = 2;
const journalVoucherReducer = createSlice({
  name: "journalVocher",
  initialState,
  reducers: {
    clearJournalVoucherTableData: (state) => {
      state.journalVoucherPostTabelData = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(journalVoucherMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(journalVoucherMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.journalVoucherList = [action.payload];
    });
    builder.addCase(journalVoucherMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.journalVoucherList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postTCJournalVoucher.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postTCJournalVoucher.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = {
        ...action.payload,
        id: nextId2++,
        transactionNumber: transactionNumber++,
      };
      state.journalVoucherList = [...state.journalVoucherList, newItem2];
    });
    builder.addCase(postTCJournalVoucher.rejected, (state, action) => {
      state.loading = false;

      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // seach

    builder.addCase(getJournalVoucherSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getJournalVoucherSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.journalVoucherSearchList = action.payload;
    });
    builder.addCase(getJournalVoucherSearchList.rejected, (state, action) => {
      state.loading = false;

      state.journalVoucherSearchList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //journalVoucherPostTabelData
    builder.addCase(journalVoucherPostTabel.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(journalVoucherPostTabel.fulfilled, (state, action) => {
      state.loading = false;
      state.journalVoucherPostTabelData = [action.payload];
    });
    builder.addCase(journalVoucherPostTabel.rejected, (state, action) => {
      state.loading = false;

      state.journalVoucherPostTabelData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder
      .addCase(postAddJournalVoucher.pending, (state) => {
        state.loading = true;
      })
      .addCase(postAddJournalVoucher.fulfilled, (state, action) => {
        state.loading = false;
        const newItem = {
          ...action.payload,
          id: state.journalVoucherPostTabelData.length + 1,
          transactionNumber: transactionNumber++,
        };
        state.journalVoucherPostTabelData = [
          ...state.journalVoucherPostTabelData,
          newItem,
        ];
      })
      .addCase(postAddJournalVoucher.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      });

    builder.addCase(patchJVMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(patchJVMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.journalVoucherPostTabelData = action.payload;
    });
    builder.addCase(patchJVMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getJournalVoucherViewData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getJournalVoucherViewData.fulfilled, (state, action) => {
      state.loading = false;
      state.journalVoucherView = action.payload;
    });
    builder.addCase(getJournalVoucherViewData.rejected, (state, action) => {
      state.loading = false;

      state.journalVoucherView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Get Journal Voucher History
    builder.addCase(getJournalVoucherHistory.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getJournalVoucherHistory.fulfilled, (state, action) => {
      state.loading = false;
      state.journalVoucherList = action.payload.data || [];
      state.pagination = action.payload.pagination || {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      };
    });
    builder.addCase(getJournalVoucherHistory.rejected, (state, action) => {
      state.loading = false;
      state.journalVoucherList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Get Journal Voucher Details
    builder.addCase(getJournalVoucherDetails.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getJournalVoucherDetails.fulfilled, (state, action) => {
      state.loading = false;
      state.journalVoucherPostTabelData = action.payload.data || [];
      state.journalVoucherDetailsPagination = action.payload.pagination || {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      };
      // Update journal voucher view with header info if available
      if (action.payload.voucherInfo) {
        state.journalVoucherView = {
          ...state.journalVoucherView,
          ...action.payload.voucherInfo,
        };
      }
    });
    builder.addCase(getJournalVoucherDetails.rejected, (state, action) => {
      state.loading = false;
      state.journalVoucherPostTabelData = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Post Approve Journal Voucher
    builder.addCase(postApproveJournalVoucher.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postApproveJournalVoucher.fulfilled, (state, action) => {
      state.loading = false;
      // Clear table data after successful approval
      state.journalVoucherPostTabelData = [];
    });
    builder.addCase(postApproveJournalVoucher.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export const { clearJournalVoucherTableData } = journalVoucherReducer.actions;
export default journalVoucherReducer.reducer;
