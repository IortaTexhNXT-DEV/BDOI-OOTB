import { createSlice } from "@reduxjs/toolkit";
import { getClaimSettleViewData } from "./claimSettleMiddleWare";

const initialState = {
    loading: false,
    error: "",
    claimSettleViewData:
    {
        id: 1,
        policyNumber:"123",
        claimNumber: "345",
        dateReported: "22/1/2023",
        dateOfLoss: "21/1/2023",
    },

};

const claimSettleReducers = createSlice({
    name: "claimSettle",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(getClaimSettleViewData.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            getClaimSettleViewData.fulfilled,
            (state, action) => {
                state.loading = false;
                state.claimSettleViewData = action.payload
            }
        );
        builder.addCase(
            getClaimSettleViewData.rejected,
            (state, action) => {
                state.loading = false;
                state.claimSettleViewData = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );

    },
});

export default claimSettleReducers.reducer;