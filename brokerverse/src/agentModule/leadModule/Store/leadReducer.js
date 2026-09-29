import { createSlice } from "@reduxjs/toolkit";
import {
  postCreateleadMiddleware,
  postFireCreateleadMiddleware,
  patchLeadEditMiddleWare,
  getleadcompanydataMiddleware,
  getleadtableMiddleware,
  getPaymentSearchDataMiddleWare,
  getLeadDataMiddleware,
  getLeadEditDataMiddleWare,
  getLeadByIdMiddleware,
  deleteLeadMiddleware,
  getLeadStatsMiddleware,
} from "./leadMiddleware";

const initialState = {
  loading: false,
  error: "",
  totalLeads: 0,
  currentPage: 1,
  pageSize: 10,
  leadtabledata: [],
  createleaddata: {},
  LeadEditdata: {},
  getEditLeadData: {},
  leadcompanydata: {},
  currentLeadDetails: {},
  leadStats: {
    totalLeads: 0,
    recentLeads: 0,
    last30DaysLeads: 0,
    convertedLeads: 0,
    leadsWithQuotations: 0,
    conversionRate: 0,
    quotationRate: 0,
    growthRate: 0,
    leadsByCategory: [],
    leadsByCountry: [],
    leadsByStatus: [],
  },
};

const leadReducer = createSlice({
  name: "leadReducer",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = "";
    },
    clearLeadData: (state) => {
      state.leadtabledata = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(postCreateleadMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postCreateleadMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.createleaddata = action.payload;
    });
    builder.addCase(postCreateleadMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postFireCreateleadMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postFireCreateleadMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.createleaddata = action.payload;
    });
    builder.addCase(postFireCreateleadMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getleadtableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getleadtableMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.leadtabledata = action.payload.data || action.payload;
      state.totalLeads = action.payload.total || 0;
      state.currentPage = action.payload.page || 1;
      state.pageSize = action.payload.pageSize || 10;
    });
    builder.addCase(getleadtableMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getLeadByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getLeadByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.currentLeadDetails = action.payload;
    });
    builder.addCase(getLeadByIdMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(patchLeadEditMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(patchLeadEditMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      // Update currentLeadDetails with the updated data
      state.currentLeadDetails = action.payload;

      // Also update the lead in the table data if it exists
      const updatedIndex = state.leadtabledata.findIndex(
        (item) =>
          item.leadId === action.payload.leadId || item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        state.leadtabledata[updatedIndex] = action.payload;
      }
    });
    builder.addCase(patchLeadEditMiddleWare.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getleadcompanydataMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getleadcompanydataMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.leadcompanydata = action.payload;
    });
    builder.addCase(getleadcompanydataMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getPaymentSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getPaymentSearchDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.paymentSearchList = action.payload;
      }
    );
    builder.addCase(
      getPaymentSearchDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getLeadDataMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getLeadDataMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.leadtabledata = action.payload;
    });
    builder.addCase(getLeadDataMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getLeadEditDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getLeadEditDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.getEditLeadData = action.payload;
    });
    builder.addCase(getLeadEditDataMiddleWare.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(deleteLeadMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(deleteLeadMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // Remove the deleted lead from the table data
      state.leadtabledata = state.leadtabledata.filter(
        (lead) => lead.leadId !== action.payload.leadId
      );
      state.totalLeads = Math.max(0, state.totalLeads - 1);
    });
    builder.addCase(deleteLeadMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getLeadStatsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getLeadStatsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.leadStats = action.payload;
    });
    builder.addCase(getLeadStatsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export const { clearError, clearLeadData } = leadReducer.actions;
export default leadReducer.reducer;
