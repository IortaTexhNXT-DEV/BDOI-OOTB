import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_DESIGNATION_BY_ID,
  POST_ADD_DESIGNATION,
  PATCH_DESIGNATION_EDIT,
  GET_SERACH_DESIGANTION,
  GET_DESIGNATION_VIEW,
  GET_DESIGNATION_EDIT,

} from "../../../../../redux/actionTypes";


export const getDesignationListByIdMiddleware = createAsyncThunk(
  GET_DESIGNATION_BY_ID,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddDesignationMiddleware = createAsyncThunk(
  POST_ADD_DESIGNATION,
  async (payload, { rejectWithValue }) => {
    const data = {
      id: payload?.id,
      designationCode: payload?.designationCode,
      designationName: payload.designationName,
      designationDescription: payload?.designationDescription,
      departmentCode: payload?.departmentCode,
      level: payload?.level,
      reportingto: payload?.reportingto,
      ModifiedBy: payload?.ModifiedBy,
      modifiedOn: payload?.modifiedOn,
      reportingtoLevel: payload?.reportingtoLevel,
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchDesignationEditMiddleware = createAsyncThunk(
  PATCH_DESIGNATION_EDIT,
  async (payload, { rejectWithValue }) => {
    const data = {
      id: payload?.id,
      designationCode: payload?.designationCode,
      designationName: payload.designationName,
      designationDescription: payload?.designationDescription,
      departmentCode: payload?.departmentCode,
      level: payload?.level,
      reportingto: payload?.reportingto,
      ModifiedBy: payload?.ModifiedBy,
      modifiedOn: payload?.modifiedOn,
      reportingtoLevel: payload?.reportingtoLevel,
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const getSearchDesignationMiddleware = createAsyncThunk(
  GET_SERACH_DESIGANTION,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { designationMainReducers } = getState();

    const { designationDetailList } = designationMainReducers;
    console.log(designationDetailList, "1234")

    try {
      if (textSearch.trim() !== "") {
        const searchResults = designationDetailList.filter(item => {
          return item.designationCode.toLowerCase().includes(textSearch.toLowerCase())
        });
        console.log(searchResults, "searchResults")
        return searchResults;
      } else {
        return designationDetailList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  },
);

export const getDesignationViewData = createAsyncThunk(
  GET_DESIGNATION_VIEW,
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

export const getDesignationPatchData = createAsyncThunk(
  GET_DESIGNATION_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

