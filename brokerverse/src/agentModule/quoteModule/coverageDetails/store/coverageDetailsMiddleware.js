import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_COVERAGE_DETAILS,
  POST_POLICY_RENEWAL_COVERAGE,
} from "../../../../redux/agentActionTypes";
import {
  GET_POLICY_RENEWAL_COVERAGE,
  GET_POLICY_RENEWAL_COVERAGE_FAILURE,
  GET_POLICY_RENEWAL_COVERAGE_SUCCESS,
} from "../../../../redux/actionTypes";
import policyService from "../../../../services/policyService";

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    if (!normalized) {
      return null;
    }

    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const filterNullish = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== null && value !== undefined
    )
  );

const resolveRenewalRecordId = (record = {}) =>
  record?.id || record?._id || record?.renewalId || record?.renewalID || null;

const buildCoverageDetailsPayload = (formValues = {}) => {
  // Handle both PascalCase (from frontend forms) and camelCase formats
  const payload = {
    lossAndDamageCoverage:
      formValues?.lossAndDamageCoverage || formValues?.LossandDamagecoverage,
    lossAndDamageCoverageRate:
      formValues?.lossAndDamageCoverageRate ||
      formValues?.LossandDamagecoverageRate,
    lossAndDamageCoveragePremium:
      formValues?.lossAndDamageCoveragePremium ||
      formValues?.LossandDamagecoveragepremium,
    actsOfNatureRate:
      formValues?.actsOfNatureRate || formValues?.ActsofNatureRate,
    actsOfNaturePremium:
      formValues?.actsOfNaturePremium || formValues?.ActsofNaturepremium,
    roadsideAssistanceRate:
      formValues?.roadsideAssistanceRate || formValues?.RoadsideAssistanceRate,
    roadsideAssistancePremium:
      formValues?.roadsideAssistancePremium ||
      formValues?.RoadsideAssistancepremium,
    personalAccidentCoverRate:
      formValues?.personalAccidentCoverRate ||
      formValues?.PersonalAccidentCoverRate,
    personalAccidentCoverPremium:
      formValues?.personalAccidentCoverPremium ||
      formValues?.PersonalAccidentCoverpremium,
    bodilyInjury: formValues?.bodilyInjury || formValues?.BodilyInjury,
    bodilyInjuryCoveragePremium:
      formValues?.bodilyInjuryCoveragePremium ||
      formValues?.BodilyInjuryCoveragePremium,
    propertyDamage: formValues?.propertyDamage || formValues?.PropertyDamage,
    propertyDamageCoveragePremium:
      formValues?.propertyDamageCoveragePremium ||
      formValues?.PropertyDamageCoveragePremium,
    autoPassengerPersonalAccident:
      formValues?.autoPassengerPersonalAccident ||
      formValues?.AutopassengerpersonalAccident,
    APPAtotalCoverage:
      formValues?.APPAtotalCoverage || formValues?.APPATotalCoverage,
    APPAcoveragePremium:
      formValues?.APPAcoveragePremium || formValues?.APPACoveragePremium,
    totalSumInsured: formValues?.totalSumInsured || formValues?.TotalSumInsured,
  };

  return payload;
};

const buildRenewalRequestPayload = (formValues = {}, existingRecord = null) => {
  // Handle both flat and nested structures
  // If formValues has coverageDetails property, use it; otherwise treat formValues itself as coverage data
  const coverageSource = formValues.coverageDetails || formValues;
  const coverageDetails = buildCoverageDetailsPayload(coverageSource);

  const payload = {};

  if (Object.keys(coverageDetails).length) {
    payload.coverageDetails = coverageDetails;
  }

  const resolvedFieldValue = (key) => {
    if (
      formValues &&
      Object.prototype.hasOwnProperty.call(formValues, key) &&
      formValues[key] !== undefined &&
      formValues[key] !== null
    ) {
      return formValues[key];
    }

    if (
      existingRecord &&
      Object.prototype.hasOwnProperty.call(existingRecord, key) &&
      existingRecord[key] !== undefined &&
      existingRecord[key] !== null
    ) {
      return existingRecord[key];
    }

    return undefined;
  };

  const keysToSync = [
    "accessories",
    "policyLimits",
    "premiumBreakdown",
    "orderSummary",
    "effectiveDate",
    "expiryDate",
  ];

  keysToSync.forEach((key) => {
    const value = resolvedFieldValue(key);
    if (value !== undefined) {
      payload[key] = value;
    }
  });

  return payload;
};

const extractExistingRenewalRecord = (state) => {
  const renewalList =
    state?.agentCoverageDetailsReducers?.renewalCoverage?.list ?? [];

  if (!Array.isArray(renewalList)) {
    return null;
  }

  return renewalList.find((item) => item && typeof item === "object") || null;
};

export const postcoverageDetailsMiddleware = createAsyncThunk(
  POST_COVERAGE_DETAILS,
  async (payload, { rejectWithValue, getState }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const submitRenewalCoverageMiddleware = createAsyncThunk(
  POST_POLICY_RENEWAL_COVERAGE,
  async ({ policyId, formValues } = {}, { getState, rejectWithValue }) => {
    if (!policyId) {
      return rejectWithValue({
        success: false,
        error: "Policy ID is required for renewal submission",
      });
    }

    try {
      const state = getState();
      const existingRecord = extractExistingRenewalRecord(state);
      const renewalId = resolveRenewalRecordId(existingRecord);
      const requestPayload = buildRenewalRequestPayload(
        formValues,
        existingRecord
      );

      const apiResponse = renewalId
        ? await policyService.updatePolicyRenewal(renewalId, requestPayload)
        : await policyService.createPolicyRenewal(policyId, requestPayload);

      if (!apiResponse?.success) {
        return rejectWithValue(
          apiResponse || {
            success: false,
            error: "Failed to submit policy renewal coverage",
          }
        );
      }

      const rawRecord = apiResponse?.data?.data || apiResponse?.data || {};
      const coverageSource =
        rawRecord?.coverageDetails || rawRecord?.coverage || rawRecord;
      const coverage = policyService.transformRenewalCoverage(coverageSource);
      const resolvedRenewalId =
        resolveRenewalRecordId(rawRecord) || renewalId || null;

      return {
        success: true,
        message:
          apiResponse?.message ||
          (renewalId
            ? "Renewal coverage updated successfully"
            : "Renewal coverage created successfully"),
        coverage,
        renewalRecord: rawRecord,
        renewalId: resolvedRenewalId,
        isUpdate: Boolean(renewalId),
      };
    } catch (error) {
      return rejectWithValue({
        success: false,
        error: error?.message || "Failed to submit policy renewal coverage",
      });
    }
  }
);

export const getPolicyRenewalCoverageMiddleware = createAsyncThunk(
  GET_POLICY_RENEWAL_COVERAGE,
  async ({ policyId, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const response = await policyService.getPolicyRenewalCoverage({
        policyId,
        page,
        limit,
      });

      if (!response.success) {
        return rejectWithValue(response);
      }

      return response;
    } catch (error) {
      return rejectWithValue({
        error: error.message || "Failed to fetch policy renewal coverage",
        success: false,
        data: [],
        pagination: null,
      });
    }
  }
);
