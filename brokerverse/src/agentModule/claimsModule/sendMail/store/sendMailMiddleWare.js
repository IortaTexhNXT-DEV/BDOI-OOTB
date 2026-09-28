import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_SENT_MAIL_DATA,
  STORE_CLAIM_RESPONSE_DATA,
} from "../../../../redux/actionTypes";
import claimsService from "../../../../services/claimsService";
import { isFireLob } from "../../../endorsementModule/constants/endorsementCategories";

// Action to store claim response data
export const storeClaimResponseData = createAsyncThunk(
  STORE_CLAIM_RESPONSE_DATA,
  async (claimResponseData, { rejectWithValue }) => {
    try {
      console.log("=== STORING CLAIM RESPONSE DATA ===");
      console.log("Claim Response Data:", claimResponseData);
      console.log("=== END STORING CLAIM RESPONSE DATA ===");

      return claimResponseData;
    } catch (error) {
      console.error("Error storing claim response data:", error);
      return rejectWithValue(
        error.message || "Failed to store claim response data"
      );
    }
  }
);

export const postSendData = createAsyncThunk(
  POST_SENT_MAIL_DATA,
  async (payload, { rejectWithValue, getState, dispatch }) => {
    console.log(payload, "payload");

    try {
      // Get claim details from Redux state
      const state = getState();
      const claimDetailsData =
        state?.claimDetailsMainReducers?.claimDetailsViewData || {};
      const claimThirdPartyData =
        state?.claimDetailsMainReducers?.claimThirdParty || {};

      // Console logs to check Redux state data
      console.log("=== SEND MAIL MIDDLEWARE REDUX STATE ===");
      console.log("Claim Details Data:", claimDetailsData);
      console.log("Claim Third Party Data:", claimThirdPartyData);
      console.log("Payload from form:", payload);
      console.log("=== END SEND MAIL MIDDLEWARE REDUX STATE ===");

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
        isPolicyHolderTheDriver: "false", // Default value, can be made dynamic
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
            console.warn("Error getting user data from localStorage:", error);
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
        claimType: isFireLob(claimDetailsData.productType)
          ? "Fire"
          : "Motor",
        claimPriority: "High",
        dateOfIncident:
          claimThirdPartyData.dateOfIncident ||
          new Date().toISOString().split("T")[0],
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
        isCoInsurance: Boolean(claimDetailsData.isCoInsurance),
        leadRefId: claimThirdPartyData.leadRefId || "LEAD-001",
        quoteRefId: claimThirdPartyData.quoteRefId || "QUOTE-001",
        policyRefId: claimThirdPartyData.policyRefId || "POLICY-001",
        policyInfo: {
          insuranceCompanyName: claimDetailsData.InsuranceCompanyName || "",
          policyNumber: claimDetailsData.policyNumber || "",
          policyHolderName: claimDetailsData.PolicyHolderName || "",
          houseNo: claimDetailsData.HouseNo || "",
          barangay: claimDetailsData.Barangay || "",
          countryName: claimDetailsData.CountryName || "",
          province: claimDetailsData.Province || "",
          cityName: claimDetailsData.CityName || "",
          zipCode: claimDetailsData.ZipCode || "",
        },
        thirdPartyDetails,
        ...(!isFire
          ? {}
          : {
              driverDetails: {
                driverName:
                  claimThirdPartyData.driverName ||
                  claimDetailsData.PolicyHolderName ||
                  "",
                driverHouseNo:
                  claimThirdPartyData.driverHouseNo ||
                  claimDetailsData.HouseNo ||
                  "",
                driverBarangay:
                  claimThirdPartyData.driverBarangay ||
                  claimDetailsData.Barangay ||
                  "",
                driverCountry:
                  claimThirdPartyData.driverCountry ||
                  claimDetailsData.CountryName ||
                  "",
                driverProvince:
                  claimThirdPartyData.driverProvince ||
                  claimDetailsData.Province ||
                  "",
                driverCity:
                  claimThirdPartyData.driverCity ||
                  claimDetailsData.CityName ||
                  "",
                driverZipCode:
                  claimThirdPartyData.driverZipCode ||
                  claimDetailsData.ZipCode ||
                  "",
              },
            }),
        emailData: {
          mailSubject: payload.mailSubject || "New Claim Notification",
          write:
            payload.write ||
            "Please find attached the claim documents for review.",
        },
        claimDocument: payload.file || null,
      };

      console.log("API Payload:", apiPayload);
      console.log("Third Party Details Mapping:", {
        original: claimThirdPartyData,
        mapped: apiPayload.thirdPartyDetails,
      });

      // Call the claims service
      const result = await claimsService.createClaim(apiPayload);

      console.log("=== CLAIMS SERVICE RESULT ===");
      console.log("Result Success:", result.success);
      console.log("Result Data:", result.data);
      console.log("Result Error:", result.error);
      console.log("=== END CLAIMS SERVICE RESULT ===");

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

        console.log("=== CLAIM CREATED SUCCESSFULLY ===");
        console.log("Claim Response Data:", claimResponseData);
        console.log("=== END CLAIM CREATED SUCCESSFULLY ===");

        // Dispatch action to store claim response data
        dispatch(storeClaimResponseData(claimResponseData));

        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      console.error("Create claim middleware error:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);
