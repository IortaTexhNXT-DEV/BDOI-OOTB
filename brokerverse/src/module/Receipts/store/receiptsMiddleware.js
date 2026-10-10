import { createAsyncThunk } from "@reduxjs/toolkit";
import { receiptsService } from "../../../services/receiptsService";
import {
  GET_RECEIPT_DETAILS,
  GET_RECEIPT_DETAILS_BY_ID,
  GET_RECEIVABLE_TABLE,
  POST_ADD_RECEIPTS,
  POST_PAYMENT_DETAILS,
  PATCH_RECEIPT_EDIT,
  GET_RECEIPT_SEARCH,
  GET_RECEIPT_FILTER,
  GET_PAYMENT_DETAILS,
  POST_CREATE_RECEIPT,
  GET_DRAFT_RECEIPTS,
  UPDATE_RECEIPT,
} from "../../../redux/actionTypes";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import logger from "../../../utility/logger";

const toReceiptRow = (receipt) => ({
  id: receipt.receiptId,
  receiptNumber: receipt.receiptNumber,
  transactionCode: receipt.transactionCode,
  transactionNumber: receipt.transactionNumber,
  policyNumber: receipt.policyNumber,
  name: receipt.name,
  customerCode: receipt.customerCode,
  date: formatAppDate(receipt.receiptDate, { empty: "" }),
  amount: receipt.receiptsList
    ?.reduce((total, item) => total + parseFloat(item.lcAmount || 0), 0)
    .toFixed(2),
  action: "Action",
  receiptType: receipt.receiptType,
  branchCode: receipt.branchCode,
  departmentCode: receipt.departmentCode,
  currencyCode: receipt.currencyCode,
  remarks: receipt.remarks,
  policyRefId: receipt.policyRefId,
  policy: receipt.policy,
  receiptsList: receipt.receiptsList,
  receiptStatus: receipt.receiptStatus,
});

export const getReceiptsListMiddleware = createAsyncThunk(
  GET_RECEIPT_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      const response = await receiptsService.filterReceipts(payload || {});
      
      // Transform API response to match the expected format - show ALL receipts (Draft + Converted)
      const transformedData = response.data.map(toReceiptRow);

      return {
        data: transformedData,
        pagination: response.pagination
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);
export const getPaymentDetails = createAsyncThunk(
  GET_PAYMENT_DETAILS,
  async (payload, { rejectWithValue }) => {
    const data = {
      totalPayment: payload?.totalPayment,
      bankcode: payload?.bankcode,
      bankName: payload?.bankName,
      bankAccount: payload?.bankAccount,
      bankAccountName: payload?.bankAccountName,
      paymentType: payload?.paymentType,
      cardNumber: payload?.cardNumber,
    }
    try {
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getReceiptsListBySearchMiddleware = createAsyncThunk(
  GET_RECEIPT_SEARCH,
  async ({ field, value }, { rejectWithValue }) => {
    try {
      const searchParams = {
        [field]: value,
        page: 1,
        pageSize: 10
      };
      
      const response = await receiptsService.searchReceipts(searchParams);
      
      // Transform API response to match the expected format - show ALL receipts (Draft + Converted)
      const transformedData = response.data.map(toReceiptRow);

      return transformedData;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);

export const getReceiptsListByFilterMiddleware = createAsyncThunk(
  GET_RECEIPT_FILTER,
  async ({ field, value, page = 1, pageSize = 10, ...filters }, { rejectWithValue }) => {
    try {
      const filterParams = {
        ...filters,
        page,
        pageSize
      };
      
      // Add the specific filter field based on the selected dropdown option
      if (field && value) {
        filterParams[field] = value;
      }
      
      const response = await receiptsService.filterReceipts(filterParams);
      
      // Transform API response to match the expected format - show ALL receipts (Draft + Converted)
      const transformedData = response.data.map(toReceiptRow);

      return {
        data: transformedData,
        pagination: response.pagination
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);
export const getReceiptsListByIdMiddleware = createAsyncThunk(
  GET_RECEIPT_DETAILS_BY_ID,
  async (receiptId, { rejectWithValue }) => {
    try {
      const response = await receiptsService.getReceiptById(receiptId);
      
      // Transform API response to match the expected format for receipt details
      const transformedData = response.data.receiptsList?.map(item => ({
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
        ewt: item.ewt,
        fcAmount: item.fcAmount,
        lcAmount: item.lcAmount,
        other: item.other,
        status: item.status || "Pending"
      })) || [];

      return {
        receiptId: response.data.receiptId,
        receiptNumber: response.data.receiptNumber,
        clientEmail: response.data.clientEmail || null,
        receiptStatus: response.data.receiptStatus || null,
        header: {
          receiptDate: response.data.receiptDate, payerName: response.data.name, customerCode: response.data.customerCode,
          paymentMode: response.data.paymentMode, referenceNo: response.data.referenceNo, amount: response.data.amount,
          currencyCode: response.data.currencyCode, transactionNumber: response.data.transactionNumber, policyNumber: response.data.policyNumber,
          cancelReason: response.data.cancelReason,
        },
        receiptDetailList: transformedData,
        paymentDetails: {
          totalPayment: response.data.receiptsList?.reduce((total, item) => total + parseFloat(item.lcAmount || 0), 0).toFixed(2),
          bankcode: response.data.branchCode,
          bankName: response.data.branchCode, // You might want to map this to actual bank name
          bankAccount: response.data.customerCode,
          bankAccountName: response.data.name,
          paymentType: response.data.receiptType,
          cardNumber: response.data.transactionNumber
        }
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);

// New middleware to fetch full receipt details by receiptId for editing flow
export const getReceiptByIdMiddleware = createAsyncThunk(
  "receipts/GET_RECEIPT_BY_ID",
  async (receiptId, { rejectWithValue }) => {
    try {
      const response = await receiptsService.getReceiptById(receiptId);
      
      // Transform API response - the full receipt with all details
      return {
        receiptId: response.data.receiptId,
        receiptNumber: response.data.receiptNumber,
        receiptType: response.data.receiptType,
        receiptDate: response.data.receiptDate,
        branchCode: response.data.branchCode,
        departmentCode: response.data.departmentCode,
        customerCode: response.data.customerCode,
        currencyCode: response.data.currencyCode,
        transactionCode: response.data.transactionCode,
        remarks: response.data.remarks,
        transactionNumber: response.data.transactionNumber,
        name: response.data.name,
        policyRefId: response.data.policyRefId,
        policyNumber: response.data.policyNumber,
        receiptStatus: response.data.receiptStatus,
        policy: response.data.policy,
        receiptsList: response.data.receiptsList?.map(item => ({
          receiptListId: item.receiptListId,
          policies: item.policies,
          netPremium: item.netPremium,
          paid: item.paid,
          unPaid: item.unPaid,
          discounts: item.discounts,
          dst: item.dst,
          lgt: item.lgt,
          vat: item.vat,
          ewt: item.ewt,
          status: item.status || "Pending",
          fcAmount: item.fcAmount,
          lcAmount: item.lcAmount,
          other: item.other
        })) || []
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);
export const getReceiptsReceivableMiddleware = createAsyncThunk(
  GET_RECEIVABLE_TABLE,
  async (payload, { rejectWithValue, getState }) => {
    const { receivableTableReducers } = getState();
    const { receivableTableList } = receivableTableReducers;
    const filteredData = receivableTableList.filter((item) => item.id === 1);
    try {
      return filteredData[0];
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
const optionCode = (value) => value?.code ?? value ?? undefined;

const toIsoDate = (value) =>
  value instanceof Date ? value.toISOString() : value || undefined;

export const postAddReceiptsMiddleware = createAsyncThunk(
  POST_ADD_RECEIPTS,
  async (payload, { rejectWithValue }) => {
    try {
      const response = await receiptsService.createReceipt({
        customerCode: optionCode(payload?.customerCode),
        receiptDate: toIsoDate(payload?.receiptDate),
        receiptType: optionCode(payload?.receiptType),
        transactionCode: optionCode(payload?.transactionCode),
        remarks: payload?.remarks,
        policyRefId: optionCode(payload?.policyRefId),
        receiptsList: payload?.receiptsList,
      });
      return toReceiptRow(response.data);
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error.message
      );
    }
  }
);
export const postPaymentDetailsMiddleware = createAsyncThunk(
  POST_PAYMENT_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchReceipEditMiddleware = createAsyncThunk(
  PATCH_RECEIPT_EDIT,

  async (payload, { rejectWithValue, getState }) => {
    const { receiptsTableReducers } = getState();
    const { receivableTableList } = receiptsTableReducers;

    // Check if this is a NEW entry (created via "+ Add Payment" button)
    const isNewEntry = String(payload?.id).startsWith('new-');
    
    if (isNewEntry) {
      // NEW PAYMENT ENTRY - Always ADD as new row
      
      const newEntry = {
        id: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        receiptListId: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        policies: payload?.policy,
        netPremium: payload?.netPremium || "0.00",
        paid: payload?.paid || "0.00",
        unPaid: payload?.unPaid || "0.00",
        discounts: payload.discounts || "0.00",
        dst: payload.dst || "0.00",
        lgt: payload.lgt || "0.00",
        vat: payload.vat || "0.00",
        ewt: payload.ewt || "0.00",
        other: payload.other || "0.00",
        fcAmount: payload.fcAmount || "0.00",
        lcAmount: payload.lcAmount || "0.00",
        status: "Pending"
      };
      
      const updatedList = [...receivableTableList, newEntry];

      return updatedList;
      
    } else {
      // EDITING EXISTING ENTRY - Always UPDATE (UI already handles disabling paid entries)
      const existingItem = receivableTableList.find(item => 
        item.id === payload?.id || item.id === String(payload?.id)
      );
      
      if (!existingItem) {
        logger.warn("[PATCH MIDDLEWARE] Item not found:", payload?.id);
        return receivableTableList;
      }

      // UPDATE existing row
      const updateTable = receivableTableList.map((item) => {
        if (item.id === payload?.id || item.id === String(payload?.id)) {
          return {
            ...item,
            policies: payload?.policy,
            netPremium: payload?.netPremium,
            paid: payload?.paid,
            unPaid: payload?.unPaid,
            discounts: payload.discounts,
            dst: payload.dst,
            lgt: payload.lgt,
            vat: payload.vat,
            other: payload.other,
            fcAmount: payload.fcAmount,
            lcAmount: payload.lcAmount,
            status: item.status || "Pending"
          };
        }
        return item;
      });
      
      return updateTable;
    }
  }
);

export const createReceiptMiddleware = createAsyncThunk(
  POST_CREATE_RECEIPT,
  async (receiptData, { rejectWithValue }) => {
    try {
      const response = await receiptsService.createReceipt(receiptData);
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);

export const getDraftReceiptsMiddleware = createAsyncThunk(
  GET_DRAFT_RECEIPTS,
  async (payload, { rejectWithValue }) => {
    try {
      const { pageSize = 500 } = payload || {};
      const response = await receiptsService.getDraftReceipts(pageSize);
      
      // Filter for Draft receipts only and transform for dropdown use
      const draftReceipts = response.data
        .filter(receipt => receipt.receiptStatus === "Draft")
        .map(receipt => ({
          customerCode: receipt.customerCode,
          customerName: receipt.name,
          policyNumber: receipt.policyNumber,
          receiptId: receipt.receiptId,
          receiptNumber: receipt.receiptNumber,
          receiptStatus: receipt.receiptStatus,
          policyRefId: receipt.policyRefId // Include the actual policy reference ID
        }));

      return draftReceipts;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);

export const updateReceiptMiddleware = createAsyncThunk(
  UPDATE_RECEIPT,
  async ({ receiptId, receiptData }, { rejectWithValue }) => {
    try {
      const response = await receiptsService.updateReceipt(receiptId, receiptData);
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);

export const bulkPrintReceiptsMiddleware = createAsyncThunk(
  'receipts/bulkPrint',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await receiptsService.bulkPrintReceipts(filters);
      
      if (response.success) {
        return response; // Return the full response for success cases
      } else {
        return rejectWithValue(response); // Pass the full response for error handling
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);

export const printReceiptMiddleware = createAsyncThunk(
  'receipts/printReceipt',
  async (printData, { rejectWithValue }) => {
    try {
      const response = await receiptsService.printReceipt(printData);
      
      if (response.success) {
        return response; // Return the full response for success cases
      } else {
        return rejectWithValue(response); // Pass the full response for error handling
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message || error.message);
    }
  }
);