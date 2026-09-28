import { createAsyncThunk } from "@reduxjs/toolkit";
// import { getRequest } from "../../../utility/commonServices";
// import { APIROUTES } from "../../../routes/apiRoutes";
import {
  GET_EMPLOYEE_DETAILS,
  GET_EMPLOYEE_BY_ID,
  POST_ADD_EMPLOYEE,
  PATCH_EMPLOYEE_EDIT,
  GET_SERACH_EMPLOYEE,
  GET_VIEW_EMPLOYEE,
  GET_EDIT_EMPLOYEE,
} from "../../../../../redux/actionTypes";

export const getEmployeeListMiddleware = createAsyncThunk(
  GET_EMPLOYEE_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getEmployeeListByIdMiddleware = createAsyncThunk(
  GET_EMPLOYEE_BY_ID,
  async (payload, { rejectWithValue }) => {
    
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddEmployeeMiddleware = createAsyncThunk(
  POST_ADD_EMPLOYEE,
  async (payload, { rejectWithValue }) => {
    
    const data = {
      id:payload?.id,
      employeeCode: payload?.employeeCode,
      firstName: payload?.firstName,
      middleName: payload?.middleName,
      lastName: payload?.lastName,
      employeeType: payload?.employeeType,
      designation: payload?.designation,
      reportingTo: payload?.reportingTo,
      branchCode: payload?.branchCode,
      departmentCode: payload?.departmentCode,
      idProofType: payload?.idProofType,
      idNumber: payload?.idNumber,
      addressLine1: payload?.addressLine1,
      addressLine2: payload?.addressLine2,
      addressLine3: payload?.addressLine3,
      city: payload?.city,
      state: payload?.state,
      country: payload?.country,
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
export const patchEmployeeEditMiddleware = createAsyncThunk(
  PATCH_EMPLOYEE_EDIT,
  async (payload, { rejectWithValue }) => {
    console.log(payload,"find payloadddd")
    const data = {
      id:payload?.id,
      employeeCode: payload?.employeeCode,
      firstName: payload?.firstName,
      middleName: payload?.middleName,
      lastName: payload?.lastName,
      employeeType: payload?.employeeType,
      designation: payload?.designation,
      reportingTo: payload?.reportingTo,
      branchCode: payload?.branchCode,
      departmentCode: payload?.departmentCode,
      idProofType: payload?.idProofType,
      idNumber: payload?.idNumber,
      addressLine1: payload?.addressLine1,
      addressLine2: payload?.addressLine2,
      addressLine3: payload?.addressLine3,
      city: payload?.city,
      state: payload?.state,
      country: payload?.country,
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

export const getSearchEmployeeMiddleware = createAsyncThunk(
  GET_SERACH_EMPLOYEE,
  async (payload, { rejectWithValue, getState }) => {
    const textSearch = payload;
    console.log(textSearch, "textSearch")
    const { employeeReducers } = getState();

    const { employeeTableList } = employeeReducers;

    try {
      const searchResults = employeeTableList.filter(item => {
        return item.employeeCode.toLowerCase().includes(textSearch.toLowerCase());
      });
      console.log(searchResults, "searchResults")
      return searchResults;


    }
    // try {
    //   const { userReducers } = getState();
    //   const { employeeTableList } = userReducers;
    //   // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
    //   return payload;
    // } 
    catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getEmployeViewMiddleWare = createAsyncThunk(
  GET_VIEW_EMPLOYEE,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const getEmployeEditMiddleWare = createAsyncThunk(
  GET_EDIT_EMPLOYEE,
  async (payload, { rejectWithValue }) => {
    console.log(payload,"find edit payload");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


