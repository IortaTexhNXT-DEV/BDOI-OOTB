import { createSlice } from "@reduxjs/toolkit";
import { postUploadPolicyMiddleWare} from "./paymentMiddleware";

const initialState = {
    loading: false,
    error: "",
    paymenttabledata:[],
    postUploadPolicydata:{}
};

const UploadPolicyReducer = createSlice({
    name: "UploadPolicyReducer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {



      //postUploadPolicyMiddleWare

    builder.addCase(postUploadPolicyMiddleWare.pending, (state) => {
        state.loading = true;
      });
      builder.addCase(
        postUploadPolicyMiddleWare.fulfilled,
        (state, action) => {
          state.loading = false;
          state.postUploadPolicydata = action.payload
        }
      );
      builder.addCase(
        postUploadPolicyMiddleWare.rejected,
        (state, action) => {
          state.loading = false;
          state.error = typeof action.payload === "string" ? action.payload : "";
        }
      );
      
    },
});

export default UploadPolicyReducer.reducer;