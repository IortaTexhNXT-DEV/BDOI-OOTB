import { createSlice } from "@reduxjs/toolkit";
import { getQuoteSearchDataMiddleWare, getquotetableMiddleware} from "./quoteMiddleware";

const initialState = {
    loading: false,
    error: "",
    // Rows come from GET /quotations (quotationReducers.quotations); no sample rows
    quotetabledata: [],
    quoteSearchList:[],
    
};

const quoteReducer = createSlice({
    name: "quoteReducer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {

         //getquotetableMiddleware

    builder.addCase(getquotetableMiddleware.pending, (state) => {
        state.loading = true;
      });
      builder.addCase(
        getquotetableMiddleware.fulfilled,
        (state, action) => {
          state.loading = false;
          state.quotetabledata = [action.payload]
        }
      );
      builder.addCase(
        getquotetableMiddleware.rejected,
        (state, action) => {
          state.loading = false;
          state.error = typeof action.payload === "string" ? action.payload : "";
        }
      );



      // getQuoteSearchDataMiddleWare

      builder.addCase(getQuoteSearchDataMiddleWare.pending, (state) => {
        state.loading = true;
      });
      builder.addCase(getQuoteSearchDataMiddleWare.fulfilled, (state, action) => {
        state.loading = false;
        state.quoteSearchList = action.payload;
      });
      builder.addCase(getQuoteSearchDataMiddleWare.rejected, (state, action) => {
        state.loading = false;
  
        state.quoteSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      });
      
    },
});

export default quoteReducer.reducer;