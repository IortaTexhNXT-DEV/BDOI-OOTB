import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_SENT_MAIL_DATA,
  STORE_CLAIM_RESPONSE_DATA,
} from "../../../../redux/actionTypes";
import claimsService from "../../../../services/claimsService";
import { isFireLob } from "../../../endorsementModule/constants/endorsementCategories";
import logger from "../../../../utility/logger";

// Action to store claim response data
export const storeClaimResponseData = createAsyncThunk(
  STORE_CLAIM_RESPONSE_DATA,
  async (claimResponseData, { rejectWithValue }) => {
    try {
      return claimResponseData;
    } catch (error) {
      return rejectWithValue(
        error.message || "Failed to store claim response data"
      );
    }
  }
);

export const postSendData = createAsyncThunk(
  POST_SENT_MAIL_DATA,
  async (payload, { rejectWithValue, getState, dispatch }) => {
    try {
      // Get claim details from Redux state
      const state = getState();
      const claimDetailsData =
        state?.claimDetailsMainReducers?.claimDetailsViewData || {};
      const claimThirdPartyData =
        state?.claimDetailsMainReducers?.claimThirdParty || {};

      const isFire =
        claimDetailsData.lob === "FIRE" ||
        claimThirdPartyData.lob === "FIRE" ||
        isFireLob(claimDetailsData.productType);

      // Third party details: for Fire, omit vehicle fields (plate, unit, shop)
      const thirdPartyDetails = {
        thirdPartyName: claimThirdPartyData.name || "",
        thirdPartyContactNumber: claimThirdPartyData.contactNumber || "",
        thirdPartyPolicyNumber: claimThirdPartyData.policyNumber || "",
        thirdPartyInsuranceCompanyName:
          claimThirdPartyData.InsuranceCompanyN || "",
        witnessName: payload.witnessName || "",
        witnessContact: payload.witnessContact || "",
      };
      if (!isFire) {
        thirdPartyDetails.thirdPartyPlateNumber =
          claimThirdPartyData.plateNumber || "";
        thirdPartyDetails.thirdPartyUnit = claimThirdPartyData.unit || "";
        thirdPartyDetails.thirdPartyShop = claimThirdPartyData.shop || "";
      }

      // Prepare the API payload structure
      const apiPayload = {
        isPolicyHolderTheDriver: claimThirdPartyData.isPolicyHolderTheDriver
          ? "true"
          : "false",
        policyNumber:
          claimDetailsData.policyNumber || payload.policyNumber || "",
        createdBy: (() => {
          try {
            const userData = JSON.parse(localStorage.getItem("user") || "{}");
            return (
              userData?.username ||
              userData?.name ||
              userData?.employeeCode ||
              "admin"
            );
          } catch (error) {
            logger.warn("Error getting user data from localStorage:", error);
            return "admin";
          }
        })(),
        lob:
          claimDetailsData.lob ||
          claimThirdPartyData.lob ||
          (isFireLob(claimDetailsData.productType) ? "FIRE" : "MOTOR") ||
          "MOTOR",
        reportedDate: new Date().toISOString(),
        claimStatus: "Pending",
        // claim type: the line of business (server default); the documents follow the cause of loss
        claimPriority: "High",
        // entered on the claim form (required there); never defaulted to today
        dateOfIncident: claimThirdPartyData.dateOfIncident || null,
        timeOfIncident:
          claimThirdPartyData.timeOfIncident ||
          new Date().toTimeString().slice(0, 5),
        addressOfIncident:
          claimThirdPartyData.addressOfIncident ||
          claimDetailsData.HouseNo ||
          "",
        cityOfIncident:
          claimThirdPartyData.cityOfIncident ||
          claimDetailsData.CityName ||
          "",
        provinceOfIncident:
          claimThirdPartyData.provinceOfIncident ||
          claimDetailsData.Province ||
          "",
        typeOfIncident:
          claimThirdPartyData.typeOfIncident ||
          (isFireLob(claimDetailsData.productType) ? "Fire" : "Collision"),
        estimatedClaimAmount:
          claimThirdPartyData.estimatedClaimAmount || null,
        insuranceCompanyClaimNumber:
          claimThirdPartyData.insuranceCompanyClaimNumber || "",
        fnolSource: claimThirdPartyData.fnolSource || "",
        lossExtent: claimThirdPartyData.lossExtent || "",
        confirmDuplicate: payload.confirmDuplicate ? "true" : "",
        isCoInsurance: Boolean(claimDetailsData.isCoInsurance),
        leadRefId: claimThirdPartyData.leadRefId || null,
        quoteRefId: claimThirdPartyData.quoteRefId || null,
        policyRefId: claimThirdPartyData.policyRefId || null,
        policyInfo: {
          insuranceCompanyName:
            claimDetailsData.InsuranceCompanyName ||
            claimThirdPartyData.InsuranceCompanyName ||
            "",
          policyNumber:
            claimDetailsData.policyNumber ||
            claimThirdPartyData.policyNumber ||
            "",
          policyHolderName:
            claimDetailsData.PolicyHolderName ||
            claimThirdPartyData.PolicyHolderName ||
            "",
          houseNo:
            claimDetailsData.HouseNo || claimThirdPartyData.HouseNo || "",
          barangay:
            claimDetailsData.Barangay || claimThirdPartyData.Barangay || "",
          countryName:
            claimDetailsData.CountryName ||
            claimThirdPartyData.CountryName ||
            "",
          province:
            claimDetailsData.Province || claimThirdPartyData.Province || "",
          cityName:
            claimDetailsData.CityName || claimThirdPartyData.CityName || "",
          zipCode:
            claimDetailsData.ZipCode || claimThirdPartyData.ZipCode || "",
          roadThanon:
            claimDetailsData.RoadThanon ||
            claimThirdPartyData.RoadThanon ||
            "",
          soiAlley:
            claimDetailsData.SoiAlley || claimThirdPartyData.SoiAlley || "",
          mooVillage:
            claimDetailsData.MooVillage ||
            claimThirdPartyData.MooVillage ||
            "",
        },
        thirdPartyDetails,
        ...(!isFire
          ? {
              driverDetails: {
                driverName: claimThirdPartyData.driverName || "",
                driverHouseNo: claimThirdPartyData.driverHouseNo || "",
                driverBarangay: claimThirdPartyData.driverBarangay || "",
                driverCountry: claimThirdPartyData.driverCountry || "",
                driverProvince: claimThirdPartyData.driverProvince || "",
                driverCity: claimThirdPartyData.driverCity || "",
                driverZipCode: claimThirdPartyData.driverZipCode || "",
                driverRoadThanon: claimThirdPartyData.driverRoadThanon || "",
                driverSoiAlley: claimThirdPartyData.driverSoiAlley || "",
                driverMooVillage: claimThirdPartyData.driverMooVillage || "",
              },
            }
          : {}),
        emailData: {
          mailSubject: payload.mailSubject || "New Claim Notification",
          write:
            payload.write ||
            "Please find attached the claim documents for review.",
        },
        claimDocument: payload.file || null,
      };

      // Call the claims service
      const result = await claimsService.createClaim(apiPayload);

      if (result.success) {
        // Store claim response data in Redux
        const claimData =
          result.data.data?.claim || result.data.data || result.data;
        const claimResponseData = {
          claimNumber:
            claimData.claimNumber || claimData.claim_number || claimData.id,
          claimId: claimData.id || claimData.claimId || claimData.claim_id,
          fullResponse: result.data,
        };

        // Dispatch action to store claim response data
        dispatch(storeClaimResponseData(claimResponseData));

        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);
