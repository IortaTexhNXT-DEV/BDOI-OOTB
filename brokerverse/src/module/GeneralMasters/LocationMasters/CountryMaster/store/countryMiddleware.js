import { createAsyncThunk } from "@reduxjs/toolkit";
// import { getRequest } from "../../../utility/commonServices";
// import { APIROUTES } from "../../../routes/apiRoutes";
import {
  GET_COUNTRY_DETAILS,
  GET_COUNTRY_BY_ID,
  POST_ADD_COUNTRY,
  PATCH_COUNTRY_EDIT,
  GET_SERACH_COUNTRY,

} from "../../../../../redux/actionTypes";

export const getCountryMiddleware = createAsyncThunk(
  GET_COUNTRY_DETAILS,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getCountryListByIdMiddleware = createAsyncThunk(
  GET_COUNTRY_BY_ID,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "getCountryListByIdMiddleware");
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getSearchCountryMiddleware = createAsyncThunk(
  GET_SERACH_COUNTRY,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { countryReducers } = getState();

    const { countryTableList } = countryReducers;
    console.log(countryTableList, "1234")

    try {
      if (textSearch.trim() !== "") {
        const searchResults = countryTableList.filter(item => {
          return item.CountryName.toLowerCase().includes(textSearch.toLowerCase())
        });
        console.log(searchResults, "searchResults")
        return searchResults;
      } else {
        return countryTableList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  },
);
export const postAddCountryMiddleware = createAsyncThunk(
  POST_ADD_COUNTRY,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "postAddCountryMiddleware");

    const dataTable = {
      "CountryName": payload.CountryName,
      "ISOCode": payload.ISOCode,
      Description: payload?.Description,
      "PhoneCode": payload.PhoneCode,
      "Modifiedby": payload.Modifiedby,
      "ModifiedOn": payload.ModifiedOn
    }
    console.log(dataTable, "dataTable")
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return dataTable;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchCountryEditMiddleware = createAsyncThunk(
  PATCH_COUNTRY_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);



