import { createAsyncThunk } from "@reduxjs/toolkit";
import { CLAIM_SEARCH_DATA, CLIAM_LIST_DATA } from "../../../redux/actionTypes";
import claimsService from "../../../services/claimsService";

export const claimListDatMiddleWare = createAsyncThunk(
  CLIAM_LIST_DATA,
  async ({ page = 1, pageSize = 10 }, { rejectWithValue }) => {
    try {
      const result = await claimsService.getClaimsList(page, pageSize);

      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);

export const claimListSearchDataDatMiddleWare = createAsyncThunk(
  CLAIM_SEARCH_DATA,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { claimsMainReducers } = getState();
    const { claimsTabelList } = claimsMainReducers;

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
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
