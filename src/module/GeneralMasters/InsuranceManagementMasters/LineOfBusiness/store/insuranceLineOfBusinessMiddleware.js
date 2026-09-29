import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../../utility/commonServices";
import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
  GET_INSURANCE_LIST_OF_BUSINESS_SEARCH_LIST,
  GET_INSURANCE_LIST_OF_BUSINESS_LIST,
  POST_INSURANCE_LIST_OF_BUSINESS_DATA,
  PATCH_INSURANCE_LIST_OF_BUSINESS_DATA,
} from "../../../../../redux/actionTypes";

export const getInsurancelineOfBusinessListMiddleWare = createAsyncThunk(
  GET_INSURANCE_LIST_OF_BUSINESS_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceLineOfBusinessReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postInsurancelineOfBusinessMiddleWare = createAsyncThunk(
  POST_INSURANCE_LIST_OF_BUSINESS_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const bodyTableData = {
      id: payload?.id,
      businessCode: payload?.lineofBusinessCode,
      LOBName: payload?.LOBName,
      description: payload?.LOBDescription,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
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
export const patchInsurancelineOfBusinessMiddleWare = createAsyncThunk(
  PATCH_INSURANCE_LIST_OF_BUSINESS_DATA,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find edit load");
    const { insuranceLineOfBusinessReducers } = getState();
    const { InsuranceLineOfBusinessList } = insuranceLineOfBusinessReducers;
    console.log(InsuranceLineOfBusinessList, "find original data");
    const updatedData = InsuranceLineOfBusinessList?.map((item) => {
      if (parseInt(item.id) === parseInt(payload?.id)) {
        return {
          ...item,
          businessCode: payload?.lineofBusinessCode,
          LOBName: payload?.LOBName,
          description: payload?.LOBDescription,
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
export const getSearchInsurancelineOfBusinessMiddleware = createAsyncThunk(
  GET_INSURANCE_LIST_OF_BUSINESS_SEARCH_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { insuranceLineOfBusinessReducers } = getState();

    const { InsuranceLineOfBusinessList } = insuranceLineOfBusinessReducers;
    console.log(InsuranceLineOfBusinessList, "1234");

    try {
      if (textSearch.trim() !== "") {
        const searchResults = InsuranceLineOfBusinessList?.filter((item) => {
          return item.businessCode
            .toLowerCase()
            .includes(textSearch.toLowerCase());
        });
        console.log(searchResults, "searchResults");
        return searchResults;
      } else {
        return InsuranceLineOfBusinessList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
