import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_DASHBOARD_DATA } from "../../../../redux/agentActionTypes";




export const getDashboardDataMiddleware = createAsyncThunk(
    GET_DASHBOARD_DATA,
    async (_a, { rejectWithValue }) => {

        try {
            // Simulate an API call if needed
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            // return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);
