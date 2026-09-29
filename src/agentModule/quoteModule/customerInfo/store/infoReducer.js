import { createSlice } from "@reduxjs/toolkit";
import { postinformationMiddleWare,patchinformationMiddleWare} from "./infoMiddleWare";


const initialState = {
    loading: false,
    error: "",
    paymenttabledata:[],
    postcustomerinfodata:{},
    patchinformation:{}
};

const customerInfoReducer = createSlice({
    name: "customerInfoReducer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {



      

    builder.addCase(postinformationMiddleWare.pending, (state) => {
        state.loading = true;
      });
      builder.addCase(
        postinformationMiddleWare.fulfilled,
        (state, action) => {
          state.loading = false;
          state.postcustomerinfodata = action.payload
        }
      );
      builder.addCase(
        postinformationMiddleWare.rejected,
        (state, action) => {
          state.loading = false;
          state.error = typeof action.payload === "string" ? action.payload : "";
        }
      );

    builder.addCase(
      patchinformationMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        console.log(action.payload, "find patch in red");

       state.postcustomerinfodata =action.payload
        
      }
    );
    
    },
});

export default customerInfoReducer.reducer;