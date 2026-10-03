import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_USER_DETAILS,
  GET_USER_BY_ID,
  POST_ADD_USER,
  PATCH_USER_EDIT,
  GET_SERACH_USER,
  GET_ADD_BRANCH_USER,
  GET_USER_DATA_VIEW,
  GET_USER_DATA_EDIT,
  GET_MAIN_BRANCH_ACCESS_VIEW,
  GET_MAIN_BRANCH_VIEW,
  POST_MAIN_BRANCH_VIEW,
  GET_ADDITIONAL_ROLE_TABEL,
  GET_ADDITIONAL_ROLE_VIEW,
  POST_ADDITIONAL_ROLE,
} from "../../../../../redux/actionTypes";
import userService from "../../../../../services/userService";

export const getUserMiddleware = createAsyncThunk(
  GET_USER_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      const response = await userService.getUsers(payload);
      if (response.success) {
        return response.data;
      }
      return rejectWithValue(response.error);
    } catch (error) {
      return rejectWithValue(error?.message);
    }
  }
);
export const getUserListByIdMiddleware = createAsyncThunk(
  GET_USER_BY_ID,
  async (payload, { rejectWithValue }) => {
    try {
      const response = await userService.getUserById(payload);
      if (response.success) {
        return response.data;
      }
      return rejectWithValue(response.error);
    } catch (error) {
      return rejectWithValue(error?.message);
    }
  }
);
export const postAddUserMiddleware = createAsyncThunk(
  POST_ADD_USER,
  async (payload, { rejectWithValue }) => {
    try {
      // Map frontend fields to backend fields
      const userData = {
        username: payload?.username,
        email: payload?.email,
        displayName: payload?.displayName,
        // empty: the server generates a temporary password
        password: payload?.password || undefined,
        roles: Array.isArray(payload?.roles) ? payload.roles : [],
        permissions: payload?.permissions || [],
        branchCode: payload?.branchCode || undefined,
        designation: payload?.designation || undefined,
        reportingTo: payload?.reportingTo || undefined,
      };

      const response = await userService.createUser(userData);
      if (response.success) {
        return response.data;
      }
      return rejectWithValue(response.error);
    } catch (error) {
      return rejectWithValue(error?.message);
    }
  }
);
export const patchUserEditMiddleware = createAsyncThunk(
  PATCH_USER_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      // Map frontend fields to backend fields
      const userData = {
        username: payload?.username,
        email: payload?.email,
        displayName: payload?.displayName,
        roles: Array.isArray(payload?.roles) ? payload.roles : undefined,
        permissions: payload?.permissions || undefined,
        // empty clears the field (the server keeps a value that is not sent)
        branchCode: payload?.branchCode ?? undefined,
        designation: payload?.designation ?? undefined,
        reportingTo: payload?.reportingTo ?? undefined,
      };

      const response = await userService.updateUser(payload.id, userData);
      if (response.success) {
        return response.data;
      }
      return rejectWithValue(response.error);
    } catch (error) {
      return rejectWithValue(error?.message);
    }
  }
);
export const getSearchUserMiddleware = createAsyncThunk(
  GET_SERACH_USER,
  async (payload, { rejectWithValue }) => {
    try {
      const response = await userService.getUsers({
        search: payload,
        limit: 10,
      });
      if (response.success) {
        return response.data;
      }
      return rejectWithValue(response.error);
    } catch (error) {
      return rejectWithValue(error?.message);
    }
  }
);

export const getBranchAddUserMiddleware = createAsyncThunk(
  GET_ADD_BRANCH_USER,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getUserViewDataMiddleWare = createAsyncThunk(
  GET_USER_DATA_VIEW,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getUserEditDataMiddleWare = createAsyncThunk(
  GET_USER_DATA_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getMainBranchAccessMiddleWare = createAsyncThunk(
  GET_MAIN_BRANCH_ACCESS_VIEW,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getViewMainBranchUser = createAsyncThunk(
  GET_MAIN_BRANCH_VIEW,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postViewMainBranchUser = createAsyncThunk(
  POST_MAIN_BRANCH_VIEW,
  async (payload, { rejectWithValue }) => {
    const data = {
      branchCode: payload?.branchCode,
      branchName: "branchName",
      TransactionNofrom: "TransactionNofrom",
      departmentCode: payload?.departmentCode,
      departmentName: "departmentName",
    };
    try {
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAdditionalRoleTabelMiddleWare = createAsyncThunk(
  GET_ADDITIONAL_ROLE_TABEL,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getAdditionalRoleViewMiddleWare = createAsyncThunk(
  GET_ADDITIONAL_ROLE_VIEW,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postAdditionalRoleViewMiddleWare = createAsyncThunk(
  POST_ADDITIONAL_ROLE,
  async (payload, { rejectWithValue }) => {
    const data = {
      id: payload?.id,
      RoleCode: payload?.RoleCode,
      RoleName: payload?.RoleName,
      ActiveHours: payload?.ActiveHours,
    };
    try {
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
