import { createAsyncThunk } from "@reduxjs/toolkit";
import quotationService from "../../../services/quotationService";

// Action Types
export const CREATE_QUOTATION_DATA = "CREATE_QUOTATION_DATA";
export const GET_QUOTATIONS_DATA = "GET_QUOTATIONS_DATA";
export const GET_QUOTATION_BY_ID = "GET_QUOTATION_BY_ID";
export const UPDATE_QUOTATION_DATA = "UPDATE_QUOTATION_DATA";
export const DELETE_QUOTATION_DATA = "DELETE_QUOTATION_DATA";
export const GET_QUOTATION_STATS = "GET_QUOTATION_STATS";

/**
 * Create quotation middleware
 */
export const createQuotationMiddleware = createAsyncThunk(
  CREATE_QUOTATION_DATA,
  async (quotationData, { rejectWithValue }) => {
    try {
      const result = await quotationService.createQuotation(quotationData);

      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to create quotation");
    }
  }
);

/**
 * Get all quotations middleware
 */
export const getQuotationsMiddleware = createAsyncThunk(
  GET_QUOTATIONS_DATA,
  async (
    { page = 1, pageSize = 10, leadRefId = null },
    { rejectWithValue }
  ) => {
    try {
      const result = await quotationService.getAllQuotations(
        page,
        pageSize,
        leadRefId
      );

      if (result.success) {
        return {
          data: result.data,
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        };
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to fetch quotations");
    }
  }
);

/**
 * Get quotation by ID middleware
 */
export const getQuotationByIdMiddleware = createAsyncThunk(
  GET_QUOTATION_BY_ID,
  async (quotationId, { rejectWithValue }) => {
    try {
      const result = await quotationService.getQuotationById(quotationId);

      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to fetch quotation");
    }
  }
);

/**
 * Update quotation middleware
 */
export const updateQuotationMiddleware = createAsyncThunk(
  UPDATE_QUOTATION_DATA,
  async ({ quotationId, quotationData }, { rejectWithValue }) => {
    try {
      const result = await quotationService.updateQuotation(
        quotationId,
        quotationData
      );

      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to update quotation");
    }
  }
);

/**
 * Delete quotation middleware
 */
export const deleteQuotationMiddleware = createAsyncThunk(
  DELETE_QUOTATION_DATA,
  async (quotationId, { rejectWithValue }) => {
    try {
      const result = await quotationService.deleteQuotation(quotationId);

      if (result.success) {
        return { quotationId, ...result.data };
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to delete quotation");
    }
  }
);

/**
 * Get quotation statistics middleware
 */
export const getQuotationStatsMiddleware = createAsyncThunk(
  GET_QUOTATION_STATS,
  async ({ leadRefId } = {}, { rejectWithValue }) => {
    try {
      let result;
      if (leadRefId) {
        result = await quotationService.getQuotationStats(leadRefId);
      } else {
        result = await quotationService.getQuotationStats();
      }

      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(
        error?.message || "Failed to fetch quotation statistics"
      );
    }
  }
);
