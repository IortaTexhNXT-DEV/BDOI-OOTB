import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../../utility/commonServices";
import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
  GET_HIERARCHY_DETAILS,
  GET_HIERARCHY_BY_ID,
  POST_ADD_HIERARCHY,
  PATCH_HIERARCHY_EDIT,
  GET_SERACH_HIERARCHY,
  GET_HIERARCHY_VIEW_DETAILS,
  GET_HIERARCHY_PATCH_DETAILS,
} from "../../../../../redux/actionTypes";
import moment from "moment";

export const getHirarchyListMiddleware = createAsyncThunk(
  GET_HIERARCHY_DETAILS,
  async (payload, { rejectWithValue, getState }) => {
    const { hierarchyTableReducers } = getState();
    console.log(hierarchyTableReducers, "dta");
    const { hierarchTableList } = hierarchyTableReducers;
    // const filteredData = receiptsTableList.filter((item) => item.id === 1);

    try {
      return hierarchTableList
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getHirarchyListByIdMiddleware = createAsyncThunk(
  GET_HIERARCHY_BY_ID,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "dashs")
    try {
      const { hierarchyTableReducers } = getState();
      const { hierarchTableList } = hierarchyTableReducers;
      const filteredData = hierarchTableList.filter((item) => item.id == payload);
      console.log(filteredData, "dta");

      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return filteredData[0];
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddHirarchyMiddleware = createAsyncThunk(
  POST_ADD_HIERARCHY,
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { hierarchyTableReducers } = getState();
      const { hierarchTableList } = hierarchyTableReducers;
      let output = {
        ...payload,
        id: hierarchTableList?.length + 1, modifiedBy: "Justin",
        modifiedOn: moment().format('DD/MM/YYYY'),
        status: "",
        action: ""
      }
      console.log(output, "output")
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return output;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchHirarchyEditMiddleware = createAsyncThunk(
  PATCH_HIERARCHY_EDIT,
  async (payload, { rejectWithValue, getState }) => {
    const data = {
      id:payload?.id,
      rankCode: payload?.rankCode,
      rankName: payload?.rankName,
      description: "description",
      levelNumber: payload?.levelNumber,
      modifiedBy: payload?.modifiedBy,
      modifiedOn: moment().format("DD/MM/YYYY"),
    }
    try {
      console.log(data, "kkkkkk");
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getSearchHirarchyMiddleware = createAsyncThunk(
  GET_SERACH_HIERARCHY,
  async (payload, { rejectWithValue, getState }) => {
    const textSearch = payload;
    console.log(textSearch, "textSearch")
    const { hierarchyTableReducers } = getState();

    const { hierarchTableList } = hierarchyTableReducers;

    try {
      const searchResults = hierarchTableList.filter(item => {
        return item.rankName.toLowerCase().includes(textSearch.toLowerCase());
      });
      console.log(searchResults, "searchResults")
      return searchResults;


    }
    catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getHierarchyViewMiddleWare = createAsyncThunk(
  GET_HIERARCHY_VIEW_DETAILS,
  async (payload, { rejectWithValue, getState }) => {

    try {
      return payload
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getHierarchyPatchMiddleWare = createAsyncThunk(
  GET_HIERARCHY_PATCH_DETAILS,
  async (payload, { rejectWithValue, getState }) => {

    try {
      return payload
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

