import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../utility/commonServices";
import { APIROUTES } from "../../../routes/apiRoutes";
import { GET_CORRECTION_JV_LIST, GET_CORRECTION_JV_VIEW, GET_PATCH_CORRECTION_JV_EDIT, PATCH_CORRECTION_JV_EDIT, POST_CORRECTION_JV } from "../../../redux/actionTypes";




export const getCorrectionJVTabelData = createAsyncThunk(
    GET_CORRECTION_JV_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const { correctionJVMainReducers } = getState();
        console.log(correctionJVMainReducers, "data");
        const { correctionJVList } = correctionJVMainReducers;
        const filteredData = correctionJVList.filter((item) => item.id === 1);

        try {
            // Simulate an API call if needed
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);


export const postCorrectionJVData = createAsyncThunk(
    POST_CORRECTION_JV,
    async (payload, { rejectWithValue }) => {
        try {

            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getCorrectionJVView = createAsyncThunk(
    GET_CORRECTION_JV_VIEW,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const getPatchCorrectionJVEdit = createAsyncThunk(
    GET_PATCH_CORRECTION_JV_EDIT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload");
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const patchCorrectionJVEdit = createAsyncThunk(
    PATCH_CORRECTION_JV_EDIT,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");
        const data = {
            id: payload?.id,
            mainAccount: payload?.mainAccount || "",
            mainAccountDescription: payload?.mainAccountDescription || "",
            entryType: payload?.entryType || "",
            subAccount: payload?.subAccount || "",
            subAccountDescription: payload?.subAccountDescription || "",
            branchCode: payload?.branchCode || "",
            branchCodeDescription: payload?.branchCodeDescription || "",
            departmentCode: payload?.departmentCode || "",
            departmentDescription: payload?.departmentDescription || "",
            currencyCode: payload?.currencyCode || "",
            currencyDescription: payload?.currencyDescription || "",
            foreignAmount: payload?.foreignAmount || "",
            remarks: "-",
            localAmount: "00",
        }
        try {
            console.log(data, "data");
            return data;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message || "An error occurred");
        }
    }
);




