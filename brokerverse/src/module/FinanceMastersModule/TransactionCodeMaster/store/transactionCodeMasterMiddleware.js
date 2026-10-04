import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_TRANSACTION_CODE_LIST, GET_TRANSACTION_CODE_LIST_SEARCH, POST_STATUS, POST_ADD_TRANSACTION, GET_TRANSACTION_CODE_SETUP, GET_USER_GROUP_ACCESS, POST_ADD_TRANSACTION_CODE_SETUP, POST_ADD_USER_GROUP_ACCESS, PATCH_TRANSACTION_CODE_DETAILS_EDIT, GET_TRANSACTION_CODE_DETAILS_VIEW, GET_PATCH_TRANSACTION_EDIT, GET_PATCH_USER_ACCESS, POST_PATCH_USER_ACCESS } from "../../../../redux/actionTypes";
import mastersService, { searchText } from "../../../../services/mastersService";
import masterThunk from "../../../GeneralMasters/common/masterThunk";

const TYPE = "transaction-code";

let nextRowId = 1;
const withRowId = (row) => ({ ...row, id: row.id ?? `row-${nextRowId++}` });

/** Transaction code record with the user group access rows currently shown in the screen. */
const withUserGroupAccess = (values, getState) => ({
  ...values,
  userGroupAccess: (getState().transactionCodeMasterReducer?.UserGroupAccessList || []).map(
    ({ UserRole, MinimumTransaction, MaximumTransaction }) => ({ UserRole, MinimumTransaction, MaximumTransaction })
  ),
});

export const getTransactioncodeListMiddleware = masterThunk(GET_TRANSACTION_CODE_LIST, (params) => mastersService.list(TYPE, params));

export const getTransactioncodeListsearch = masterThunk(GET_TRANSACTION_CODE_LIST_SEARCH, (query) =>
  mastersService.list(TYPE, { search: searchText(query) })
);

export const postStatus = masterThunk(POST_STATUS, ({ id, active }) => mastersService.setStatus(TYPE, id, active));

export const postAddTransaction = masterThunk(POST_ADD_TRANSACTION, (values, { getState }) =>
  mastersService.create(TYPE, withUserGroupAccess(values, getState))
);

export const getTransactionCodeSetup = createAsyncThunk(
    GET_TRANSACTION_CODE_SETUP,
    async (payload, { rejectWithValue }) => {
        try {
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const getUserGroupAccess = masterThunk(GET_USER_GROUP_ACCESS, (rows) => (Array.isArray(rows) ? rows : []).map(withRowId));

export const postAddTransactionCodeSetup = createAsyncThunk(
    POST_ADD_TRANSACTION_CODE_SETUP,
    async (payload, { rejectWithValue, getState }) => {
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
            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

export const postAddUserGroupAccess = masterThunk(POST_ADD_USER_GROUP_ACCESS, (row) =>
  withRowId({
    UserRole: row?.UserRole,
    MinimumTransaction: row?.MinimumTransaction,
    MaximumTransaction: row?.MaximumTransaction,
  })
);

export const getTrascationcodeDetailsView = masterThunk(GET_TRANSACTION_CODE_DETAILS_VIEW, (row) => mastersService.get(TYPE, row?.id ?? row));

export const getpatchTrascationcodeDetailsEdit = masterThunk(GET_PATCH_TRANSACTION_EDIT, (row) => mastersService.get(TYPE, row?.id ?? row));

export const patchTrascationcodeDetailsEdit = masterThunk(PATCH_TRANSACTION_CODE_DETAILS_EDIT, (values, { getState }) =>
  mastersService.update(TYPE, values.id, withUserGroupAccess(values, getState))
);

export const getUserEditData = createAsyncThunk(
    GET_PATCH_USER_ACCESS,
    async (payload, { rejectWithValue }) => {
        try {
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);

export const patchUserRoleAccess = createAsyncThunk(
    POST_PATCH_USER_ACCESS,
    async (payload, { rejectWithValue }) => {
        const data = {
            id: payload?.id,
            UserRole: payload?.UserRole,
            MinimumTransaction: payload?.MinimumTransaction,
            MaximumTransaction: payload?.MaximumTransaction,
        }
        try {
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);