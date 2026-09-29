import { createAsyncThunk } from "@reduxjs/toolkit";
import {
    POST_ACCESSORIES
} from "../../../../redux/agentActionTypes";

export const postaccessoriesMiddleware = createAsyncThunk(
  POST_ACCESSORIES,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find add datas in leomax");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);