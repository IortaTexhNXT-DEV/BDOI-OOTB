import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";
import { GET_EXCHANGE_LIST, GET_EXCHANGE_SEARCH_LIST, POST_EXCHANGE_STATUS, GET_EXCHANGE_DETAIL_VIEW, GET_ADD_EXCHANGE, PATCH_EXCHANGE_DETAIL_EDIT, GET_EXCHANGE_EDIT } from "../../../../redux/actionTypes";


export const getExchangeList = createAsyncThunk(
    GET_EXCHANGE_LIST,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getExchangeSearchList = createAsyncThunk(
    GET_EXCHANGE_SEARCH_LIST,
    async (payload, { rejectWithValue,getState }) => {
        const textSearch = payload;
        console.log(textSearch, "textSearch")
        const { exchangeMasterReducer } = getState();

        const { ExchangeList } = exchangeMasterReducer;
        console.log(ExchangeList, "1234")
        try {
            const searchResults = ExchangeList.filter(item => {
                return item.CurrencyCode.toLowerCase().includes(textSearch.toLowerCase());
            });
            console.log(searchResults, "searchResults")
            return searchResults;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

// export const postExchangeStatus = createAsyncThunk(
//     POST_EXCHANGE_STATUS,
//     async (payload, { rejectWithValue }) => {
//         try {
//             // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
//             return payload;
//         } catch (error) {
//             return rejectWithValue(error?.response.data.error.message);
//         }
//     },
// );
export const postExchangeStatus = createAsyncThunk(
    POST_EXCHANGE_STATUS,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");

        let bodyTableData = {
            id: payload?.id,
            EffectiveFrom: payload?.EffectiveFrom.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            EffectiveTo: payload?.EffectiveTo.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            CurrencyCode: payload?.CurrencyCode,
            ToCurrencyCode: payload?.ToCurrencyCode,
            ExchangeRate: payload?.ExchangeRate,
            CurrencyDescription: payload?.CurrencyDescription,
            ToCurrencyDescription: payload?.ToCurrencyDescription
        };
        try {
            console.log(bodyTableData, "find middleware");

            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);


export const getAddExchange = createAsyncThunk(
    GET_ADD_EXCHANGE,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);



export const patchExchangeDetailEdit = createAsyncThunk(
    PATCH_EXCHANGE_DETAIL_EDIT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "patchExchangeDetailEdit")
        const Tabledata = {
            id: payload?.id,
            EffectiveFrom: payload?.EffectiveFrom.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            EffectiveTo: payload?.EffectiveTo.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            CurrencyCode: payload?.CurrencyCode,
            ToCurrencyCode: payload?.ToCurrencyCode,
            ExchangeRate: payload?.ExchangeRate,
            CurrencyDescription: payload?.CurrencyDescription,
            ToCurrencyDescription: payload?.ToCurrencyDescription,
        }
        try {

            return Tabledata;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
export const getExchangeDetailEdit = createAsyncThunk(
    GET_EXCHANGE_EDIT,
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


export const getExchangeDetailView = createAsyncThunk(
    GET_EXCHANGE_DETAIL_VIEW,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
