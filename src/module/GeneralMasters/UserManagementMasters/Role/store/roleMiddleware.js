import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_ROLE_DETAILS,
  GET_ROLE_BY_ID,
  POST_ADD_ROLE,
  PATCH_ROLE_EDIT,
  GET_SERACH_ROLE,
  GET_VIEW_ROLE,
  GET_PATCH_ROLE,
} from "../../../../../redux/actionTypes";

export const getRoleListMiddleware = createAsyncThunk(
  GET_ROLE_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getRoleListByIdMiddleware = createAsyncThunk(
  GET_ROLE_BY_ID,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddRoleMiddleware = createAsyncThunk(
  POST_ADD_ROLE,
  async (payload, { rejectWithValue }) => {
    console.log(payload?.id, "payload");
    const data = {
      id: payload?.id,
      roleCode: payload?.roleCode,
      roleName: payload?.roleName,
      roleDescription: payload?.roleDescription,
      menuAccess: payload?.menuAccess,
      subMenuAccess: payload?.subMenuAccess,
      permissions: payload?.permissions,
      modifiedBy: "Johnson",
      modifiedOn: "RC1234",
    }
    try {

      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchRoleEditMiddleware = createAsyncThunk(
  PATCH_ROLE_EDIT,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    const data = {
      id: payload?.id,
      roleCode: payload?.roleCode,
      roleName: payload?.roleName,
      roleDescription: payload?.roleDescription,
      menuAccess: payload?.menuAccess,
      subMenuAccess: payload?.subMenuAccess,
      permissions: payload?.permissions,
      modifiedBy: payload?.modifiedBy,
      modifiedOn: payload?.modifiedOn,
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getViewRoleEditMiddleware = createAsyncThunk(
  GET_VIEW_ROLE,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getPatchRoleEditMiddleware = createAsyncThunk(
  GET_PATCH_ROLE,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getSearchRoleMiddleware = createAsyncThunk(
  GET_SERACH_ROLE,
  async (payload, { rejectWithValue, getState }) => {
    const textSearch = payload;
    console.log(textSearch, "textSearch")
    const { roleMainReducers } = getState();

    const { roleTableList } = roleMainReducers;

    try {
      const searchResults = roleTableList.filter(item => {
        return item.roleName.toLowerCase().includes(textSearch.toLowerCase());
      });
      console.log(searchResults, "searchResults")
      return searchResults;


    }
    catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

