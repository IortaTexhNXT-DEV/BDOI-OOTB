import { createSlice } from "@reduxjs/toolkit";
import {
  getReceiptListMiddleware,
  getReceiptSearchMiddleware,
  postAddReceiptMiddleware,
  getAddReceiptTableMiddleware,
  getViewReceiptMiddleware,
} from "./pettyCashReceiptsMiddleware";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
const initialState = {
  loading: false,
  error: "",
  ReceiptList: [
    {
      id: 1,
      ReceiptNo: "10100198",
      RequesterName: "Leo",
      Branchcode: "Branch00192",
      Transactioncode: "Trans00123",
      BankCode: "Bank00123",
      SubAccount: "Sub00123",
      TransactionNumber: "Trans10229",
      Date: "21/12/2023",
    },
    {
      id: 2,
      ReceiptNo: "20988123",
      RequesterName: "Alice",
      Branchcode: "Branch00987",
      Transactioncode: "Trans00567",
      BankCode: "Bank00892",
      SubAccount: "Sub00321",
      TransactionNumber: "Trans45231",
      Date: "15/11/2023",
    },
    {
      id: 3,
      ReceiptNo: "10987234",
      RequesterName: "Bob",
      Branchcode: "Branch00765",
      Transactioncode: "Trans00321",
      BankCode: "Bank00765",
      SubAccount: "Sub00890",
      TransactionNumber: "Trans90231",
      Date: "04/10/2023",
    },
    {
      id: 4,
      ReceiptNo: "30987122",
      RequesterName: "Emma",
      Branchcode: "Branch00456",
      Transactioncode: "Trans00981",
      BankCode: "Bank00566",
      SubAccount: "Sub00212",
      TransactionNumber: "Trans67431",
      Date: "19/09/2023",
    },
    {
      id: 5,
      ReceiptNo: "20987432",
      RequesterName: "David",
      Branchcode: "Branch00345",
      Transactioncode: "Trans00876",
      BankCode: "Bank00321",
      SubAccount: "Sub00453",
      TransactionNumber: "Trans80976",
      Date: "26/08/2023",
    },
    {
      id: 6,
      ReceiptNo: "40987001",
      RequesterName: "Sophia",
      Branchcode: "Branch00234",
      Transactioncode: "Trans00654",
      BankCode: "Bank00210",
      SubAccount: "Sub00678",
      TransactionNumber: "Trans50123",
      Date: "11/07/2023",
    },
    {
      id: 7,
      ReceiptNo: "50987654",
      RequesterName: "Oliver",
      Branchcode: "Branch00543",
      Transactioncode: "Trans00432",
      BankCode: "Bank00987",
      SubAccount: "Sub00543",
      TransactionNumber: "Trans21456",
      Date: "01/06/2023",
    },
    {
      id: 8,
      ReceiptNo: "30987200",
      RequesterName: "Mia",
      Branchcode: "Branch00678",
      Transactioncode: "Trans00243",
      BankCode: "Bank00678",
      SubAccount: "Sub00789",
      TransactionNumber: "Trans34123",
      Date: "18/05/2023",
    },
    {
      id: 9,
      ReceiptNo: "70987122",
      RequesterName: "Ethan",
      Branchcode: "Branch00876",
      Transactioncode: "Trans00765",
      BankCode: "Bank00456",
      SubAccount: "Sub00234",
      TransactionNumber: "Trans78321",
      Date: "03/04/2023",
    },
    {
      id: 10,
      ReceiptNo: "20987654",
      RequesterName: "Ava",
      Branchcode: "Branch00567",
      Transactioncode: "Trans00433",
      BankCode: "Bank00345",
      SubAccount: "Sub00567",
      TransactionNumber: "Trans23156",
      Date: "27/03/2023",
    },
  ],
  ReceiptSearch: [],
  AddReceipt: {},
  AddReceiptTable: [
    {
      id: 1,
      TransactionCode: "Trans00433",
      RequestNumber: "20987654",
      Date: "27/03/2023",
      Amount: "100",
      Remarks: "Remarks",
    },
    {
      id: 2,
      TransactionCode: "Trans00222",
      RequestNumber: "20980000",
      Date: "15/02/2023",
      Amount: "150",
      Remarks: "Remarks",
    },
    {
      id: 3,
      TransactionCode: "Trans00987",
      RequestNumber: "20988888",
      Date: "03/01/2023",
      Amount: "200",
      Remarks: "Remarks",
    },
    {
      id: 4,
      TransactionCode: "Trans00666",
      RequestNumber: "20985555",
      Date: "10/04/2023",
      Amount: "75",
      Remarks: "Remarks",
    },
    {
      id: 5,
      TransactionCode: "Trans00333",
      RequestNumber: "20982222",
      Date: "20/05/2023",
      Amount: "120",
      Remarks: "Remarks",
    },
  ],
  ViewReceipt: {},
};
const PettyCashReceiptsReducer = createSlice({
  name: "pettycashreceipts",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getReceiptListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReceiptListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.ReceiptList = action.payload;
    });
    builder.addCase(getReceiptListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.ReceiptList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //RequestSearch

    builder.addCase(getReceiptSearchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReceiptSearchMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.ReceiptSearch = action.payload;
    });
    builder.addCase(getReceiptSearchMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.ReceiptSearch = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // AddReceipt

    builder.addCase(postAddReceiptMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddReceiptMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // state.AddRequest = action.payload;
      state.ReceiptList = [...state.ReceiptList, action.payload];
    });
    builder.addCase(postAddReceiptMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.AddRequest = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AddReceiptTable

    builder.addCase(getAddReceiptTableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getAddReceiptTableMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.AddReceiptTable = action.payload;
    });
    builder.addCase(getAddReceiptTableMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.AddReceiptTable = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //ViewReceipt

    builder.addCase(getViewReceiptMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getViewReceiptMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.ViewReceipt = action.payload;
    });
    builder.addCase(getViewReceiptMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.ViewReceipt = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default PettyCashReceiptsReducer.reducer;
