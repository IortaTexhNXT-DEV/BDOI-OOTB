import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POLICY_LIST_DATA,
  POLICY_SEARCH_DATA,
  POLICY_DETAILS_DATA,
} from "../../../redux/actionTypes";
import policyService from "../../../services/policyService";
import SvgMotorTable from "../../../assets/agentIcon/SvgMotorTable";
import SvgDot from "../../../assets/icons/SvgDot";

/**
 * Extract policies array and pagination from API response.
 * Handles multiple response structures:
 * - { data: [], total, page?, pageSize? }
 * - { data: { data: [], total, page?, pageSize? } } (nested)
 * - { results: [], total } or { content: [], totalElements }
 */
export function extractPolicyListFromResponse(apiResponse, requestPage = 1, requestPageSize = 10) {
  const data = apiResponse?.data;
  let policies = [];
  let total = 0;
  let page = requestPage;
  let pageSize = requestPageSize;

  // Case 1: Double-nested - { data: { data: [], total, page?, pageSize? } }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = data;
    policies = Array.isArray(inner.data)
      ? inner.data
      : Array.isArray(inner.policies)
        ? inner.policies
        : Array.isArray(inner.results)
          ? inner.results
          : Array.isArray(inner.content)
            ? inner.content
            : [];
    total = inner.total ?? inner.totalElements ?? inner.count ?? policies.length;
    page = inner.page ?? requestPage;
    pageSize = inner.pageSize ?? inner.size ?? requestPageSize;
  }
  // Case 2: Direct - { data: [], total, page?, pageSize? }
  else if (Array.isArray(data)) {
    policies = data;
    total = apiResponse?.total ?? apiResponse?.totalElements ?? apiResponse?.count ?? policies.length;
    page = apiResponse?.page ?? requestPage;
    pageSize = apiResponse?.pageSize ?? apiResponse?.size ?? requestPageSize;
  }
  // Case 3: Alternative top-level keys
  else if (Array.isArray(apiResponse?.results)) {
    policies = apiResponse.results;
    total = apiResponse.total ?? apiResponse.count ?? policies.length;
    page = apiResponse.page ?? requestPage;
    pageSize = apiResponse.pageSize ?? apiResponse.size ?? requestPageSize;
  } else if (Array.isArray(apiResponse?.content)) {
    policies = apiResponse.content;
    total = apiResponse.totalElements ?? apiResponse.total ?? policies.length;
    page = apiResponse.page ?? apiResponse.number ?? requestPage;
    pageSize = apiResponse.size ?? apiResponse.pageSize ?? requestPageSize;
  }
  // Case 4: Response is the array itself
  else if (Array.isArray(apiResponse)) {
    policies = apiResponse;
    total = apiResponse.length;
  }

  return { policies, total, page, pageSize };
}

export const policyListDataMiddleWare = createAsyncThunk(
  POLICY_LIST_DATA,
  async ({ page = 1, pageSize = 10, filters = {} } = {}, { rejectWithValue }) => {
    try {
      const response = await policyService.getPolicies(page, pageSize, filters);

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      const apiData = response.data;
      const { policies, total, page: respPage, pageSize: respPageSize } = extractPolicyListFromResponse(
        apiData,
        page,
        pageSize
      );

      if (!Array.isArray(policies)) {
        return rejectWithValue("Invalid API response: policies data is not an array");
      }

      // Transform API data to match frontend format
      const transformedData = policies.map((policy) => {
        const transformed = policyService.transformPolicyData(policy);
        return {
          ...transformed,
          Actions: <SvgDot />,
          Svg: <SvgMotorTable />,
        };
      });

      // Calculate pagination info (use request params as fallback when response lacks them)
      const effectivePageSize = respPageSize || pageSize;
      const totalPages = effectivePageSize > 0 ? Math.ceil((total || 0) / effectivePageSize) : 0;

      return {
        transformedData,
        rawData: policies,
        pagination: {
          page: respPage || page,
          pageSize: effectivePageSize,
          total: total ?? transformedData.length,
          totalPages,
        },
      };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch policies");
    }
  }
);

export const policyListSerachDataMiddleWare = createAsyncThunk(
  POLICY_SEARCH_DATA,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { policyMainReducers } = getState();
    const { rawApiData } = policyMainReducers;

    try {
      // Use the policy service search function
      const filteredPolicies = policyService.searchPolicies(
        field,
        value,
        rawApiData
      );

      // Transform the filtered results to match frontend format
      const transformedData = filteredPolicies.map((policy) => {
        const transformed = policyService.transformPolicyData(policy);
        return {
          ...transformed,
          Actions: <SvgDot />,
          Svg: <SvgMotorTable />,
        };
      });

      return transformedData;
    } catch (error) {
      return rejectWithValue(error.message || "Search failed");
    }
  }
);

export const policyDetailsDataMiddleWare = createAsyncThunk(
  POLICY_DETAILS_DATA,
  async ({ policyId }, { rejectWithValue }) => {
    try {
      const response = await policyService.getPolicyDetails(policyId);

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      const policyData = response.data;

      // Transform the policy data to match frontend format
      const transformedData = policyService.transformPolicyData(policyData);

      return {
        policyDetails: transformedData,
        rawPolicyData: policyData,
      };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch policy details");
    }
  }
);
