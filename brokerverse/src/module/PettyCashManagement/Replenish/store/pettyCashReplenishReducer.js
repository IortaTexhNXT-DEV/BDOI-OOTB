import { createSlice } from "@reduxjs/toolkit";
import {
  getReplenishListMiddleware,
  getReplenishSearchMiddleware,
  postAddReplenishMiddleware,
  getAddReplenishTableMiddleware,
  getViewReplenishMiddleware,
} from "./pettyCashReplenishMiddleware";
const initialState = {
  loading: false,
  error: "",
  ReplenishList: [
    {
      id: 1,
      Pettycashcode: "P-87654",
      Branchcode: "Branch00567",
      Transactioncode: "Trans00433",
      BankCode: "Bank00345",
      SubAccount: "Sub00567",
      TransactionNumber: "Trans23156",
      Date: "27/03/2023",
    },
    {
      id: 2,
      Pettycashcode: "P-23456",
      Branchcode: "Branch00987",
      Transactioncode: "Trans00221",
      BankCode: "Bank00123",
      SubAccount: "Sub00987",
      TransactionNumber: "Trans56789",
      Date: "15/08/2023",
    },
    {
      id: 3,
      Pettycashcode: "P-78901",
      Branchcode: "Branch00234",
      Transactioncode: "Trans00987",
      BankCode: "Bank00567",
      SubAccount: "Sub00234",
      TransactionNumber: "Trans12345",
      Date: "04/12/2023",
    },
    {
      id: 4,
      Pettycashcode: "P-54321",
      Branchcode: "Branch00678",
      Transactioncode: "Trans00345",
      BankCode: "Bank00987",
      SubAccount: "Sub00678",
      TransactionNumber: "Trans67890",
      Date: "22/06/2023",
    },
    {
      id: 5,
      Pettycashcode: "P-98765",
      Branchcode: "Branch00456",
      Transactioncode: "Trans00876",
      BankCode: "Bank00234",
      SubAccount: "Sub00456",
      TransactionNumber: "Trans34567",
      Date: "11/10/2023",
    },
    {
      id: 6,
      Pettycashcode: "P-65432",
      Branchcode: "Branch00123",
      Transactioncode: "Trans00765",
      BankCode: "Bank00876",
      SubAccount: "Sub00123",
      TransactionNumber: "Trans45678",
      Date: "30/04/2023",
    },
    {
      id: 7,
      Pettycashcode: "P-32109",
      Branchcode: "Branch00876",
      Transactioncode: "Trans00654",
      BankCode: "Bank00345",
      SubAccount: "Sub00876",
      TransactionNumber: "Trans23456",
      Date: "19/11/2023",
    },
    {
      id: 8,
      Pettycashcode: "P-87654",
      Branchcode: "Branch00567",
      Transactioncode: "Trans00433",
      BankCode: "Bank00345",
      SubAccount: "Sub00567",
      TransactionNumber: "Trans23156",
      Date: "27/03/2023",
    },
    {
      id: 9,
      Pettycashcode: "P-45678",
      Branchcode: "Branch00765",
      Transactioncode: "Trans00567",
      BankCode: "Bank00678",
      SubAccount: "Sub00765",
      TransactionNumber: "Trans34567",
      Date: "08/09/2023",
    },
    {
      id: 10,
      Pettycashcode: "P-10987",
      Branchcode: "Branch00345",
      Transactioncode: "Trans00123",
      BankCode: "Bank00765",
      SubAccount: "Sub00345",
      TransactionNumber: "Trans78901",
      Date: "16/01/2023",
    },
  ],
  ReplenishSearch: [],
  AddReplenish: {},
  AddReplenishTable: [
    {
      id: 1,
      Transactioncode: "Trans00123",
      RequestNumber: "00765",
      MainAccount: "Main00765",
      Transactioncode: "Trans00123",
      SubAccount: "Sub00345",
      Date: "16/01/2023",
      Amount: "100",
      Remarks: "Remarks",
      DocNumber: "0123456",
      Narration: "Lorem ipsum",
    },
    {
      id: 2,
      Transactioncode: "Trans00123",
      RequestNumber: "00456",
      MainAccount: "Main00456",
      SubAccount: "Sub00987",
      Date: "22/05/2023",
      Amount: "75",
      Remarks: "Remarks",
      DocNumber: "0123456",
      Narration: "Lorem ipsum",
    },
    {
      id: 3,
      Transactioncode: "Trans00123",
      RequestNumber: "00234",
      MainAccount: "Main00234",
      SubAccount: "Sub00567",
      Date: "11/11/2023",
      Amount: "150",
      Remarks: "Remarks",
      DocNumber: "0123456",
      Narration: "Lorem ipsum",
    },
    {
      id: 4,
      Transactioncode: "Trans00123",
      RequestNumber: "00987",
      MainAccount: "Main00987",
      SubAccount: "Sub00765",
      Date: "05/08/2023",
      Amount: "200",
      Remarks: "Remarks",
      DocNumber: "0123456",
      Narration: "Lorem ipsum",
    },
    {
      id: 5,
      Transactioncode: "Trans00345",
      RequestNumber: "00678",
      MainAccount: "Main00678",
      SubAccount: "Sub00123",
      Date: "30/03/2023",
      Amount: "50",
      Remarks: "Remarks",
      DocNumber: "0123456",
      Narration: "Lorem ipsum",
    },
  ],
  ViewReplenish: {},
};
const PettyCashReplenishReducer = createSlice({
  name: "pettycashreplenish",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getReplenishListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReplenishListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.ReplenishList = action.payload;
    });
    builder.addCase(getReplenishListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.ReplenishList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //ReplenishSearch

    builder.addCase(getReplenishSearchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getReplenishSearchMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.ReplenishSearch = action.payload;
    });
    builder.addCase(getReplenishSearchMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.ReplenishSearch = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // AddReplenish

    builder.addCase(postAddReplenishMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddReplenishMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // state.AddReplenish = action.payload;
      state.ReplenishList = [...state.ReplenishList, action.payload];
    });
    builder.addCase(postAddReplenishMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.AddReplenish = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //AddReplenishTable

    builder.addCase(getAddReplenishTableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAddReplenishTableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.AddReplenishTable = action.payload;
      }
    );
    builder.addCase(
      getAddReplenishTableMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.AddReplenishTable = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //ViewReplenish

    builder.addCase(getViewReplenishMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getViewReplenishMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.ViewReplenish = action.payload;
    });
    builder.addCase(getViewReplenishMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.ViewReplenish = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default PettyCashReplenishReducer.reducer;
