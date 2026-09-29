import { createSlice } from "@reduxjs/toolkit";
import { getDashboardDataMiddleware } from "./homeMiddleware";

const initialState = {
    loading: false,
    error: "",

    dashboardDetails: {
        userDetails: {
            name: "John Visser",
            totalLeads: 60,
            totalClients: 30,
            policySold: 200,
            earnedCommission: "₱ 13920",
            collectedPremium: "₱ 8920",
            receivables: "₱ 8400",
            grossPremium: "₱ 174050"
        },
        commission: {
            "2024": {
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [
                    {
                        type: 'bar',
                        label: '2024',
                        backgroundColor: '#6366F1',
                        data: [50, 25, 12, 48, 80, 76, 42, 50, 25, 12, 48, 70, 76, 42],
                        barPercentage: 0.8,
                        categoryPercentage: 0.6
                    }
                ]
            },
            "2023": {
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [
                    {
                        type: 'bar',
                        label: '2024',
                        backgroundColor: '#6366F1',
                        data: [25, 50, 20, 40, 20, 33, 42, 15, 50, 44, 48, 66, 46, 41],
                        barPercentage: 0.8,
                        categoryPercentage: 0.6
                    }
                ]
            },
            "2022": {
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [
                    {
                        type: 'bar',
                        label: '2024',
                        backgroundColor: '#6366F1',
                        data: [25, 25, 55, 88, 68, 60, 42, 30, 50, 20, 48, 30, 62, 23],
                        barPercentage: 0.8,
                        categoryPercentage: 0.6
                    }
                ]
            },
            "2021": {
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [
                    {
                        type: 'bar',
                        label: '2024',
                        backgroundColor: '#6366F1',
                        data: [30, 77, 23, 83, 70, 76, 29, 39, 24, 28, 48, 70, 46, 32],
                        barPercentage: 0.8,
                        categoryPercentage: 0.6
                    }
                ]
            }
            ,
            "2020": {
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [
                    {
                        type: 'bar',
                        label: '2024',
                        backgroundColor: '#6366F1',
                        data: [30, 56, 28, 48, 60, 76, 27, 66, 88, 44, 45, 57, 37, 42],
                        barPercentage: 0.8,
                        categoryPercentage: 0.6
                    }
                ]
            }
        }
    }
};
const homeReducer = createSlice({
    name: "homeReducer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        //AccountCategoryList

        builder.addCase(getDashboardDataMiddleware.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getDashboardDataMiddleware.fulfilled, (state, action) => {
            state.loading = false;
            // state.dashboardDetails = action.payload;
        });
        builder.addCase(getDashboardDataMiddleware.rejected, (state, action) => {
            state.loading = false;

            state.AccountCategoryList = {};
            state.error = typeof action.payload === "string" ? action.payload : "";
        });

    },
});

export default homeReducer.reducer;
