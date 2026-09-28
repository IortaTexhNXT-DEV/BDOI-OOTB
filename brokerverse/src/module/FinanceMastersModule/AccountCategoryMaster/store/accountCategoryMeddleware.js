import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";
import {
  GET_ACCOUNT_CATEGORY_LIST,
  GET_ACCOUNT_CATEGORY_SEARCH_LIST,
  POST_ACCOUNT_CATEGORY_STATUS,
  GET_ACCOUNT_CATEGORY_DETAIL_VIEW,
  GET_ADD_ACCOUNT_CATEGORY,
  GET_ACCOUNT_CATEGORY_DETAIL_EDIT,
  PATCH_ACCOUNT_CATEGORY_DETAIL_EDIT,
} from "../../../../redux/actionTypes";

export const getAccountCategoryList = createAsyncThunk(
  GET_ACCOUNT_CATEGORY_LIST,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAccountCategorySearchList = createAsyncThunk(
  GET_ACCOUNT_CATEGORY_SEARCH_LIST,
  async (payload, { rejectWithValue,getState }) => {
    const textSearch = payload;
    console.log(textSearch, "textSearch")
    const { accountCategoryReducer } = getState();

    const { AccountCategoryList } = accountCategoryReducer;
    console.log(AccountCategoryList, "1234")
    try {
        const searchResults = AccountCategoryList.filter(item => {
            return item.accountCategoryCode.toLowerCase().includes(textSearch.toLowerCase());
        });
        console.log(searchResults, "searchResults")
        return searchResults;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postAccountCategoryStatus = createAsyncThunk(
  POST_ACCOUNT_CATEGORY_STATUS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAddAccountCategoryMiddleWare = createAsyncThunk(
  GET_ADD_ACCOUNT_CATEGORY,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "find payload");
    const updateTable = {
      id: payload?.id,
      accountCategoryCode: payload?.categoryCode,
      accountCategoryName: payload?.categoryName,
      description:payload?.description,
      status: 0,
      action: payload?.id,
    };
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return updateTable;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAccountCategoryDetailEditMiddleWare = createAsyncThunk(
  GET_ACCOUNT_CATEGORY_DETAIL_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await patchRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAccountCategoryDetailViewMiddleWare = createAsyncThunk(
  GET_ACCOUNT_CATEGORY_DETAIL_VIEW,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchAccountCategoryDetailEditMiddleWare = createAsyncThunk(
  PATCH_ACCOUNT_CATEGORY_DETAIL_EDIT,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find AccountCategoryList 2");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
