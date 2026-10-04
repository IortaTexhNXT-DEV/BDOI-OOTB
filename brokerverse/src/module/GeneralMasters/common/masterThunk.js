import { createAsyncThunk } from "@reduxjs/toolkit";
import { errorMessage } from "../../../services/mastersService";

/** createAsyncThunk whose API errors reach the reducer as a plain message (rejectWithValue). */
const masterThunk = (actionType, run) =>
  createAsyncThunk(actionType, async (payload, thunkApi) => {
    try {
      return await run(payload, thunkApi);
    } catch (error) {
      return thunkApi.rejectWithValue(errorMessage(error));
    }
  });

export default masterThunk;
