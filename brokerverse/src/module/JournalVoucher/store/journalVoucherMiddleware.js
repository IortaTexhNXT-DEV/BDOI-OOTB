import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest, postRequest } from "../../../utility/commonServices";
import { APIROUTES } from "../../../routes/apiRoutes";
import {
  GET_JOURNAL_VOUCHER,
  GET_JOURNAL_VOUCHER_SEARCH_LIST,
  GET_JOURNAL_VOUCHER_VIEW,
  GET_POST_TABEL_JOURNAL_VOUCHER,
  PATCH_JOURNAL_VOUCHER_EDIT,
  POST_ADD_JOURNAL_VOUCHER,
  POST_APPROVE_JOURNAL_VOUCHER,
  POST_JOURNAL_VOUCHER,
  GET_JOURNAL_VOUCHER_HISTORY,
  GET_JOURNAL_VOUCHER_DETAILS,
} from "../../../redux/actionTypes";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";

export const journalVoucherMiddleware = createAsyncThunk(
  GET_JOURNAL_VOUCHER,
  async (payload, { rejectWithValue, getState }) => {
    const { journalVoucherMainReducers } = getState();
    const { journalVoucherList } = journalVoucherMainReducers;
    const filteredData = journalVoucherList.filter((item) => item.id === 1);
    try {
      return filteredData[0];
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getJournalVoucherSearchList = createAsyncThunk(
  GET_JOURNAL_VOUCHER_SEARCH_LIST,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { journalVoucherMainReducers } = getState();
    const { journalVoucherList } = journalVoucherMainReducers;

    function filterReceiptsByField(receipts, field, value) {
      const lowercasedValue = value.toLowerCase();
      return receipts.filter((receipt) =>
        receipt[field].toLowerCase().startsWith(lowercasedValue)
      );
    }
    try {
      const filteredReceipts = filterReceiptsByField(
        journalVoucherList,
        field,
        value
      );

      return filteredReceipts;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postTCJournalVoucher = createAsyncThunk(
  POST_JOURNAL_VOUCHER,
  async (payload, { rejectWithValue, getState }) => {
    let bodyTableData = {
      transationCode: payload?.transationCode,
      totalCredit: payload?.totalCredit,
      totalDebit: payload?.totalDebit,
      transationDescription: payload?.transationDescription,
      date: payload?.date.toLocaleDateString("en-US", {
        month: "numeric",
        day: "2-digit",
        year: "numeric",
      }),
    };
    try {
      return bodyTableData;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const patchJVMiddleware = createAsyncThunk(
  PATCH_JOURNAL_VOUCHER_EDIT,
  async (payload, { rejectWithValue, getState }) => {
    const { journalVoucherMainReducers } = getState();
    const { journalVoucherPostTabelData } = journalVoucherMainReducers;
    try {
      const editData = journalVoucherPostTabelData?.map((item) => {
        if (item.id === parseInt(payload?.id)) {
          return {
            ...item,
            mainAccount: payload?.mainAccount,
            subAccount: payload?.subAccount,
            branchCode: payload?.branchCode,
            localAmount: payload?.localAmount || item.localAmount,
            currencyCode: payload?.currencyCode,
            foreignAmount: payload?.foreignAmount,
            entryType: payload?.entryType,
            mainAccountDescription: payload?.mainAccountDescription,
            subAccountDescription: payload?.subAccountDescription,
            branchCodeDescription: payload?.branchCodeDescription,
            departmentDescription: payload?.departmentDescription,
            currencyDescription: payload?.currencyDescription,
          };
        }
        return item;
      });
      return editData;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message || "An error occurred"
      );
    }
  }
);

export const getJournalVoucherViewData = createAsyncThunk(
  GET_JOURNAL_VOUCHER_VIEW,
  async (payload, { rejectWithValue, getState }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const journalVoucherPostTabel = createAsyncThunk(
  GET_POST_TABEL_JOURNAL_VOUCHER,
  async (payload, { rejectWithValue, getState }) => {
    const { journalVoucherMainReducers } = getState();
    const { journalVoucherPostTabelData } = journalVoucherMainReducers;

    const newData = payload;
    try {
      const updatedList = [...journalVoucherPostTabelData, newData];
      return updatedList;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postAddJournalVoucher = createAsyncThunk(
  POST_ADD_JOURNAL_VOUCHER,
  async (payload, { rejectWithValue, getState }) => {
    let bodyTableData = {
      mainAccount: payload?.mainAccount,
      subAccount: payload?.subAccount,
      branchCode: payload?.branchCode,
      currencyCode: payload?.currencyCode,
      foreignAmount: payload?.foreignAmount,
      entryType: payload?.entryType,
      Remarks: payload?.remarks,
      localAmount: payload?.localAmount || "",
      departmentCode: payload?.departmentCode,
      mainAccountDescription: payload?.mainAccountDescription,
      subAccountDescription: payload?.subAccountDescription,
      branchCodeDescription: payload?.branchCodeDescription,
      departmentDescription: payload?.departmentDescription,
      currencyDescription: payload?.currencyDescription,
    };
    try {
      return bodyTableData;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const postApproveJournalVoucher = createAsyncThunk(
  POST_APPROVE_JOURNAL_VOUCHER,
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { data } = await postRequest(
        APIROUTES.JOURNALVOUCHER.POST_APPROVE_JOURNAL_VOUCHER,
        payload
      );
      return data;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message ||
          error?.message ||
          "An error occurred"
      );
    }
  }
);

export const getJournalVoucherHistory = createAsyncThunk(
  GET_JOURNAL_VOUCHER_HISTORY,
  async (payload = {}, { rejectWithValue }) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        transactionCode,
        transactionNumber,
      } = payload;

      // Build query parameters
      const params = {
        page,
        pageSize,
      };

      if (transactionCode) {
        params.transactionCode = transactionCode;
      }
      if (transactionNumber) {
        params.transactionNumber = transactionNumber;
      }

      const response = await getRequest(
        APIROUTES.JOURNALVOUCHER.GET_JOURNAL_VOUCHER_HISTORY,
        params
      );

      // Extract data from axios response
      const apiData = response?.data || {};

      // Map the API response to match the table format
      const mappedData = (apiData?.data || []).map((item, index) => {
        // Format date if it exists
        let formattedDate = "";
        const dateValue = item.date || item.createdAt || item.voucherDate || item.transactionDate;
        if (dateValue) {
          try {
            const dateObj = new Date(dateValue);
            if (!isNaN(dateObj.getTime())) {
              formattedDate = formatAppDate(dateObj);
            } else {
              formattedDate = dateValue;
            }
          } catch (e) {
            formattedDate = dateValue;
          }
        }

        return {
          id: item.id || item.journalVoucherId || item.transactionNumber || `jv-${index}`,
          transationCode: item.transactionCode,
          transactionNumber: item.transactionNumber,
          totalDebit: item.totalDebit,
          totalCredit: item.totalCredit,
          transationDescription: item.transactionDescription || item.description || "",
          date: formattedDate,
          status: item.status || "",
        };
      });

      // Extract pagination from API response
      const paginationData = apiData?.pagination || {};
      
      return {
        data: mappedData,
        pagination: {
          page: paginationData.currentPage || page,
          pageSize: paginationData.pageSize || pageSize,
          total: paginationData.totalRecords || 0,
          totalPages: paginationData.totalPages || Math.ceil((paginationData.totalRecords || 0) / (paginationData.pageSize || pageSize)),
        },
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message ||
          error?.message ||
          "An error occurred while fetching journal voucher history"
      );
    }
  }
);

export const getJournalVoucherDetails = createAsyncThunk(
  GET_JOURNAL_VOUCHER_DETAILS,
  async (payload = {}, { rejectWithValue }) => {
    try {
      const {
        page = 1,
        pageSize = 10,
        transactionNumber,
      } = payload;

      // Build query parameters
      const params = {
        page,
        pageSize,
      };

      if (transactionNumber) {
        params.transactionNumber = transactionNumber;
      }

      const response = await getRequest(
        APIROUTES.JOURNALVOUCHER.GET_JOURNAL_VOUCHER_DETAILS,
        params
      );

      // Extract data from axios response
      const apiData = response?.data || {};

      // Map the API response to match the table format
      const mappedData = (apiData?.data || []).map((item, index) => {
        return {
          id: item.id || item.journalVoucherId || item.transactionNumber || `jv-detail-${index}`,
          mainAccount: item.mainAccount || item.mainAC || "",
          subAccount: item.subAccount || item.subAC || "",
          remarks: item.remarks || item.Remarks || "",
          currencyCode: item.currencyCode || item.Currency || "",
          foreignAmount: item.foreignAmount || item.foreign || "",
          localAmount: item.localAmount || item.local || "",
          entryType: item.entryType || item.Entry || "",
          mainAccountDescription: item.mainAccountDescription || "",
          subAccountDescription: item.subAccountDescription || "",
          branchCode: item.branchCode || "",
          branchCodeDescription: item.branchCodeDescription || "",
          departmentCode: item.departmentCode || "",
          departmentDescription: item.departmentDescription || "",
          currencyDescription: item.currencyDescription || "",
        };
      });

      // Extract pagination from API response
      const paginationData = apiData?.pagination || {};
      
      // Extract journal voucher header info if available
      const voucherInfo = apiData?.data?.[0] || apiData || {};
      
      return {
        data: mappedData,
        pagination: {
          page: paginationData.currentPage || paginationData.page || page,
          pageSize: paginationData.pageSize || pageSize,
          total: paginationData.totalRecords || paginationData.total || 0,
          totalPages: paginationData.totalPages || Math.ceil((paginationData.totalRecords || paginationData.total || 0) / (paginationData.pageSize || pageSize)),
        },
        voucherInfo: {
          transationCode: voucherInfo.transactionCode || voucherInfo.transationCode || "",
          transactionNumber: voucherInfo.transactionNumber || "",
          transactionDescription: voucherInfo.transactionDescription || voucherInfo.transationDescription || "",
          date: voucherInfo.date || voucherInfo.createdAt || voucherInfo.voucherDate || voucherInfo.transactionDate || "",
          totalCredit: voucherInfo.totalCredit || 0,
          totalDebit: voucherInfo.totalDebit || 0,
        },
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message ||
          error?.message ||
          "An error occurred while fetching journal voucher details"
      );
    }
  }
);
