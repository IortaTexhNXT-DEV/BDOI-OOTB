import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";
import { GET_BANK_LIST, GET_BANK_SEARCH_LIST, POST_BANK_STATUS, GET_BANK_DETAIL_VIEW, GET_ADD_BANK, PATCH_BANK_DETAIL_EDIT, POST_ADD_BANK, POST_ADD_ACCOUNT_DETAILS, GET_ADD_VIEW, GET_Account_PATCH_VIEW, GET_PATCH_VIEW, GET_CHEQUE_LIST, POST_CHEQUE_DATA, GET_CHEQUE_EDIT_DATA, POST_CHEQUE_EDIT_DATA, GET_ACCOUNT_DETAILS_SEARCH_LIST } from "../../../../redux/actionTypes";
import SvgEye from "../../../../assets/icons/SvgEye";
import SvgArrow from "../../../../assets/icons/SvgArrow";
import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";

const BANK = "bank";


export const getBankList = masterThunk(GET_BANK_LIST, (params) => mastersService.list(BANK, params));


export const getBankSearchList = masterThunk(GET_BANK_SEARCH_LIST, (query) => mastersService.list(BANK, { search: searchText(query) }));

export const postAddBankMiddleware = masterThunk(POST_BANK_STATUS, (values) => mastersService.create(BANK, values));


export const getAddBank = createAsyncThunk(
    GET_ADD_BANK,
    async (payload, { rejectWithValue }) => {
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
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


export const patchBankDetailEdit = masterThunk(PATCH_BANK_DETAIL_EDIT, (values) =>
  mastersService.update(BANK, values.id, {
    bankCode: values.bankCode,
    bankName: values.bankName,
    bankBranch: values.bankBranch,
    ifscCode: values.ifscCode,
    AddressLine1: values.addressLine1,
    AddressLine2: values.addressLine2,
    AddressLine3: values.addressLine3,
    City: values.city,
    state: values.state,
    Country: values.country,
    mobile: values.mobile,
    Fax: values.fax,
    email: values.email,
  })
);


export const getBankDetailView = masterThunk(GET_BANK_DETAIL_VIEW, (row) => mastersService.get(BANK, row?.id ?? row));

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
        const { bankMasterReducer } = getState();

        const { AccountDetailsList } = bankMasterReducer;
        try {
            const searchResults = AccountDetailsList.filter(item => {
                return item.AccountNumber.toLowerCase().includes(textSearch.toLowerCase());
            });
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

