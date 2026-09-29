import { createAsyncThunk } from "@reduxjs/toolkit";
import {
    POST_ACCESSORIES
} from "../../../../redux/agentActionTypes";

export const postaccessoriesMiddleware = createAsyncThunk(
  POST_ACCESSORIES,
  async (payload, { rejectWithValue, getState }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);