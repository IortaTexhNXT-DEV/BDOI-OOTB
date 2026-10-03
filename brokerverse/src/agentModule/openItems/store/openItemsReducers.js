import { createSlice } from "@reduxjs/toolkit";
import { getOpenItemsListMiddleware, postOpenItemsListMiddleware } from "./openItemsMiddleware.js";

const initialState = {
  loading: false,
  error: "",
  summary: [],
  items: [],
  upcommingEventsList: [],
};

const errorText = (action) =>
  typeof action.payload === "string" ? action.payload : "";

const openitemTabelMainReducers = createSlice({
  name: "openItems",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getOpenItemsListMiddleware.pending, (state) => {
        state.loading = true;
      })
      .addCase(getOpenItemsListMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload.summary;
        state.items = action.payload.items;
        state.upcommingEventsList = action.payload.events;
      })
      .addCase(getOpenItemsListMiddleware.rejected, (state, action) => {
        state.loading = false;
        state.error = errorText(action);
      })
      .addCase(postOpenItemsListMiddleware.pending, (state) => {
        state.loading = true;
      })
      .addCase(postOpenItemsListMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.upcommingEventsList = [...state.upcommingEventsList, action.payload];
      })
      .addCase(postOpenItemsListMiddleware.rejected, (state, action) => {
        state.loading = false;
        state.error = errorText(action);
      });
  },
});

export default openitemTabelMainReducers.reducer;
