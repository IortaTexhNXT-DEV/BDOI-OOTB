import { createSlice } from "@reduxjs/toolkit";
import {
  getRequestListMiddleware,
  getRequestSearchMiddleware,
  postAddRequestMiddleware,
  getAddRequestTableMiddleware,
  postEditRequestMiddleware, geteditrequestMiddleware, patchupdateRequestMiddleware
} from "./pettyCashRequestMiddleware";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
const initialState = {
  loading: false,
  error: "",
  RequestList: [
    {
      id: 1,
      PettycashCode: "PCC0123",
      TransactionNumber: "10000",
      RequesterName: "Shanmu",
      RequestDate: "Branch00123",
      Departmentcode: "Depart00123",
      TotalAmount: "10,000",
      Date: "21/12/2023",
    },
    {
      id: 2,
      PettycashCode: "PCC0456",
      TransactionNumber: "20000",
      RequesterName: "Mani",
      RequestDate: "Branch00456",
      Departmentcode: "Depart00456",
      TotalAmount: "10,000",
      Date: "15/11/2023",
    },
    {
      id: 3,
      PettycashCode: "PCC0789",
      TransactionNumber: "30000",
      RequesterName: "Ayisha",
      RequestDate: "Branch00789",
      Departmentcode: "Depart00789",
      TotalAmount: "10,000",
      Date: "10/10/2023",
    },
    {
      id: 4,
      PettycashCode: "PCC0987",
      TransactionNumber: "40000",
      RequesterName: "Sindhu",
      RequestDate: "Branch00987",
      Departmentcode: "Depart00987",
      TotalAmount: "10,000",
      Date: "05/09/2023",
    },
    {
      id: 5,
      PettycashCode: "PCC0123",
      TransactionNumber: "50000",
      RequesterName: "Pandi",
      RequestDate: "Branch00567",
      Departmentcode: "Depart00567",
      TotalAmount: "10,000",
      Date: "01/08/2023",
    },
    {
      id: 6,
      PettycashCode: "PCC0345",
      TransactionNumber: "60000",
      RequesterName: "Yuva",
      RequestDate: "Branch00678",
      Departmentcode: "Depart00678",
      TotalAmount: "10,000",
      Date: "25/07/2023",
    },
    {
      id: 7,
      PettycashCode: "PCC0567",
      TransactionNumber: "70000",
      RequesterName: "Uttam",
      RequestDate: "Branch00234",
      Departmentcode: "Depart00234",
      TotalAmount: "10,000",
      Date: "20/06/2023",
    },
    {
      id: 8,
      PettycashCode: "PCC0789",
      TransactionNumber: "80000",
      RequesterName: "Justin",
      RequestDate: "Branch00890",
      Departmentcode: "Depart00890",
      TotalAmount: "10,000",
      Date: "15/05/2023",
    },
    {
      id: 9,
      PettycashCode: "PCC0901",
      TransactionNumber: "90000",
      RequesterName: "Manoj Kumar",
      RequestDate: "Branch00345",
      Departmentcode: "Depart00345",
      TotalAmount: "10,000",
      Date: "10/04/2023",
    },
    {
      id: 10,
      PettycashCode: "PCC0101",
      TransactionNumber: "100000",
      RequesterName: "Leo",
      RequestDate: "Branch00101",
      Departmentcode: "Depart00101",
      TotalAmount: "10,000",
      Date: "05/03/2023",
    },
  ],
  RequestSearch: [],
  AddRequest: {},
  AddRequestTable: [
    {
      id: 1,
      Narration: "PCC0123",
      Amount: "10000",

    },
  ],
  EditRequest: {},
  editrequestDetails: []
};
const PettyCashRequestReducer = createSlice({
  name: "pettycashrequest",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getRequestListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getRequestListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.RequestList = action.payload;
    });
    builder.addCase(getRequestListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.RequestList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //RequestSearch

    builder.addCase(getRequestSearchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getRequestSearchMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.RequestSearch = action.payload;
    });
    builder.addCase(getRequestSearchMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.DisbursmentSearch = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // AddRequest

    builder.addCase(postAddRequestMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddRequestMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // state.AddRequest = action.payload;
      state.RequestList = [...state.RequestList, action.payload];
    });
    builder.addCase(postAddRequestMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.AddRequest = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AddRequestTable

    builder.addCase(getAddRequestTableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getAddRequestTableMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.AddRequestTable = action.payload;
    });
    builder.addCase(getAddRequestTableMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.AddRequestTable = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //EditRequest

    builder.addCase(postEditRequestMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postEditRequestMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // state.EditRequest = action.payload;
      state.AddRequestTable = [...state.AddRequestTable, action.payload];
    });
    builder.addCase(postEditRequestMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.EditRequest = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //geteditrequestMiddleware 

    builder.addCase(geteditrequestMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(geteditrequestMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.editrequestDetails = action.payload;
    });
    builder.addCase(geteditrequestMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.InitiateDetails = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //patchdatarquest 
    builder.addCase(patchupdateRequestMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(patchupdateRequestMiddleware.fulfilled, (state, action) => {
      console.log("first99", state, action)
      state.loading = false;
      state.RequestList = action.payload;

    });
    builder.addCase(patchupdateRequestMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.RequestList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default PettyCashRequestReducer.reducer;
