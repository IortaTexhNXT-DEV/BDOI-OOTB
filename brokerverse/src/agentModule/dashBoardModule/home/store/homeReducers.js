import { createSlice } from "@reduxjs/toolkit";
import { getDashboardDataMiddleware } from "./homeMiddleware";

const initialState = {
    loading: false,
    error: "",
    dashboardDetails: {
        userDetails: {},
        commission: {},
        recentQuotations: [],
        expiringPolicies: [],
    },
};

const homeReducer = createSlice({
    name: "homeReducer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(getDashboardDataMiddleware.pending, (state) => {
            state.loading = true;
            state.error = "";
        });
        builder.addCase(getDashboardDataMiddleware.fulfilled, (state, action) => {
            state.loading = false;
            state.dashboardDetails = action.payload;
        });
        builder.addCase(getDashboardDataMiddleware.rejected, (state, action) => {
            state.loading = false;
            state.error = typeof action.payload === "string" ? action.payload : "";
        });
    },
});

export default homeReducer.reducer;
