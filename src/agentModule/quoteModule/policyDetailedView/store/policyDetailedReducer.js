import { createSlice } from "@reduxjs/toolkit";
import { getpolicyDetailedMiddleware } from "./policyDetailedMiddleware";

const initialState = {
  loading: false,
  error: "",
  policydetailedlist: {
    policyNumber: "",
    production: "",
    inception: "",
    issuedDate: "",
    expiry: "",
    insuredName: "",
    productType: "",
    grossPremium: "",
    totalCoverage: "",
    insuranceCompany: "",
    // Add more fields as needed from the API response
  },
};

const policyReducer = createSlice({
  name: "policyReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getpolicyDetailedMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getpolicyDetailedMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.policydetailedlist = action.payload;
    });
    builder.addCase(getpolicyDetailedMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default policyReducer.reducer;
