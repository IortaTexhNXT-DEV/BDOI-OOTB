import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../../utility/commonServices";
import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
  GET_INSURANCE_COVER_SEARCH_LIST,
  GET_INSURANCE_COVER_LIST,
  POST_INSURANCE_COVER_DATA,
  PATCH_INSURANCE_COVER_DATA,
} from "../../../../../redux/actionTypes";

export const getInsuranceCoverMiddleWare = createAsyncThunk(
  GET_INSURANCE_COVER_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceCoverReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postInsuranceCoverMiddleWare = createAsyncThunk(
  POST_INSURANCE_COVER_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const bodyTableData = {
      id: payload?.id,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      policyType: "policyType",
      Status: 0,
      coverCode: payload?.coverCode,
      coverName: payload?.coverName,
      coverDescription: payload?.coverDescription,
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
export const patchInsuranceCoverMiddleWare = createAsyncThunk(
  PATCH_INSURANCE_COVER_DATA,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find edit load");
    const { insuranceCoverReducers } = getState();
    const { InsuranceCoverList } = insuranceCoverReducers;
    console.log(InsuranceCoverList, "find original data");
    const updatedData = InsuranceCoverList?.map((item) => {
      if (parseInt(item.id) === parseInt(payload?.id)) {
        return {
          ...item,
          coverCode: payload?.coverCode,
          coverName: payload?.coverName,
          coverDescription: payload?.coverDescription,
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
export const getSearchInsuranceCoverMiddleware = createAsyncThunk(
  GET_INSURANCE_COVER_SEARCH_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { insuranceCoverReducers } = getState();

    const { InsuranceCoverList } = insuranceCoverReducers;
    console.log(InsuranceCoverList, "1234");

    try {
      if (textSearch.trim() !== "") {
        const searchResults = InsuranceCoverList?.filter((item) => {
          return item.coverCode
            .toLowerCase()
            .includes(textSearch.toLowerCase());
        });
        console.log(searchResults, "searchResults");
        return searchResults;
      } else {
        return InsuranceCoverList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
