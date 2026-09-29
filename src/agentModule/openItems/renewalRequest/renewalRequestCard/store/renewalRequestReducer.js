import { createSlice } from "@reduxjs/toolkit";
import {
  getrenewalrequestSearchDataMiddleWare,
  getrenewalrequesttableMiddleware,
} from "./renewalRequestMiddleware";

const initialState = {
  loading: false,
  error: "",
  renewalrequesttabledata: [
    {
      Name: "John Doe",
      id: 1,
      ClientId: "012345",
      PolicyNumber: "012345",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "127332",
    },
    {
      Name: "Jane Smith",
      id: 2,
      ClientId: "167890",
      PolicyNumber: "012345",
      PolicyType: "Travel",
      Date: "01 JAN 2024",
      Actions: "1272721",
    },
    {
      Name: "Bob Johnson",
      id: 3,
      ClientId: "254321",
      PolicyNumber: "012345",

      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "1270002",
    },
    {
      Name: "Alice Williams",
      id: 4,
      ClientId: "398765",
      PolicyNumber: "012345",

      PolicyType: "Travel",
      Date: "01 JAN 2024",
      Actions: "120002",
    },
    {
      Name: "Mike Davis",
      id: 5,
      ClientId: "423456",
      PolicyNumber: "012345",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "111172",
    },

    {
      Name: "Chris Brown",
      id: 6,
      ClientId: "9987634",
      PolicyNumber: "012345",

      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "1221112",
    },
    {
      Name: "Emily Taylor",
      id: 7,
      ClientId: "012345",
      PolicyNumber: "012345",
      Category: "Retail",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "12002",
    },
    {
      Name: "David Wilson",
      id: 8,
      ClientId: "53628782",
      PolicyNumber: "012345",
      Category: "Retail",
      PolicyType: "Travel",
      Date: "01 JAN 2024",
      Actions: "12233",
    },
    {
      Name: "Grace Anderson",
      id: 9,
      ClientId: "287654",
      PolicyNumber: "012345",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "127272",
    },
    {
      Name: "Sara Miller",
      id: 10,
      ClientId: "578901",
      PolicyNumber: "012345",
      Category: "Retail",
      PolicyType: "Motor",
      Date: "01 JAN 2024",
      Actions: "12000",
    },
  ],
  renewalrequestSearchList: [],
};

const expiringReducer = createSlice({
  name: "expiringReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //getrenewalrequesttableMiddleware

    builder.addCase(getrenewalrequesttableMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getrenewalrequesttableMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.renewalrequesttabledata = [action.payload];
      }
    );
    builder.addCase(
      getrenewalrequesttableMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    // getrenewalrequestSearchDataMiddleWare

    builder.addCase(getrenewalrequestSearchDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getrenewalrequestSearchDataMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.renewalrequestSearchList = action.payload;
      }
    );
    builder.addCase(
      getrenewalrequestSearchDataMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.renewalrequestSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default expiringReducer.reducer;
