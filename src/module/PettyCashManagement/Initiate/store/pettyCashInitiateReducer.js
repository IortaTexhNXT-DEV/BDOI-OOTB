import { createSlice } from "@reduxjs/toolkit";
import {
  getInitiateListMiddleware,
  getInitiateListSearchMiddleware,
  getInitiateDetailsMiddleware,
  postInitiateMiddleware,
} from "./pettyCashInitiateMiddleware";
const initialState = {
  loading: false,
  error: "",
  InitiateList: [
    {
      id: 1,
      Pettycashcode: "PCC0123",
      Pettycashsize: "10000",
      TransactionNumber: "Trans00123",
      MaxLimit: "10,000.00",
      Branchcode: "Branch00123",
      Departmentcode: "Depart00123",
      TransactionDate: "21/12/2023",
    },
    {
      id: 2,
      Pettycashcode: "PCC0456",
      Pettycashsize: "15000",
      TransactionNumber: "Trans00456",
      MaxLimit: "15,000.00",
      Branchcode: "Branch00456",
      Departmentcode: "Depart00456",
      TransactionDate: "15/09/2023",
    },
    {
      id: 3,
      Pettycashcode: "PCC0789",
      Pettycashsize: "8000",
      TransactionNumber: "Trans00789",
      MaxLimit: "8,000.00",
      Branchcode: "Branch00789",
      Departmentcode: "Depart00789",
      TransactionDate: "02/05/2023",
    },
    {
      id: 4,
      Pettycashcode: "PCC0987",
      Pettycashsize: "12000",
      TransactionNumber: "Trans00987",
      MaxLimit: "12,000.00",
      Branchcode: "Branch00987",
      Departmentcode: "Depart00987",
      TransactionDate: "19/11/2023",
    },
    {
      id: 5,
      Pettycashcode: "PCC0654",
      Pettycashsize: "9000",
      TransactionNumber: "Trans00654",
      MaxLimit: "9,000.00",
      Branchcode: "Branch00654",
      Departmentcode: "Depart00654",
      TransactionDate: "28/07/2023",
    },
    {
      id: 6,
      Pettycashcode: "PCC0234",
      Pettycashsize: "11000",
      TransactionNumber: "Trans00234",
      MaxLimit: "11,000.00",
      Branchcode: "Branch00234",
      Departmentcode: "Depart00234",
      TransactionDate: "14/04/2023",
    },
    {
      id: 7,
      Pettycashcode: "PCC0321",
      Pettycashsize: "7000",
      TransactionNumber: "Trans00321",
      MaxLimit: "7,000.00",
      Branchcode: "Branch00321",
      Departmentcode: "Depart00321",
      TransactionDate: "30/10/2023",
    },
    {
      id: 8,
      Pettycashcode: "PCC0543",
      Pettycashsize: "13000",
      TransactionNumber: "Trans00543",
      MaxLimit: "13,000.00",
      Branchcode: "Branch00543",
      Departmentcode: "Depart00543",
      TransactionDate: "08/02/2023",
    },
    {
      id: 9,
      Pettycashcode: "PCC0765",
      Pettycashsize: "8500",
      TransactionNumber: "Trans00765",
      MaxLimit: "8,500.00",
      Branchcode: "Branch00765",
      Departmentcode: "Depart00765",
      TransactionDate: "25/06/2023",
    },
    {
      id: 10,
      Pettycashcode: "PCC0890",
      Pettycashsize: "9500",
      TransactionNumber: "Trans00890",
      MaxLimit: "9,500.00",
      Branchcode: "Branch00890",
      Departmentcode: "Depart00890",
      TransactionDate: "12/01/2023",
    },
  ],
  Initiate: {},
  InitiateListSearch: [],
  InitiateDetails: [],
};
const PettyCashInitiateReducer = createSlice({
  name: "pettycashinitiate",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInitiateListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInitiateListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.InitiateList = action.payload;
      //   state.InitiateList = [...state.InitiateList, action.payload];
    });
    builder.addCase(getInitiateListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.InitiateList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //InitiateListSearchMiddleware

    builder.addCase(getInitiateListSearchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInitiateListSearchMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InitiateListSearch = action.payload;
      }
    );
    builder.addCase(
      getInitiateListSearchMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.InitiateListSearch = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // InitiateList

    builder.addCase(postInitiateMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postInitiateMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      //   state.Initiate = action.payload;
      console.log(state.InitiateList, action.payload, "lusi")
      state.InitiateList = [...state.InitiateList, action.payload];
    });
    builder.addCase(postInitiateMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.Initiate = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getInitiateDetailsMiddleware

    builder.addCase(getInitiateDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInitiateDetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.InitiateDetails = action.payload;
    });
    builder.addCase(getInitiateDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.InitiateDetails = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default PettyCashInitiateReducer.reducer;
