import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  QUOTATION_LIST_DATA,
  QUOTATION_SEARCH_DATA,
} from "../../../redux/actionTypes";
import quotationService from "../../../services/quotationService";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate as formatConfiguredDate } from "../../../utility/dateFormat";

export const quotationListDataMiddleWare = createAsyncThunk(
  QUOTATION_LIST_DATA,
  async (
    { page = 1, pageSize = 10, leadRefId = null, search = null },
    { rejectWithValue }
  ) => {
    try {
      const result = await quotationService.getAllQuotations(
        page,
        pageSize,
        leadRefId,
        search
      );

      if (result.success) {
        // Transform API data to match the expected format
        const transformedData = result.data.map((quotation, index) => {
          // Get lead name from lead object
          const leadName = quotation.lead
            ? `${quotation.lead.firstName || ""} ${
                quotation.lead.lastName || ""
              }`.trim()
            : quotation.leadName || "Unknown prospect";

          return {
            id: quotation.quotationId || quotation.id || (index + 1).toString(),
            QuoteId:
              quotation.quotationNumber ||
              quotation.quotationId ||
              `Q-${String(index + 1).padStart(6, "0")}`,
            LeadName: leadName,
            PolicyType:
              quotation.insurancePolicyType || quotation.productType || "MOTOR",
            GrossPremium: formatCurrency(quotation.grossPremium),
            GrossPremiumValue: parseFloat(quotation.grossPremium || 0), // For sorting
            Date: formatConfiguredDate(quotation.createdAt || new Date()),
            Status: quotation.quotationStatus || quotation.status || "Draft",
            rawData: quotation, // Store full quotation data for navigation
            Actions: null, // Will be rendered by the component
          };
        });

        return {
          data: transformedData,
          page: result.page || page,
          pageSize: result.pageSize || pageSize,
          total: result.total ?? 0, // Use nullish coalescing, don't fallback to array length
        };
      } else {
        return rejectWithValue(result.error || "Failed to fetch quotations");
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to fetch quotations");
    }
  }
);

export const quotationSearchListDataMiddleWare = createAsyncThunk(
  QUOTATION_SEARCH_DATA,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { quotationMainReducers } = getState();
    const { quotationListData } = quotationMainReducers;

    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter((item) => {
        if (field === "Quote Id") {
          return item.QuoteId.toLowerCase().includes(lowercasedValue);
        } else if (field === "Lead Name") {
          return item.LeadName.toLowerCase().includes(lowercasedValue);
        }
        return (
          item.QuoteId.toLowerCase().includes(lowercasedValue) ||
          item.LeadName.toLowerCase().includes(lowercasedValue)
        );
      });
      return outputData;
    }
    try {
      const filteredPayments = filterPaymentsByField(
        quotationListData,
        field,
        value
      );
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
