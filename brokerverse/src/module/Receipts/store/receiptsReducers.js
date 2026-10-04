import { createSlice } from "@reduxjs/toolkit";
import { getReceiptsListMiddleware, getReceiptsListByIdMiddleware, getReceiptsReceivableMiddleware, postAddReceiptsMiddleware, postPaymentDetailsMiddleware, patchReceipEditMiddleware, getReceiptsListBySearchMiddleware, getReceiptsListByFilterMiddleware, getPaymentDetails, createReceiptMiddleware, bulkPrintReceiptsMiddleware, getDraftReceiptsMiddleware, updateReceiptMiddleware, getReceiptByIdMiddleware } from "./receiptsMiddleware";
const initialState = {
  loading: false,
  error: "",
  receiptsTableList: [],
  receiptsSearchTable: [],
  receiptsFilterTable: [],
  draftReceiptsList: [],
  updateSuccess: false,
  receivableTableList: [], // Now populated from API instead of hardcoded
  currentReceiptDetails: null, // Stores the full receipt fetched by ID
  currentReceiptId: null, // Track which receipt is being edited
  receiptDetailList: [],
  paymentDetails: {},
  bulkPrintData: null,
  bulkPrintLoading: false
};
const receiptsReducer = createSlice({
  name: "receipts",
  initialState,
  reducers: {
    clearBulkPrintError: (state) => {
      state.error = "";
      state.bulkPrintError = null;
    },
    setReceivableTableList: (state, action) => {
      const list = Array.isArray(action.payload) ? action.payload : [];
      state.receivableTableList = list.map((item) => ({
        id: item.receiptListId || item.id,
        receiptListId: item.receiptListId || item.id,
        policies: item.policies,
        netPremium: item.netPremium,
        paid: item.paid,
        unPaid: item.unPaid,
        discounts: item.discounts,
        dst: item.dst,
        lgt: item.lgt,
        vat: item.vat,
        other: item.other,
        fcAmount: item.fcAmount,
        lcAmount: item.lcAmount,
        status: item.status,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        updatedBy: item.updatedBy,
        updatedAt: item.updatedAt,
      }));
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getReceiptsListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReceiptsListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.receiptsTableList = action.payload.data;
      state.pagination = action.payload.pagination;
    });
    builder.addCase(getReceiptsListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.receiptsTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getReceiptsListBySearchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReceiptsListBySearchMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.receiptsSearchTable = action.payload;
    });
    builder.addCase(getReceiptsListBySearchMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.receiptsSearchTable = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getReceiptsListByFilterMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReceiptsListByFilterMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.receiptsFilterTable = action.payload.data;
      state.pagination = action.payload.pagination;
    });
    builder.addCase(getReceiptsListByFilterMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.receiptsFilterTable = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getReceiptsListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReceiptsListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.currentReceiptId = action.payload.receiptId || null;
      state.currentReceiptDetails = {
        ...(state.currentReceiptDetails || {}),
        receiptId: action.payload.receiptId || null,
        receiptNumber: action.payload.receiptNumber || null,
        clientEmail: action.payload.clientEmail || null,
        receiptStatus: action.payload.receiptStatus || null,
      };
      state.receiptDetailList = (action.payload.receiptDetailList || []).map((item) => ({
        ...item,
        id: item.receiptListId || item.id,
        receiptListId: item.receiptListId || item.id,
      }));
      state.paymentDetails = action.payload.paymentDetails;
    });
    builder.addCase(getReceiptsListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.currentReceiptId = null;
      state.receiptDetailList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getReceiptsReceivableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getReceiptsReceivableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.receivableTableList = action.payload;
      }
    );
    builder.addCase(
      getReceiptsReceivableMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.receivableTableList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


    builder.addCase(postAddReceiptsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddReceiptsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.receiptsTableList = [action.payload, ...state.receiptsTableList];
    });
    builder.addCase(postAddReceiptsMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postPaymentDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postPaymentDetailsMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.BankDetailView = action.payload;
      }
    );
    builder.addCase(
      postPaymentDetailsMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.postPaymentDetailsMiddleware = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    builder.addCase(patchReceipEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchReceipEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;

        state.receivableTableList = action.payload;
      }
    );
    builder.addCase(
      patchReceipEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getPaymentDetails.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getPaymentDetails.fulfilled,
      (state, action) => {
        state.loading = false;

        state.paymentDetails = action.payload;
      }
    );
    builder.addCase(
      getPaymentDetails.rejected,
      (state, action) => {
        state.loading = false;

        state.paymentDetails = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(createReceiptMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(createReceiptMiddleware.fulfilled, (state, action) => {
      state.loading = false;
    });
    builder.addCase(createReceiptMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    
    // Bulk print receipts
    builder.addCase(bulkPrintReceiptsMiddleware.pending, (state) => {
      state.bulkPrintLoading = true;
    });
    builder.addCase(bulkPrintReceiptsMiddleware.fulfilled, (state, action) => {
      state.bulkPrintLoading = false;
      state.bulkPrintData = action.payload;
    });
    builder.addCase(bulkPrintReceiptsMiddleware.rejected, (state, action) => {
      state.bulkPrintLoading = false;
      state.error = action.payload || "";
    });

    // Get draft receipts
    builder.addCase(getDraftReceiptsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getDraftReceiptsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.draftReceiptsList = action.payload;
    });
    builder.addCase(getDraftReceiptsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.draftReceiptsList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Update receipt
    builder.addCase(updateReceiptMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(updateReceiptMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.updateSuccess = true;
    });
    builder.addCase(updateReceiptMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.updateSuccess = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Get receipt by ID (new middleware for editing flow)
    builder.addCase(getReceiptByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReceiptByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.currentReceiptDetails = action.payload;
      state.currentReceiptId = action.payload.receiptId;
      // Extract receiptsList to receivableTableList for the edit page
      state.receivableTableList = action.payload.receiptsList.map(item => ({
        id: item.receiptListId,
        receiptListId: item.receiptListId,
        policies: item.policies,
        netPremium: item.netPremium,
        paid: item.paid,
        unPaid: item.unPaid,
        discounts: item.discounts,
        dst: item.dst,
        lgt: item.lgt,
        vat: item.vat,
        other: item.other,
        fcAmount: item.fcAmount,
        lcAmount: item.lcAmount,
        status: item.status || "Pending"
      }));
    });
    builder.addCase(getReceiptByIdMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.currentReceiptDetails = null;
      state.currentReceiptId = null;
      state.receivableTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

  },
});

export const { clearBulkPrintError, setReceivableTableList } = receiptsReducer.actions;
export default receiptsReducer.reducer;
