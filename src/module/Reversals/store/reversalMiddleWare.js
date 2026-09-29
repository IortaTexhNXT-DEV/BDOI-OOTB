import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../utility/commonServices";
import { APIROUTES } from "../../../routes/apiRoutes";

import { GET_REVERSAL_JV_LIST, POST_REVERSAL_JV } from "../../../redux/actionTypes";

export const getReversalTabelData = createAsyncThunk(
    GET_REVERSAL_JV_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const { reversalMainReducers } = getState();
        console.log(reversalMainReducers, "data");
        const { reversalJVGetDataList } = reversalMainReducers;
        const filteredData = reversalJVGetDataList.filter((item) => item.id === 1);

        try {
            // Simulate an API call if needed
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

export const postReversalJVData = createAsyncThunk(
    POST_REVERSAL_JV,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");

        // let bodyTableData = {
        //     reversalJVTransactionCode: payload?.reversalJVTransactionCode,
        //     transactionNumber: payload?.transactionNumber,
        //     transactionCode: payload?.transactionCode,
        // };
        try {
            // console.log(bodyTableData, "find middleware");

            return payload;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);
