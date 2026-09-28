import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";
import { GET_BANK_LIST, GET_BANK_SEARCH_LIST, POST_BANK_STATUS, GET_BANK_DETAIL_VIEW, GET_ADD_BANK, PATCH_BANK_DETAIL_EDIT, POST_ADD_BANK, POST_ADD_ACCOUNT_DETAILS, GET_ADD_VIEW, GET_Account_PATCH_VIEW, GET_PATCH_VIEW, GET_CHEQUE_LIST, POST_CHEQUE_DATA, GET_CHEQUE_EDIT_DATA, POST_CHEQUE_EDIT_DATA, GET_ACCOUNT_DETAILS_SEARCH_LIST } from "../../../../redux/actionTypes";
import SvgEye from "../../../../assets/icons/SvgEye";
import SvgArrow from "../../../../assets/icons/SvgArrow";


export const getBankList = createAsyncThunk(
    GET_BANK_LIST,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getBankSearchList = createAsyncThunk(
    GET_BANK_SEARCH_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const textSearch = payload;
        console.log(textSearch, "textSearch")
        const { bankMasterReducer } = getState();

        const { BankList } = bankMasterReducer;
        console.log(BankList, "1234")
        try {
            const searchResults = BankList.filter(item => {
                return item.bankCode.toLowerCase().includes(textSearch.toLowerCase());
            });
            console.log(searchResults, "searchResults")
            return searchResults;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const postAddBankMiddleware = createAsyncThunk(
    POST_BANK_STATUS,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload");
        const data = {
            bankCode: payload?.bankCode,
            bankName: payload?.bankName,
            bankBranch: payload?.bankBranch,
            ifscCode: payload?.ifscCode,
            AddressLine1: payload?.AddressLine1,
            AddressLine2: payload?.AddressLine2,
            AddressLine3: payload?.AddressLine3,
            city: payload?.city,
            state: payload?.state,
            status: payload?.status,
            Country: payload?.Country,
            mobile: payload?.mobile,
            Fax: payload?.Fax,
            email: payload?.email,
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getAddBank = createAsyncThunk(
    GET_ADD_BANK,
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


export const postAddAccountDetails = createAsyncThunk(
    POST_ADD_ACCOUNT_DETAILS,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload");
        const data = {
            id: payload?.AccountNumber,
            AccountNumber: payload?.AccountNumber,
            AccountName: payload?.AccountName,
            AccountType: payload?.AccountType.name,
            MainAccount: payload?.MainAccount,
            MainAccountDescription: payload?.MainAccountDescription,
            TransactionLimit: payload?.TransactionLimit,
            MaxTransactionLimit:"0"
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const postAddBank = createAsyncThunk(
    POST_ADD_BANK,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "postAddBank");
        const tabledata = {
            id: payload.id,
            bankCode: payload.BankCode,
            // code: <SvgArrow />,
            bankName: payload?.BankName,
            bankBranch: payload?.BankBranch,
            ifscCode: payload?.IFSCCode,
            email: payload?.EmailID,
            status: true,
            mobile: payload?.PhoneNumber

        }
        console.log(payload, "leo________");
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return tabledata;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const getAccountDetailsView = createAsyncThunk(
    GET_ADD_VIEW,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
export const getPatchAccountDetailsView = createAsyncThunk(
    GET_Account_PATCH_VIEW,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "columnData");
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const patchBankDetailEdit = createAsyncThunk(
    PATCH_BANK_DETAIL_EDIT,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "patchBankDetailEdit");
        // const { bankMasterReducer } = getState();


        // const { correctionJVList } = correctionJVMainReducers;
        // const filteredData = correctionJVList.filter((item) => item.id === 1);

        try {
            // const { BankList } = bankMasterReducer;
            // const updatedObject = BankList.findIndex(item => item.bankCode === payload?.bankCode);
            // let newArr = [...BankList]
            // newArr[updatedObject] = {
            //     bankBranch: payload?.bankBranch,
            //     bankCode: payload?.bankCode,
            //     bankName: payload?.bankName,


            //     email
            //         :
            //         payload?.email,
            //     ifscCode
            //         :
            //         payload?.ifscCode,
            //     mobile
            //         :
            //         payload?.mobile,
            //     status
            //         :
            //         true
            // }
            // const { data } = await patchRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getBankDetailView = createAsyncThunk(
    GET_BANK_DETAIL_VIEW,
    async (payload, { rejectWithValue }) => {

        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const postPatchAccountDetailEdit = createAsyncThunk(
    GET_PATCH_VIEW,
    async (payload, { rejectWithValue }) => {
        const data = {
            id: payload?.id,
            AccountNumber: payload?.AccountNumber,
            AccountName: payload?.AccountName,
            AccountType: payload?.AccountType,
            MainAccount: payload?.MainAccount,
            MainAccountDescription: payload?.MainAccountDescription,
            TransactionLimit: payload?.TransactionLimit,
            MaxTransactionLimit:"0"
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const getSeachAddAccountDetails = createAsyncThunk(
    GET_ACCOUNT_DETAILS_SEARCH_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const textSearch = payload;
        console.log(textSearch, "textSearch")
        const { bankMasterReducer } = getState();

        const { AccountDetailsList } = bankMasterReducer;
        console.log(AccountDetailsList, "1234")
        try {
            const searchResults = AccountDetailsList.filter(item => {
                return item.AccountNumber.toLowerCase().includes(textSearch.toLowerCase());
            });
            console.log(searchResults, "searchResults")
            return searchResults;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
export const getChequeListData = createAsyncThunk(
    GET_CHEQUE_LIST,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const postChequeDataMiddleWare = createAsyncThunk(
    POST_CHEQUE_DATA,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "pppppp");
        const data = {
            id: payload?.id,
            chequeBookNo: payload?.chequeBookNo,
            chequeLeafBegining: payload?.chequeLeafBegining,
            chequeLeafEnd: payload?.chequeLeafEnd,
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const getChequeEditDataMiddleWare = createAsyncThunk(
    GET_CHEQUE_EDIT_DATA,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "pppppp");
       
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
export const postChequeEditDataMiddleWare = createAsyncThunk(
    POST_CHEQUE_EDIT_DATA,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "pppppp");
        const data = {
            id: payload?.id,
            chequeBookNo: payload?.chequeBookNo,
            chequeLeafBegining: payload?.chequeLeafBegining,
            chequeLeafEnd: payload?.chequeLeafEnd,
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

