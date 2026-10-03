import { createSlice } from "@reduxjs/toolkit";
import {
  getRequestListMiddleware,
  getRequestSearchMiddleware,
  postAddRequestMiddleware,
  getAddRequestTableMiddleware,
  postEditRequestMiddleware,
  geteditrequestMiddleware,
  patchupdateRequestMiddleware,
  transitionRequestMiddleware,
} from "./pettyCashRequestMiddleware";

const initialState = {
  loading: false,
  error: "",
  RequestList: [],
  RequestSearch: [],
  RequestDraft: {},
  AddRequest: {},
  AddRequestTable: [],
  editrequestDetails: {},
};

const errorText = (action) =>
  typeof action.payload === "string" ? action.payload : "";

const replaceRow = (rows, row) => rows.map((item) => (item.id === row.id ? row : item));

const PettyCashRequestReducer = createSlice({
  name: "pettycashrequest",
  initialState,
  reducers: {
    /** Header of a new request (Add Request form); lines are added on the next screen. */
    setRequestDraft: (state, action) => {
      state.RequestDraft = action.payload;
      state.AddRequestTable = [];
    },
    removeRequestLine: (state, action) => {
      state.AddRequestTable = state.AddRequestTable.filter((line) => line.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => {
      state.loading = true;
      state.error = "";
    };
    const rejected = (state, action) => {
      state.loading = false;
      state.error = errorText(action);
    };
    builder
      .addCase(getRequestListMiddleware.pending, pending)
      .addCase(getRequestListMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.RequestList = action.payload;
      })
      .addCase(getRequestListMiddleware.rejected, rejected)
      .addCase(getRequestSearchMiddleware.pending, pending)
      .addCase(getRequestSearchMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.RequestSearch = action.payload;
      })
      .addCase(getRequestSearchMiddleware.rejected, rejected)
      .addCase(postAddRequestMiddleware.pending, pending)
      .addCase(postAddRequestMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.AddRequest = action.payload;
        state.RequestList = [action.payload, ...state.RequestList];
      })
      .addCase(postAddRequestMiddleware.rejected, rejected)
      .addCase(getAddRequestTableMiddleware.fulfilled, (state, action) => {
        state.AddRequestTable = action.payload || [];
      })
      .addCase(postEditRequestMiddleware.fulfilled, (state, action) => {
        state.AddRequestTable = [...state.AddRequestTable, action.payload];
      })
      .addCase(geteditrequestMiddleware.pending, pending)
      .addCase(geteditrequestMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.editrequestDetails = action.payload;
        state.AddRequestTable = action.payload.lines;
      })
      .addCase(geteditrequestMiddleware.rejected, rejected)
      .addCase(patchupdateRequestMiddleware.pending, pending)
      .addCase(patchupdateRequestMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.editrequestDetails = action.payload;
        state.RequestList = replaceRow(state.RequestList, action.payload);
      })
      .addCase(patchupdateRequestMiddleware.rejected, rejected)
      .addCase(transitionRequestMiddleware.pending, pending)
      .addCase(transitionRequestMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.editrequestDetails = action.payload;
        state.RequestList = replaceRow(state.RequestList, action.payload);
      })
      .addCase(transitionRequestMiddleware.rejected, rejected);
  },
});

export const { setRequestDraft, removeRequestLine } = PettyCashRequestReducer.actions;
export default PettyCashRequestReducer.reducer;
