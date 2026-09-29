import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_PAYMENT_VOUCHER,
  GET_CHECK_BOOK_DETAILS,
  GET_PAYMENT_VOUCHER_BY_ID,
  PATCH_PAYMENT_STATUS_BY_ID,
  POST_PAYMENT_VOUCHER_CREATE_DATA,
  GET_PAYMENT_CHECKBOK_DETAILS,
  PATCH_INVOICE_LIST_DETAILS,
  SEARCH_PAYMENT_VOUCHER,
  FILTER_PAYMENT_VOUCHER,
} from "../../../redux/actionTypes";
import disbursementService from "../../../services/disbursementService";
import { formatCurrency } from "../../../utility/currencyConverter";

export const paymentVocherMiddleware = createAsyncThunk(
  GET_PAYMENT_VOUCHER,
  async (payload, { rejectWithValue }) => {
    try {
      console.log("=== DISBURSEMENT MIDDLEWARE CALLED ===");
      console.log("Fetching disbursements data with payload:", payload);

      // Call the disbursement service to get the list
      const result = await disbursementService.getDisbursements(
        payload?.page || 1,
        payload?.pageSize || 10
      );

      console.log("Disbursement service result:", result);

      if (result.success) {
        // Map the API response to the table format
        const mappedData = result.data.data.map((disbursement, index) => ({
          id: disbursement.disbursementId,
          VoucherNumber: disbursement.voucherNumber,
          TransactionNumber: disbursement.transactionNumber,
          CustomerCode: disbursement.customerCode,
          Insurer: disbursement.insurerName,
          PolicyNumber: disbursement.policyNumber,
          VoucheDate: new Date(disbursement.voucherDate).toLocaleDateString(
            "en-US",
            {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            }
          ),
          Amount: formatCurrency(disbursement.amount),
          action: disbursement.disbursementId,
        }));

        return {
          data: mappedData,
          pagination: result.data.pagination,
        };
      } else {
        return rejectWithValue(result.error || "Failed to fetch disbursements");
      }
    } catch (error) {
      console.error("Error in payment voucher middleware:", error);
      return rejectWithValue(error.message || "An unexpected error occurred");
    }
  }
);
export const chequebookdetailsMiddleware = createAsyncThunk(
  GET_CHECK_BOOK_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getpaymentVocherByIdMiddleware = createAsyncThunk(
  GET_PAYMENT_VOUCHER_BY_ID,
  async (payload, { rejectWithValue, getState }) => {
    const { paymentVoucherReducers } = getState();

    const { paymentVocherList } = paymentVoucherReducers;
    const filteredData = paymentVocherList.filter(
      (item) => item.id === parseInt(payload)
    );
    try {
      return filteredData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getDisbursementDetailsMiddleware = createAsyncThunk(
  "paymentVoucher/getDisbursementDetails",
  async (disbursementId, { rejectWithValue }) => {
    try {
      // Call the disbursement service to get the details
      const result = await disbursementService.getDisbursementById(
        disbursementId
      );

      if (result.success) {
        return result.data.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(
        error.message || "Failed to fetch disbursement details"
      );
    }
  }
);
export const patchpaymentStatusByIdMiddleware = createAsyncThunk(
  PATCH_PAYMENT_STATUS_BY_ID,
  async (payload, { rejectWithValue, getState }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postpaymentVocherCreateDataMiddleware = createAsyncThunk(
  POST_PAYMENT_VOUCHER_CREATE_DATA,
  async (payload, { rejectWithValue, getState }) => {
    try {
      // Format the date to YYYY-MM-DD
      const voucherDate =
        payload.VoucherDate instanceof Date
          ? payload.VoucherDate.toISOString().split("T")[0]
          : payload.VoucherDate;

      // Prepare the disbursement data according to the API specification
      const disbursementData = {
        voucherDate: voucherDate,
        departmentCode: payload.DepartmentCode?.code || payload.DepartmentCode,
        branchCode: payload.BranchCode?.code || payload.BranchCode,
        payeeType: payload.PayeeType?.name || payload.PayeeType,
        criteria: payload.Criteria?.name || payload.Criteria,
        customerCode:
          payload.CustomerCode?.code ||
          payload.CustomerCode?.label ||
          payload.CustomerCode ||
          payload.AgentReferrer?.code ||
          undefined,
        referrerId:
          payload.AgentReferrer?.code ||
          payload.referrerId ||
          undefined,
        referrerName:
          payload.AgentReferrer?.name ||
          payload.referrerName ||
          undefined,
        insurerName:
          payload.Insurer?.name ||
          payload.Insurer?.code ||
          payload.Insurer ||
          undefined,
        policyNumber:
          payload.PolicyNumber?.code ||
          payload.PolicyNumber?.name ||
          payload.PolicyNumber ||
          undefined,
        transactionCode:
          payload.Transactioncode?.code || payload.Transactioncode,
        transactionDescription: payload.TransactionDescription,
        instrumentCurrency:
          payload.SelectInstrumentCurrency?.code ||
          payload.SelectInstrumentCurrency,
        remarks: payload.Remarks,
        amount:
          (payload.PayeeType?.code || payload.PayeeType) === "Agent/Referrer"
            ? "0.00"
            : "350000.00",
      };

      console.log("Creating disbursement with data:", disbursementData);

      // Call the disbursement service
      const result = await disbursementService.createDisbursement(
        disbursementData
      );

      if (result.success) {
        // Return the disbursement data for the reducer
        return {
          success: true,
          disbursementData: result.data,
          originalPayload: payload,
        };
      } else {
        return rejectWithValue(result.error || "Failed to create disbursement");
      }
    } catch (error) {
      console.error("Error in payment voucher middleware:", error);
      return rejectWithValue(error.message || "An unexpected error occurred");
    }
  }
);
export const getpaymentCheckbookDetailsMiddleware = createAsyncThunk(
  GET_PAYMENT_CHECKBOK_DETAILS,
  async (payload, { rejectWithValue, getState }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchpaymentVocherInvoiceListMiddleware = createAsyncThunk(
  PATCH_INVOICE_LIST_DETAILS,
  async (payload, { rejectWithValue, getState }) => {
    try {
      console.log(payload, "find payload in patch");
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getPaymentVocherListBySearchMiddleware = createAsyncThunk(
  SEARCH_PAYMENT_VOUCHER,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { paymentVoucherReducers } = getState();
    const { paymentVocherList } = paymentVoucherReducers;
    console.log(paymentVocherList, field, value, "dta");
    function filterReceiptsByField(receipts, field, value) {
      const lowercasedValue = value.toLowerCase();
      return receipts.filter((receipt) =>
        receipt[field].toLowerCase().startsWith(lowercasedValue)
      );
    }

    // Example usage:

    try {
      const filteredReceipts = filterReceiptsByField(
        paymentVocherList,
        field,
        value
      );

      return filteredReceipts;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const bulkPrintDisbursementsMiddleware = createAsyncThunk(
  "disbursements/bulkPrint",
  async (filters, { rejectWithValue }) => {
    try {
      console.log(
        "Bulk print disbursements middleware called with filters:",
        filters
      );
      const response = await disbursementService.bulkPrintDisbursements(
        filters
      );

      if (response.success) {
        return response.data; // This contains the API response with success, message, data, etc.
      } else {
        // Return the full error response structure (response.data contains the API error response)
        return rejectWithValue(
          response.data ||
            response.error || { message: "Failed to bulk print disbursements" }
        );
      }
    } catch (error) {
      console.error("Bulk print disbursements middleware error:", error);
      return rejectWithValue(
        error?.response?.data || {
          message: error.message || "Failed to bulk print disbursements",
        }
      );
    }
  }
);

export const filterPaymentVoucherMiddleware = createAsyncThunk(
  FILTER_PAYMENT_VOUCHER,
  async (
    { field, value, fromDate, toDate, page = 1, pageSize = 10 },
    { rejectWithValue }
  ) => {
    try {
      console.log("=== DISBURSEMENT FILTER MIDDLEWARE CALLED ===");
      console.log("Filtering disbursements with:", {
        field,
        value,
        fromDate,
        toDate,
        page,
        pageSize,
      });

      const filterParams = {
        page,
        pageSize,
      };

      // Add the specific filter field based on the selected dropdown option
      if (field && value) {
        // Map the field names to API parameter names
        switch (field) {
          case "VoucherNumber":
            filterParams.voucherNumber = value;
            break;
          case "TransactionNumber":
            filterParams.transactionNumber = value;
            break;
          case "CustomerCode":
            filterParams.customerCode = value;
            break;
          default:
            filterParams[field] = value;
        }
      }

      // Add date filters if provided
      if (fromDate) {
        filterParams.fromDate = fromDate;
      }
      if (toDate) {
        filterParams.toDate = toDate;
      }

      console.log("Filter parameters:", filterParams);

      // Call the disbursement service to filter the list
      const result = await disbursementService.filterDisbursements(
        filterParams
      );

      console.log("Disbursement filter service result:", result);

      if (result.success) {
        // Map the API response to the table format
        const transformedData = result.data.data.map((disbursement, index) => ({
          id: disbursement.id || index + 1,
          VoucherNumber:
            disbursement.voucherNumber || disbursement.disbursementNumber,
          TransactionNumber: disbursement.transactionNumber,
          CustomerCode: disbursement.customerCode,
          DisbursementDate:
            disbursement.disbursementDate || disbursement.createdAt,
          Amount: disbursement.amount,
          Status: disbursement.status || "Active",
          // Include all original fields for compatibility
          ...disbursement,
        }));

        console.log("Transformed disbursement filter data:", transformedData);

        return {
          data: transformedData,
          pagination: result.data.pagination || {
            page: page,
            pageSize: pageSize,
            total: transformedData.length,
            totalPages: Math.ceil(transformedData.length / pageSize),
          },
        };
      } else {
        console.error("Disbursement filter service failed:", result.error);
        return rejectWithValue(
          result.error || "Failed to filter disbursements"
        );
      }
    } catch (error) {
      console.error("Disbursement filter middleware error:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);
