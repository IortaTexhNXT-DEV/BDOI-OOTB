import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_PATCH_PETTY_CASH_EDIT, GET_PETTY_CASH_BY_ID, GET_PETTY_CASH_SEARCH_LIST, GET_PETTY_CASH_VIEW, PATCH_PETTY_CASH_EDIT, POST_ADD_PETTY_CASH } from "../../../../redux/actionTypes";



export const pettyCashMaster = createAsyncThunk(
    GET_PETTY_CASH_BY_ID,
    async (payload, { rejectWithValue, getState }) => {
        const { pettyCashMainReducers } = getState();
        console.log(pettyCashMainReducers, "dta");
        const { pettyCashList } = pettyCashMainReducers
        const filteredData = pettyCashList.filter(item => item.id === 1);
        console.log(filteredData, "filteredData")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
)





export const postAddPettyCash = createAsyncThunk(
    POST_ADD_PETTY_CASH,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            const postData = {
                pettycashcode: payload?.pettycashcode,
                pettycashname: payload?.pettycashname,
                pettycashsize: payload?.pettycashsize,
                avilabelcash: payload?.avilabelcash,
                minicashbox: payload?.minicashbox,
                transactionlimit: payload?.transactionlimit
            }
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            // const response = await postPetty(payload);
            console.log(postData, "postData")
            return postData;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)

export const getPettyCashSearchList = createAsyncThunk(
    GET_PETTY_CASH_SEARCH_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const textSearch = payload;
        console.log(textSearch, "textSearch")
        const { pettyCashMainReducers } = getState();

        const { pettyCashList } = pettyCashMainReducers;
        console.log(pettyCashMainReducers, "pettyCashMainReducers")
        try {
            const searchResults = pettyCashList.filter(item => {
                return item.pettycashcode.toLowerCase().includes(textSearch.toLowerCase());
            });
            console.log(searchResults, "searchResults")
            return searchResults;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)


export const getPettyCashView = createAsyncThunk(
    GET_PETTY_CASH_VIEW,

    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)

export const patchPettyCashEdit = createAsyncThunk(
    PATCH_PETTY_CASH_EDIT,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "ppayload")
        const data = {
            id: payload?.id,
            pettycashcode: payload?.pettycashcode,
            pettycashname: payload?.pettycashname,
            pettycashsize: payload?.pettycashsize,
            availabelCash: payload?.availabelCash,
            minicashbox: payload?.minicashbox,
            transactionlimit: payload?.transactionlimit
        }
        try {
            // Instead of dispatching an action here, return the updated list
            return data;
        } catch (error) {
            return rejectWithValue(
                error?.response?.data?.error?.message || "An error occurred"
            );
        }
    }
);

export const getPatchPettyCashEdit = createAsyncThunk(
    GET_PATCH_PETTY_CASH_EDIT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)