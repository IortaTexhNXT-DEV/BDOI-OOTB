import { createSlice } from "@reduxjs/toolkit";
import { postEndromentMiddleWare } from "./uploadEndrosementMiddleWare";

const initialState = {
    loading: false,
    error: "",
    endrosmentData: {}

};

const endrosementReducers = createSlice({
    name: "endrosment",
    initialState,
    reducers: {},
    extraReducers: (builder) => {

        builder.addCase(postEndromentMiddleWare.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            postEndromentMiddleWare.fulfilled,
            (state, action) => {
                state.loading = false;
                state.endrosmentData = action.payload
            }
        );
        builder.addCase(
            postEndromentMiddleWare.rejected,
            (state, action) => {
                state.loading = false;
                state.endrosmentData = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );
    },
});

export default endrosementReducers.reducer;