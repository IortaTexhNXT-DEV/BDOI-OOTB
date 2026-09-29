import { createAsyncThunk } from "@reduxjs/toolkit";

import {
  GET_BRANCH_DETAILS,
  GET_BRANCH_BY_ID,
  POST_ADD_BRANCH,
  PATCH_BRANCH_EDIT,
  GET_SERACH_BRANCH,
  GET_ORGANIZATION_BRANCH_VIEW,
  GET_DEPARTMENT_LUST_DETAILS,
  POST_ADD_DEPARTMENT,
  GET_DEPARTMENT_VIEW,
  GET_PATCH_BRANCH_EDIT,
  POST_PATCH_DEPARTMENT_EDIT,
  GET_PATCH_DEPARTMENT_EDIT,
} from "../../../../../redux/actionTypes";

export const getBranchListMiddleware = createAsyncThunk(
  GET_BRANCH_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getDepartmentListMiddleware = createAsyncThunk(
  GET_DEPARTMENT_LUST_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddDepartment = createAsyncThunk(
  POST_ADD_DEPARTMENT,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload")
    const data = {
      id: payload.id,
      DepartmentCode: payload?.DepartmentCode,
      DepartmentName: payload?.DepartmentName,
      Description: payload?.Description,
      Status: 'Credit'
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getBranchListByIdMiddleware = createAsyncThunk(
  GET_BRANCH_BY_ID,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddBranchMiddleware = createAsyncThunk(
  POST_ADD_BRANCH,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload")
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getOrganizationBranchView = createAsyncThunk(
  GET_ORGANIZATION_BRANCH_VIEW,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload")
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getDepatmentView = createAsyncThunk(
  GET_DEPARTMENT_VIEW,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload")
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchBranchEditMiddleware = createAsyncThunk(
  PATCH_BRANCH_EDIT,
  async (payload, { rejectWithValue }) => {
    const data = {
      id: payload?.id,
      BranchCode: payload?.BranchCode,
      BranchName: payload?.BranchName,
      CompanyName: payload?.CompanyName,
      EmailID: payload?.EmailID,
      Description: payload?.Description,
      AddressLine1: payload?.AddressLine1,
      AddressLine2: payload?.AddressLine2,
      AddressLine3: payload?.AddressLine3,
      City: payload?.City,
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

export const getSearchBranchMiddleware = createAsyncThunk(
  GET_SERACH_BRANCH,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { organizationBranchMainReducers } = getState();

    const { branchTableList } = organizationBranchMainReducers;
    console.log(branchTableList, "1234")

    try {
      if (textSearch.trim() !== "") {
        const searchResults = branchTableList.filter(item => {
          return item.CompanyName.toLowerCase().includes(textSearch.toLowerCase()) || item.BranchCode.toLowerCase().includes(textSearch.toLowerCase())
        });
        console.log(searchResults, "searchResults")
        return searchResults;
      } else {
        return branchTableList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  },
);

export const getPatchBranchData = createAsyncThunk(
  GET_PATCH_BRANCH_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postPatchDepatmentEdit = createAsyncThunk(
  POST_PATCH_DEPARTMENT_EDIT,
  async (payload, { rejectWithValue }) => {
    console.log(payload.id, "payloadpayload");
    const data = {
      id: payload.id,
      DepartmentCode: payload?.DepartmentCode,
      DepartmentName: payload?.DepartmentName,
      Description: payload?.Description,
      Status: 'Credit'
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const getDepatmentEditData = createAsyncThunk(
  GET_PATCH_DEPARTMENT_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

