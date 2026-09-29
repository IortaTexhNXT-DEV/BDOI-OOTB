import { createAsyncThunk } from "@reduxjs/toolkit";

import {
  GET_COMPANY_DETAILS,
  GET_COMPANY_BY_ID,
  POST_ADD_COMPANY,
  PATCH_COMPANY_EDIT,
  GET_SERACH_COMPANY,
  GET_COMPANY_VIEW,
  GET_COMPANY_EDIT,
} from "../../../../../redux/actionTypes";

export const getCompanyListMiddleware = createAsyncThunk(
  GET_COMPANY_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getComapnyListByIdMiddleware = createAsyncThunk(
  GET_COMPANY_BY_ID,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddCompanyMiddleware = createAsyncThunk(
  POST_ADD_COMPANY,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getCompanyViewMiddleWare = createAsyncThunk(
  GET_COMPANY_VIEW,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getCompanyEditData = createAsyncThunk(
  GET_COMPANY_EDIT,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const patchCompanyEditMiddleware = createAsyncThunk(
  PATCH_COMPANY_EDIT,
  async (payload, { rejectWithValue }) => {
    const data = {
      id: payload?.id,
      CompanyCode: payload?.CompanyCode,
      CompanyName: payload?.CompanyName,
      LicenseNumber: payload?.LicenseNumber,
      EmailID: payload?.EmailID,
      Logo: payload?.Logo,
      Websitelink: payload?.Websitelink,
      Description: payload?.Description,
      AddressLine1: payload?.AddressLine1,
      AddressLine2: payload?.AddressLine2,
      AddressLine3: payload?.AddressLine3,
      PinCode: payload?.PinCode,
      City: payload?.CompanyCode,
      State: payload?.State,
      Country: payload?.Country,
      PhoneNumber: payload?.PhoneNumber,
      Fax: payload?.Fax,
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const getSearchCompanyMiddleware = createAsyncThunk(
  GET_SERACH_COMPANY,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { organizationCompanyMainReducers } = getState();

    const { companyTableList } = organizationCompanyMainReducers;
    console.log(companyTableList, "1234");

    try {
      if (textSearch.trim() !== "") {
        const searchResults = companyTableList.filter((item) => {
          return item.CompanyCode.toLowerCase().includes(
            textSearch.toLowerCase()
          ) || item.CompanyName.toLowerCase().includes(
            textSearch.toLowerCase()
          );
        });
        console.log(searchResults, "searchResults");
        return searchResults;
      } else {
        return companyTableList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
