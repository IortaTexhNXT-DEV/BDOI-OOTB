
import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_PATCH_TAXATION_EDIT, GET_TAXATION, GET_TAXATION_BY_ID, GET_TAXATION_SEARCH_LIST, GET_TAXATION_VIEW, PATCH_TAXATION_EDIT, POST_TAXATION } from "../../../../redux/actionTypes";

export const getTaxationData = createAsyncThunk(
    GET_TAXATION_BY_ID,
    async (payload, { rejectWithValue, getState }) => {
        const { taxationMainReducers } = getState();
        const { taxationList } = taxationMainReducers
        const filteredData = taxationList.filter(item => item.id === 1);


        try {

            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const postAddTaxationMiddileware = createAsyncThunk(

    POST_TAXATION,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        let bodyTableData = {
            id: payload?.id,
            taxCode: payload?.taxCode,
            taxName: payload?.taxName,
            taxRate: payload?.taxRate,
            basis: payload?.basis,
            remarks: payload?.remarks,
            taxationDescription: payload?.taxationDescription,
            effectiveFrom: payload?.effectiveFrom.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            effectiveTo: payload?.effectiveTo.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            status: "500.00",
            action: 8,
        };

        try {
            console.log(bodyTableData, "find middleware taxation");

            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)



export const getTaxationSearchList = createAsyncThunk(
    GET_TAXATION_SEARCH_LIST,
    async (payload, { rejectWithValue,getState }) => {
        const textSearch = payload;
        console.log(textSearch, "textSearch")
        const { taxationMainReducers } = getState();

        const { taxationList } = taxationMainReducers;
        console.log(taxationList, "1234")
        try {
            const searchResults = taxationList.filter(item => {
                return item.taxCode.toLowerCase().includes(textSearch.toLowerCase());
            });
            console.log(searchResults, "searchResults")
            return searchResults;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)

export const getTaxationView = createAsyncThunk(
    GET_TAXATION_VIEW,

    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload");
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)
export const patchTaxationEdit = createAsyncThunk(
    PATCH_TAXATION_EDIT,
    async (payload, { rejectWithValue }) => {
        const data = {
            id: payload?.id,
            taxCode: payload?.taxCode,
            taxName: payload?.taxName,
            taxRate: payload?.taxRate,
            basis: payload?.basis,
            remarks: payload?.remarks,
            taxationDescription: payload?.taxationDescription,
            effectiveFrom: payload?.effectiveFrom.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            effectiveTo: payload?.effectiveTo.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
        }
        try {

            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)
export const getpatchTaxationEdit = createAsyncThunk(
    GET_PATCH_TAXATION_EDIT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)

