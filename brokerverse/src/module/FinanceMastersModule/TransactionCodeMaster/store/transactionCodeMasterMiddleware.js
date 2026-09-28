import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";
import { GET_TRANSACTION_CODE_LIST, GET_TRANSACTION_CODE_LIST_SEARCH, POST_STATUS, POST_ADD_TRANSACTION, GET_TRANSACTION_CODE_SETUP, GET_USER_GROUP_ACCESS, POST_ADD_TRANSACTION_CODE_SETUP, POST_ADD_USER_GROUP_ACCESS, PATCH_TRANSACTION_CODE_DETAILS_EDIT, GET_TRANSACTION_CODE_DETAILS_VIEW, GET_PATCH_TRANSACTION_EDIT, GET_PATCH_USER_ACCESS, POST_PATCH_USER_ACCESS } from "../../../../redux/actionTypes";


export const getTransactioncodeListMiddleware = createAsyncThunk(
    GET_TRANSACTION_CODE_LIST,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);



export const getTransactioncodeListsearch = createAsyncThunk(
    GET_TRANSACTION_CODE_LIST_SEARCH,
    async (payload, { rejectWithValue, getState }) => {
        const textSearch = payload;
        console.log(textSearch, "textSearch")
        const { transactionCodeMasterReducer } = getState();

        const { TransactioncodeList } = transactionCodeMasterReducer;
        console.log(TransactioncodeList, "1234")

        try {
            const searchResults = TransactioncodeList.filter(item => {
                return item.TransactionName.toLowerCase().includes(textSearch.toLowerCase());
            });
            console.log(searchResults, "searchResults")
            return searchResults;


        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    },
);


export const postStatus = createAsyncThunk(
    POST_STATUS,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await postRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const postAddTransaction = createAsyncThunk(
    POST_ADD_TRANSACTION,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");

        let bodyTableData = {

            id: payload?.id,
            TransactionCode: payload?.TransactionCode,
            TransactionName: payload?.TransactionName,
            TransactionBasis: payload?.TransactionBasis,
            Description: payload?.Description,
            MainAccountCode: payload?.MainAccountCode,
            MainAccountDescription: "MainAccountCode",
            SubAccountCode: payload?.SubAccountCode,
            SubAccountDescription: "SubAccountCode",
            BranchCode: payload?.BranchCode,
            BranchDescription:"BranchCode",
            Department: payload?.Department,
            DepartmentDescription: "DepartmentDescription",
            DepartmentCode: payload?.DepartmentCode,

        };
        try {
            console.log(bodyTableData, "find middleware");

            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);



export const getTransactionCodeSetup = createAsyncThunk(
    GET_TRANSACTION_CODE_SETUP,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getUserGroupAccess = createAsyncThunk(
    GET_USER_GROUP_ACCESS,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);



export const postAddTransactionCodeSetup = createAsyncThunk(
    POST_ADD_TRANSACTION_CODE_SETUP,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");

        let bodyTableData = {
            AccountingPeriodStart: payload?.AccountingPeriodStart.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            AccountingPeriodEnd: payload?.AccountingPeriodEnd.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            TransactionNumberFrom: payload?.TransactionNumberFrom,
            TransactionNumberTo: payload?.TransactionNumberTo,
            lastUsed: "0"

        };
        try {
            console.log(bodyTableData, "find middleware");

            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);


export const postAddUserGroupAccess = createAsyncThunk(
    POST_ADD_USER_GROUP_ACCESS,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");

        let bodyTableData = {
            UserRole: payload?.UserRole,
            MinimumTransaction: payload?.MinimumTransaction,
            MaximumTransaction: payload?.MaximumTransaction,
        };
        try {
            console.log(bodyTableData, "find middleware");

            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);


export const getTrascationcodeDetailsView = createAsyncThunk(
    GET_TRANSACTION_CODE_DETAILS_VIEW,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getpatchTrascationcodeDetailsEdit = createAsyncThunk(
    GET_PATCH_TRANSACTION_EDIT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const patchTrascationcodeDetailsEdit = createAsyncThunk(
    PATCH_TRANSACTION_CODE_DETAILS_EDIT,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");
        const newArr = {
            id: payload?.id,
            bankBranch: payload?.bankBranch,
            TransactionCode: payload?.TransactionCode,
            // TransactionCode: payload?.TransactionCode,
            TransactionName: payload?.TransactionName,
            TransactionBasis: payload?.TransactionBasis,
            BranchCode: payload?.BranchCode,
            DepartmentCode: payload?.DepartmentCode,
            MainAccountCode: payload?.MainAccountCode,
            MainAccountDescription: payload?.MainAccountDescription,
            SubAccountCode: payload?.SubAccountCode,
            SubAccountDescription: payload?.SubAccountDescription,
            BranchDescription: payload?.BranchDescription,
            DepartmentDescription: payload?.DepartmentDescription,
            Description: payload?.Description,
        }
        // const { transactionCodeMasterReducer } = getState();
        try {
            // const { TransactioncodeList } = transactionCodeMasterReducer;
            // const updatedObject = TransactioncodeList.findIndex(item => item.TransactionCode === payload?.TransactionCode);
            // console.log(updatedObject, "updatedObject")
            // let newArr = [...TransactioncodeList]

            // const { data } = await patchRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return newArr;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    }
);

export const getUserEditData = createAsyncThunk(
    GET_PATCH_USER_ACCESS,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const patchUserRoleAccess = createAsyncThunk(
    POST_PATCH_USER_ACCESS,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload")
        const data = {
            id: payload?.id,
            UserRole: payload?.UserRole,
            MinimumTransaction: payload?.MinimumTransaction,
            MaximumTransaction: payload?.MaximumTransaction,
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);