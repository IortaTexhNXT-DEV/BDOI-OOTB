
import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_PATCH_SUB_ACCOUNT_EDIT, GET_SUB_ACCOUNT_SEARCH_LIST, GET_SUB__ACCOUNT, GET_SUB__ACCOUNT_BY_ID, GET_SUB__ACCOUNT_VIEW, PATCH_SUB__ACCOUNT_EDIT, POST_SUB__ACCOUNT } from "../../../../redux/actionTypes";



export const getSubAccount = createAsyncThunk(
    GET_SUB__ACCOUNT_BY_ID,
    async (payload, { rejectWithValue, getState }) => {
        const { subAccountMainReducers } = getState();

        const { subAccountList } = subAccountMainReducers
        const filteredData = subAccountList.filter(item => item.id === 1);


        try {

            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
export const postSubAccount = createAsyncThunk(
    POST_SUB__ACCOUNT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        const data = {
            id: payload?.id,
            subAccountCode: payload?.subAccountCode,
            description: payload?.description,
            subAccountName: payload?.subAccountName,
            mainAccount: payload?.mainAccount,
            currencyCode: payload?.currencyCode,
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)



export const getSubAccountSearchList = createAsyncThunk(
    GET_SUB_ACCOUNT_SEARCH_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const textSearch = payload;
        console.log(textSearch, "textSearch")
        const { subAccountMainReducers } = getState();

        const { subAccountList } = subAccountMainReducers;
        console.log(subAccountList, "1234")
        try {
            const searchResults = subAccountList.filter(item => {
                return item.subAccountCode.toLowerCase().includes(textSearch.toLowerCase());
            });
            console.log(searchResults, "searchResults")
            return searchResults;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)

export const getSubAccountView = createAsyncThunk(
    GET_SUB__ACCOUNT_VIEW,

    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)
export const getSubAccountEdit = createAsyncThunk(
    GET_PATCH_SUB_ACCOUNT_EDIT,

    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)

export const patchSubAccountEdit = createAsyncThunk(
    PATCH_SUB__ACCOUNT_EDIT,
    async (payload, { rejectWithValue, getState }) => {

        const { subAccountMainReducers } = getState();
        const { subAccountList } = subAccountMainReducers;

        console.log(subAccountList, payload, "payload123")

        const updatedData = subAccountList?.map((item) => {
            if (parseInt(item.id) === parseInt(payload?.id)) {
                console.log("www", item.id)
                return {
                    id: payload?.id,
                    subAccountCode: payload?.subAccountCode,
                    description: payload?.description,
                    subAccountName: payload?.subAccountName,
                    mainAccount: payload?.mainAccount,
                    currencyCode: payload?.currencyCode,

                };
            }
            return item;
        });



        // const TableData = {
        // id: payload?.id,
        // subAccountCode: payload?.subAccountCode,
        // description: payload?.description,
        // subAccountName: payload?.subAccountName,
        // mainAccount: payload?.mainAccount,
        // currencyCode: payload?.currencyCode,
        // }
        try {
            console.log("qq", updatedData)
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return updatedData;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)

