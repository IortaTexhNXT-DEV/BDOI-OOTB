import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../../utility/commonServices";
import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
  GET_INSURANCE_SIGNATORIES_SEARCH_LIST,
  GET_INSURANCE_SIGNATORIES_LIST,
  POST_INSURANCE_SIGNATORIES_DATA,
  PATCH_INSURANCE_SIGNATORIES_DATA,
} from "../../../../../redux/actionTypes";

export const getInsuranceSignatoriesMiddleWare = createAsyncThunk(
  GET_INSURANCE_SIGNATORIES_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceSignatoriesReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postInsuranceSignatoriesMiddleWare = createAsyncThunk(
  POST_INSURANCE_SIGNATORIES_DATA,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find payload in midd");
    const bodyTableData = {
      id: payload?.id,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      signatoriesCode: payload?.signatoryCode,
      signatoryName: payload?.signatoryName,
      signatoryDescription: payload?.signatoryDescription,
      action: payload?.id,
    };
    console.log(bodyTableData, "find add datas in midd");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return bodyTableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchInsuranceSignatoriesMiddleWare = createAsyncThunk(
  PATCH_INSURANCE_SIGNATORIES_DATA,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find edit load");
    const { insuranceSignatoriesReducers } = getState();
    const { InsuranceSignatoriesList } = insuranceSignatoriesReducers;
    console.log(InsuranceSignatoriesList, "find original data");
    const updatedData = InsuranceSignatoriesList?.map((item) => {
      if (parseInt(item.id) === parseInt(payload?.id)) {
        return {
          ...item,
          signatoriesCode: payload?.signatoryCode,
          signatoryName: payload?.signatoryName,
          signatoryDescription: payload?.signatoryDescription,
        };
      }
      return item;
    });
    console.log(updatedData, "find updatedData");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return updatedData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getSearchInsuranceSignatoriesMiddleware = createAsyncThunk(
  GET_INSURANCE_SIGNATORIES_SEARCH_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { insuranceSignatoriesReducers } = getState();

    const { InsuranceSignatoriesList } = insuranceSignatoriesReducers;
    console.log(InsuranceSignatoriesList, "1234");

    try {
      if (textSearch.trim() !== "") {
        const searchResults = InsuranceSignatoriesList?.filter((item) => {
          return item.signatoriesCode
            .toLowerCase()
            .includes(textSearch.toLowerCase());
        });
        console.log(searchResults, "searchResults");
        return searchResults;
      } else {
        return InsuranceSignatoriesList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
