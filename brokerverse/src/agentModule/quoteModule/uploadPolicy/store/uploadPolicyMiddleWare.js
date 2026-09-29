import { createAsyncThunk } from "@reduxjs/toolkit";
import {
    POST_UPLOADPOLICY_DATA
} from "../../../../redux/actionTypes";

export const postUploadPolicyMiddleWare = createAsyncThunk(
    POST_UPLOADPOLICY_DATA,
    async (payload, { rejectWithValue, getState }) => {
      const bodyTableData = {
        PolicyNumber:payload?.PolicyNumber,
  InsuranceCompany:payload?.InsuranceCompany,
  Production: payload?.Production,
  Inception: payload?.Inception,
  IssuedDate: payload?.IssuedDate,
  Expiry:payload?.Expiry
      };
  
      try {
        return bodyTableData;
      } catch (error) {
        return rejectWithValue(error?.response.data.error.message);
      }
    }
  );