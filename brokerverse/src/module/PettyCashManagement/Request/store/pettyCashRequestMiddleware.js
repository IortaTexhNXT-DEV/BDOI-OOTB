import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_REQUEST_VOUCHER_LIST,
  GET_REQUEST_VOUCHER_SEARCH,
  POST_ADD_REQUEST_VOUCHER,
  GET_ADD_REQUEST_TABLE_VOUCHER,
  POST_EDIT_REQUEST_VOUCHER, GET_EDIT_REQUEST, POST_UPDATE_REQUEST_VOUCHER, PATCH_UPDATE_COMPANYDATA
} from "../../../../redux/actionTypes";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";

export const getRequestListMiddleware = createAsyncThunk(
  GET_REQUEST_VOUCHER_LIST,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getRequestSearchMiddleware = createAsyncThunk(
  GET_REQUEST_VOUCHER_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { pettyCashRequestReducer } = getState();
    const { RequestList } = pettyCashRequestReducer;
    function filterReceiptsByField(receipts, field, value) {
      const lowercasedValue = value.toLowerCase();
      return receipts.filter(receipt => receipt[field].toLowerCase().startsWith(lowercasedValue));
    }
    try {
      const filteredReceipts = filterReceiptsByField(RequestList, field, value);

      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return filteredReceipts;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postAddRequestMiddleware = createAsyncThunk(
  POST_ADD_REQUEST_VOUCHER,
  async (payload, { rejectWithValue }) => {
    const currentDate = new Date();
    const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
    const formattedtransDate = `${payload.RequestDate.getDate()}/${payload.RequestDate.getMonth() + 1}/${payload.RequestDate.getFullYear()}`;
    const randomTotalAmount = Math.floor(Math.random() * 50000) + 10000;
    console.log("first4", payload)
    const TableData = {
      id: payload?.id,
      // PettycashCode: payload.PettyCashCode.pettycashcode,
      RequestNumber: payload.Requestnumber,
      RequesterName: payload.RequesterName.Name,
      // Branchcode: payload.BranchCode.Branchcode,
      // Departmentcode: payload.DepartmentCode.Departcode,
      TotalAmount: randomTotalAmount.toString(),
      Date: formattedDate,
      RequestDate: formattedtransDate,
      TransactionNumber: "203456",

    };
    try {
      console.log("first8", TableData)
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return TableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);



// export const patchupdateRequestMiddleware = createAsyncThunk(
//   POST_UPDATE_REQUEST_VOUCHER,
//   async (payload, { rejectWithValue, getState }) => {
//     const currentDate = new Date();
// const formattedDate = `${payload?.Date.getDate()}/${payload?.Date.getMonth() + 1}/${payload?.Date.getFullYear()}`;
// const formattedtransDate = `${payload?.RequestDate.getDate()}/${payload?.RequestDate.getMonth() + 1}/${payload?.RequestDate.getFullYear()}`;
// // const randomTotalAmount = Math.floor(Math.random() * 50000) + 10000;
// console.log("firt4", payload)

//     const { PettyCashRequestReducer } = getState();
//     const { RequestList } = PettyCashRequestReducer;

//     console.log(RequestList, "qwerty")
//     const TableData = RequestList?.map((item) => {
//       if (parseInt(item.id) === parseInt(payload?.id)) {
//         return {
//           id: payload?.id,
//           PettycashCode: "PCC0123",
//           TransactionNumber: payload?.TransactionNumber,
//           RequesterName: payload?.RequesterName,
//           RequestDate: formattedtransDate,
//           Departmentcode: "Depart00123",
//           TotalAmount: payload?.TotalAmount,
//           Date: formattedDate,
//         };
//       }
//       return item;
//     });

//     // const TableData = {
//     //   id: payload?.id,
//     //   PettycashCode: "PCC0123",
//     //   TransactionNumber: payload?.TransactionNumber,
//     //   RequesterName: payload?.RequesterName,
//     //   RequestDate: formattedtransDate,
//     //   Departmentcode: "Depart00123",
//     //   TotalAmount: payload?.TotalAmount,
//     //   Date: formattedDate,
//     // };
//     try {
//       console.log("first8", TableData)
//       // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
//       return TableData;
//     } catch (error) {
//       return rejectWithValue(error?.response.data.error.message);
//     }
//   }
// );


export const patchupdateRequestMiddleware = createAsyncThunk(
  PATCH_UPDATE_COMPANYDATA,
  async (payload, { rejectWithValue, getState }) => {

    const formattedDate = `${payload?.Date.getDate()}/${payload?.Date.getMonth() + 1}/${payload?.Date.getFullYear()}`;
    const formattedtransDate = `${payload?.RequestDate.getDate()}/${payload?.RequestDate.getMonth() + 1}/${payload?.RequestDate.getFullYear()}`;
    // const randomTotalAmount = Math.floor(Math.random() * 50000) + 10000;
    console.log("firt4", payload)

    const { pettyCashRequestReducer } = getState();
    const { RequestList } = pettyCashRequestReducer;

    console.log(RequestList, "qwerty")



    try {
      const TableData = RequestList?.map((item) => {
        if (parseInt(item.id) === parseInt(payload?.id)) {
          return {
            id: payload?.id,
            PettycashCode: "PCC0123",
            TransactionNumber: payload?.TransactionNumber,
            RequesterName: payload?.RequesterName,
            RequestDate: formattedtransDate,
            Departmentcode: "Depart00123",
            TotalAmount: payload?.TotalAmount,
            Date: formattedDate,
          };
        }
        return item;
      });
      return TableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);





export const getAddRequestTableMiddleware = createAsyncThunk(
  GET_ADD_REQUEST_TABLE_VOUCHER,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postEditRequestMiddleware = createAsyncThunk(
  POST_EDIT_REQUEST_VOUCHER,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "Edit")
    const datatable = {
      Narration: payload?.Narration,
      Amount: payload?.Amount
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return datatable;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const geteditrequestMiddleware = createAsyncThunk(
  GET_EDIT_REQUEST,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      console.log("first1", payload)
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);