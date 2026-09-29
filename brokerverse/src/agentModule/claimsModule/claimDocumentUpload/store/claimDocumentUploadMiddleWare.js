import { createAsyncThunk } from "@reduxjs/toolkit";
import {GET_CLAIM_DOCUMENT_UPLOAD_DATA} from "../../../../redux/actionTypes";

export const getClaimDocumentUploadData = createAsyncThunk(
    GET_CLAIM_DOCUMENT_UPLOAD_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      return payload
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

