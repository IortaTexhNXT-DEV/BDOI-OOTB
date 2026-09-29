import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_POLICY_DETAILS, POST_ADD_MODLE, GET_MODLE_DETAILS
} from "../../../../redux/agentActionTypes";

export const postPolicyDetailsMiddleware = createAsyncThunk(
  POST_POLICY_DETAILS,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find add datas in leo");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const postModleDetailsMiddleware = createAsyncThunk(
  POST_ADD_MODLE,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "postAddCountryMiddleware");

    const dataTable = {
      id: payload?.id,
      ParticipantName: payload?.ParticipantName,
      SumInsuredcurrency: payload?.SumInsuredcurrency,
      Premiumcurrencys: payload?.Premiumcurrencys,
      Sharepercentage: payload?.Sharepercentage,
      premium: payload?.premium,
      sumInsured: payload?.sumInsured
    }
    console.log(dataTable, "dataTable")
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
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
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);