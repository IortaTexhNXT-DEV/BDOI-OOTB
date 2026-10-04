import { createSlice } from "@reduxjs/toolkit";
import {
  getReceiptListMiddleware,
  getReceiptSearchMiddleware,
  postAddReceiptMiddleware,
  getAddReceiptTableMiddleware,
  getViewReceiptMiddleware,
} from "./pettyCashReceiptsMiddleware";

const initialState = {
  loading: false,
  error: "",
  ReceiptList: [],
  ReceiptSearch: [],
  AddReceipt: {},
  AddReceiptTable: [],
  ViewReceipt: {},
  ViewReceiptTable: [],
};

const errorText = (action) =>
  typeof action.payload === "string" ? action.payload : "";

const PettyCashReceiptsReducer = createSlice({
  name: "pettycashreceipts",
  initialState,
  reducers: {
    /** Header of the receipt being added (Add Receipt form). */
    setReceiptDraft: (state, action) => {
      state.AddReceipt = action.payload;
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
      .addCase(getReceiptListMiddleware.pending, pending)
      .addCase(getReceiptListMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.ReceiptList = action.payload;
      })
      .addCase(getReceiptListMiddleware.rejected, rejected)
      .addCase(getReceiptSearchMiddleware.pending, pending)
      .addCase(getReceiptSearchMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.ReceiptSearch = action.payload;
      })
      .addCase(getReceiptSearchMiddleware.rejected, rejected)
      .addCase(getAddReceiptTableMiddleware.pending, pending)
      .addCase(getAddReceiptTableMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.AddReceiptTable = action.payload;
      })
      .addCase(getAddReceiptTableMiddleware.rejected, rejected)
      .addCase(postAddReceiptMiddleware.pending, pending)
      .addCase(postAddReceiptMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.ReceiptList = [...action.payload, ...state.ReceiptList];
      })
      .addCase(postAddReceiptMiddleware.rejected, rejected)
      .addCase(getViewReceiptMiddleware.fulfilled, (state, action) => {
        state.ViewReceipt = action.payload;
        state.ViewReceiptTable = action.payload?.line ? [action.payload.line] : [];
      });
  },
});

export const { setReceiptDraft } = PettyCashReceiptsReducer.actions;
export default PettyCashReceiptsReducer.reducer;
