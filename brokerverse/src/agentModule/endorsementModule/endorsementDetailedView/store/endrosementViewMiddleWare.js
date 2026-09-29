import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_ENDROSEMENT_VIEW_DATA } from "../../../../redux/actionTypes";



export const getEndrosementViewData = createAsyncThunk(
    GET_ENDROSEMENT_VIEW_DATA,
    async (payload, { rejectWithValue }) => {
        console.log(payload,"payload");
  
      try {
        return payload
      } catch (error) {
        return rejectWithValue(error?.response?.data?.error?.message);
      }
    }
  );