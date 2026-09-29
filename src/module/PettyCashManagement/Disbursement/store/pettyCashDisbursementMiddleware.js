import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_DISBURSMENT_VOUCHER_LIST,
  GET_DISBURSMENT_VOUCHER_SEARCH,
  POST_ADD_DISBURSMENT_VOUCHER,
  GET_ADD_DISBURSMENT_TABLE_VOUCHER,
  POST_EDIT_DISBURSMENT_VOUCHER,
  GET_VIEW_DISBURSMENT_VOUCHER,
  GET_ADD_DISBURSMENT_REQUEST_TABLE_VOUCHER,
  GET_DISBURSMENT_REQUEST_PATCH_DATA,
  POST_DISBURSMENT_REQUEST_PATCH_DATA,
  POST_DISBURSMENT_REQUEST,
  GET_DISBURSMENT_VIEW_DATA,
} from "../../../../redux/actionTypes";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";

export const getDisbursmentListMiddleware = createAsyncThunk(
  GET_DISBURSMENT_VOUCHER_LIST,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

// export const getDisbursmentSearchMiddleware = createAsyncThunk(
//   GET_DISBURSMENT_VOUCHER_SEARCH,
//   async ({ field, value }, { rejectWithValue, getState }) => {
//     const { pettyCashDisbursementReducers } = getState();
//     const { DisbursmentList } = pettyCashDisbursementReducers;
//     function filterReceiptsByField(receipts, field, value) {
//       const lowercasedValue = value.toLowerCase();
//       return receipts.filter((receipt) =>
//         receipt[field].toLowerCase().startsWith(lowercasedValue)
//       );
//     }
//     try {
//       const filteredReceipts = filterReceiptsByField(
//         DisbursmentList,
//         field,
//         value
//       );

//       // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
//       return filteredReceipts;
//     } catch (error) {
//       return rejectWithValue(error?.response.data.error.message);
//     }
//   }
// );

export const getDisbursmentSearchMiddleware = createAsyncThunk(
  GET_DISBURSMENT_VOUCHER_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "kkkk");
    const { pettyCashDisbursementReducers } = getState();
    const { DisbursmentList } = pettyCashDisbursementReducers;
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter(item => {
        if (field === "Pettycash Code") {

          return item?.PettyCashCode.toLowerCase().includes(lowercasedValue);
        }
        if (field === "Transaction code") {
          return item.TransactionCode.toLowerCase().includes(lowercasedValue);
        }
          if (field === "Transaction Number") {
          return item.TransactionCode.toLowerCase().includes(lowercasedValue);
        }
        return (
          (item?.PettyCashCode.toLowerCase().includes(lowercasedValue)
            ||
            item.TransactionCode.toLowerCase().includes(lowercasedValue)||
            item.TransactionNumber.toLowerCase().includes(lowercasedValue)
            )
        );


      });
      return outputData
    }
    try {
      const filteredPayments = filterPaymentsByField(DisbursmentList, field, value);
      console.log(filteredPayments, "filteredPayments");
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const postAddDisbursmentMiddleware = createAsyncThunk(
  POST_ADD_DISBURSMENT_VOUCHER,
  async (payload, { rejectWithValue }) => {


    const currentDate = new Date();
    const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1
      }/${currentDate.getFullYear()}`;
    const randomTotalAmount = Math.floor(Math.random() * 50000) + 10000;
    console.log(formattedDate, "postdisbursment");
    const TableData = {
      id: payload?.id,
      PettyCashCode: payload?.PettyCashCode,
      Date: formattedDate,
      TransactionCode: randomTotalAmount.toString(),
      TransactionNumber: randomTotalAmount.toString(),
      Criteria: payload?.Criteria,
      VATMainAccount: payload?.VATMainAccount,
      VATSubAccount: payload?.VATSubAccount,
      WHTMainAccount: payload?.WHTMainAccount,
      WHTSubAccount: payload?.WHTSubAccount,
      Remarks: payload?.Remarks,
    };

    try {
      console.log(TableData, "TableData");
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return TableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAddDisbursmentTableMiddleware = createAsyncThunk(
  GET_ADD_DISBURSMENT_TABLE_VOUCHER,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const getAddDisbursmentRequestListTableMiddleware = createAsyncThunk(
  GET_ADD_DISBURSMENT_REQUEST_TABLE_VOUCHER,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postEditDisbursmentMiddleware = createAsyncThunk(
  POST_EDIT_DISBURSMENT_VOUCHER,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    const VATin = (payload.VAT / 100) * 100;
    const EWTin = (payload.EWT / 100) * 100;
    const TotalAmount = parseFloat(payload?.TotalAmount) || 0;
    const EWTinAdd = parseFloat(EWTin) || 0;
    const VATinAdd = parseFloat(VATin) || 0;
    const Totalin = TotalAmount + EWTinAdd + VATinAdd;
    const TableData = {
      id: payload?.id,
      RequestNumber: payload.RequestNumber,
      RequesterName: payload.Requester,
      Amount: payload.Amount,
      VAT: VATin,
      EWT: EWTin,
      MainAccount: payload.MainAccountCode.Maincode,
      SubAccount: payload?.SubAccountCode?.SubAccount,
      TotalAmount: Totalin,
      Remarks: payload.Remarks,
    };
    console.log(TableData, "TableData");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return TableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getViewDisbursmentMiddleware = createAsyncThunk(
  GET_VIEW_DISBURSMENT_VOUCHER,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const getPatchDisbursementData = createAsyncThunk(
  GET_DISBURSMENT_REQUEST_PATCH_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postDisbursementData = createAsyncThunk(
  POST_DISBURSMENT_REQUEST,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    const data = {
      id: payload?.id,
      PettycashCode: payload?.PettycashCode,
      RequestNumber: payload?.RequestNumber,
      RequesterName: payload?.RequesterName,
      SubAc: payload?.SubAc,
      ExpenseCode: payload?.ExpenseCode,
      Purpose: payload?.Purpose,
      Remarks: payload?.Remarks,
      Amount: payload?.Amount,
      VAT: payload?.VAT,
      WHT: payload?.WHT,
      NetAmount: payload?.NetAmount,
      Branchcode: payload?.Branchcode,
      Departmentcode: payload?.Departmentcode,
      TotalAmount: payload?.TotalAmount,
      Date: payload?.Date,
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postPatchDisbursementData = createAsyncThunk(
  POST_DISBURSMENT_REQUEST_PATCH_DATA,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    const data = {
      id: payload?.id,
      PettycashCode: payload?.PettycashCode,
      RequestNumber: payload?.RequestNumber,
      RequesterName: payload?.RequesterName,
      SubAc: payload?.SubAc,
      ExpenseCode: payload?.ExpenseCode,
      Purpose: payload?.Purpose,
      Remarks: payload?.Remarks,
      Amount: payload?.Amount,
      VAT: payload?.VAT,
      WHT: payload?.WHT,
      NetAmount: payload?.NetAmount,
      Branchcode: payload?.Branchcode,
      Departmentcode: payload?.Departmentcode,
      TotalAmount: payload?.TotalAmount,
      Date: payload?.Date,
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getDisbursmentViewMiddleware = createAsyncThunk(
  GET_DISBURSMENT_VIEW_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);