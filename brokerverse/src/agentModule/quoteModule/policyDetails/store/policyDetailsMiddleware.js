import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_POLICY_DETAILS, POST_ADD_MODLE, GET_MODLE_DETAILS
} from "../../../../redux/agentActionTypes";

export const postPolicyDetailsMiddleware = createAsyncThunk(
  POST_POLICY_DETAILS,
  async (payload, { rejectWithValue, getState }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const postModleDetailsMiddleware = createAsyncThunk(
  POST_ADD_MODLE,
  async (payload, { rejectWithValue }) => {
    const dataTable = {
      id: payload?.id,
      ParticipantName: payload?.ParticipantName,
      SumInsuredcurrency: payload?.SumInsuredcurrency,
      Premiumcurrencys: payload?.Premiumcurrencys,
      Sharepercentage: payload?.Sharepercentage,
      premium: payload?.premium,
      sumInsured: payload?.sumInsured
    }
    try {
      return dataTable;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getModleDetailsMiddleware = createAsyncThunk(
  GET_MODLE_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);