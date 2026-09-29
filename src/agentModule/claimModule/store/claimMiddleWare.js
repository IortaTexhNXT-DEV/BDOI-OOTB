import { createAsyncThunk } from "@reduxjs/toolkit";
import { CLAIM_SEARCH_DATA, CLIAM_LIST_DATA } from "../../../redux/actionTypes";
import claimsService from "../../../services/claimsService";

export const claimListDatMiddleWare = createAsyncThunk(
  CLIAM_LIST_DATA,
  async ({ page = 1, pageSize = 10 }, { rejectWithValue }) => {
    console.log("=== CLAIM LIST MIDDLEWARE ===");
    console.log("Page:", page);
    console.log("Page Size:", pageSize);
    console.log("=== END CLAIM LIST MIDDLEWARE ===");

    try {
      const result = await claimsService.getClaimsList(page, pageSize);

      if (result.success) {
        console.log("Claims list fetched successfully:", result.data);
        return result.data;
      } else {
        console.error("Failed to fetch claims list:", result.error);
        return rejectWithValue(result.error);
      }
    } catch (error) {
      console.error("Claim list middleware error:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);

export const claimListSearchDataDatMiddleWare = createAsyncThunk(
  CLAIM_SEARCH_DATA,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "data find");
    const { claimsMainReducers } = getState();
    const { claimsTabelList } = claimsMainReducers;
    console.log(claimsMainReducers, "claimsMainReducers");

    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter((item) => {
        if (field === "Policy Number") {
          return (item.policyNumber || item.policy?.policyNumber || "")
            .toLowerCase()
            .includes(lowercasedValue);
        } else if (field === "Claim Number") {
          return (item.claimNumber || "")
            .toLowerCase()
            .includes(lowercasedValue);
        }
        return (
          (item.policyNumber || item.policy?.policyNumber || "")
            .toLowerCase()
            .includes(lowercasedValue) ||
          (item.claimNumber || "").toLowerCase().includes(lowercasedValue)
        );
      });
      return outputData;
    }
    try {
      const filteredPayments = filterPaymentsByField(
        claimsTabelList,
        field,
        value
      );
      console.log(filteredPayments, "filteredPayments");
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
