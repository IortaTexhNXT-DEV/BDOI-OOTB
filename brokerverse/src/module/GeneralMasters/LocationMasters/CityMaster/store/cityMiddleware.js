import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_CITY_DETAILS,
  GET_CITY_BY_ID,
  POST_ADD_CITY,
  PATCH_CITY_EDIT,
  GET_SERACH_CITY,

} from "../../../../../redux/actionTypes";

export const getCityMiddleware = createAsyncThunk(
  GET_CITY_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getCityListByIdMiddleware = createAsyncThunk(
  GET_CITY_BY_ID,
  async (payload, { rejectWithValue }) => {
    console.log(payload,"getCityListByIdMiddleware");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postAddCityMiddleware = createAsyncThunk(
  POST_ADD_CITY,
  async (payload, { rejectWithValue }) => {
    console.log(payload,"postAddCityMiddleware");
    const tableData = {
      "Citycode": payload?.CityCode,
      "CityName": payload?.CityName,
      "State": payload?.State,
      "Modifiedby": payload?.Modifiedby,
      "ModifiedOn": payload?.ModifiedOn
    }
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return tableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchCityEditMiddleware = createAsyncThunk(
  PATCH_CITY_EDIT,
  async (payload, { rejectWithValue }) => {
    console.log(payload,"patchCityEditMiddleware");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const getSearchCityMiddleware = createAsyncThunk(
  GET_SERACH_CITY,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { cityReducers } = getState();

    const { cityTableList } = cityReducers;
    console.log(cityTableList, "1234")

    try {
      if (textSearch.trim() !== "") {
        const searchResults = cityTableList.filter(item => {
          return item.CityName.toLowerCase().includes(textSearch.toLowerCase())
        });
        console.log(searchResults, "searchResults")
        return searchResults;
      } else {
        return cityTableList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  },
);


