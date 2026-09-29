import { createSlice } from "@reduxjs/toolkit";
import {
  getQuotependingSearchDataMiddleWare,
  getquotependingtableMiddleware,
} from "./quotePendingMiddleware";

const initialState = {
  loading: false,
  error: "",
  quotependingtabledata: [
    {
      Name: "John Doe",
      id: 1,
      LeadId: "012345",
      QuoteId: "012345",
      Category: "Retail",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "127332",
    },
    {
      Name: "Jane Smith",
      id: 2,
      LeadId: "167890",
      QuoteId: "012345",
      Category: "Corporate",
      PolicyType: "Travel",
      Date: "01 JAN 2024",
      Actions: "1272721",
    },
    {
      Name: "Bob Johnson",
      id: 3,
      LeadId: "254321",
      QuoteId: "012345",
      Category: "Retail",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "1270002",
    },
    {
      Name: "Alice Williams",
      id: 4,
      LeadId: "398765",
      QuoteId: "012345",
      Category: "Corporate",
      PolicyType: "Travel",
      Date: "01 JAN 2024",
      Actions: "120002",
    },
    {
      Name: "Mike Davis",
      id: 5,
      LeadId: "423456",
      QuoteId: "012345",
      Category: "Corporate",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "111172",
    },
    {
      Name: "Sara Miller",
      id: 6,
      LeadId: "578901",
      QuoteId: "012345",
      Category: "Retail",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "12000",
    },
    {
      Name: "Chris Brown",
      id: 7,
      LeadId: "9987634",
      QuoteId: "012345",
      Category: "Corporate",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "1221112",
    },
    {
      Name: "Emily Taylor",
      id: 8,
      LeadId: "012345",
      QuoteId: "012345",
      Category: "Retail",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "12002",
    },
    {
      Name: "David Wilson",
      id: 9,
      LeadId: "53628782",
      QuoteId: "012345",
      Category: "Retail",
      PolicyType: "Travel",
      Date: "01 JAN 2024",
      Actions: "12233",
    },
    {
      Name: "Grace Anderson",
      id: 10,
      LeadId: "287654",
      QuoteId: "012345",
      Category: "Corporate",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "127272",
    },
  ],
  quotependingSearchList: [],
};

const expiringReducer = createSlice({
  name: "expiringReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //getquotependingtableMiddleware

    builder.addCase(getquotependingtableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getquotependingtableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.quotependingtabledata = [action.payload];
      }
    );
    builder.addCase(
      getquotependingtableMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // getQuotependingSearchDataMiddleWare

    builder.addCase(getQuotependingSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getQuotependingSearchDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.quotependingSearchList = action.payload;
      }
    );
    builder.addCase(
      getQuotependingSearchDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.quotependingSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default expiringReducer.reducer;
