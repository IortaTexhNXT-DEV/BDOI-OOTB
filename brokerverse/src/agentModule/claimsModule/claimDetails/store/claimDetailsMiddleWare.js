import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_CLAIM_DETAILS_VIEW_DATA,
  POST_CLAIM_DETAILS_DATA,
} from "../../../../redux/actionTypes";
import policyService from "../../../../services/policyService";
import leadService from "../../../../services/leadService";
import claimsService from "../../../../services/claimsService";
import { isFireLob } from "../../../endorsementModule/constants/endorsementCategories";
import { normalizeCountryName } from "../../../../utility/addressHelpers";

/**
 * Map productType/lob to API LOB value (MOTOR | FIRE)
 */
export const mapToApiLob = (lobOrProductType) => {
  if (!lobOrProductType) return "MOTOR";
  return isFireLob(lobOrProductType) ? "FIRE" : "MOTOR";
};

export const getClaimDetailsViewData = createAsyncThunk(
  GET_CLAIM_DETAILS_VIEW_DATA,
  async (payload, { rejectWithValue }) => {
    console.log("=== GET CLAIM DETAILS VIEW DATA ===");
    console.log("Payload received:", payload);

    try {
      const { policyRefId, leadRefId, lob: navLob } = payload;

      // Fetch policy details if policyRefId is available and not default
      let policyData = null;
      if (policyRefId && policyRefId !== "POLICY-001") {
        console.log("Fetching policy details for policyId:", policyRefId);
        const policyResult = await policyService.getPolicyDetails(policyRefId);
        if (policyResult.success) {
          policyData = policyResult.data;
          console.log("Policy details fetched successfully:", policyData);
        } else {
          console.warn("Failed to fetch policy details:", policyResult.error);
        }
      } else {
        console.log(
          "Skipping policy details fetch - using default or invalid ID:",
          policyRefId
        );
      }

      // Fetch lead details if leadRefId is available and not default
      let leadData = null;
      if (leadRefId && leadRefId !== "LEAD-001") {
        console.log("Fetching lead details for leadId:", leadRefId);
        const leadResult = await leadService.getLeadById(leadRefId);
        if (leadResult.success) {
          leadData = leadResult.data;
          console.log("Lead details fetched successfully:", leadData);
        } else {
          console.warn("Failed to fetch lead details:", leadResult.error);
        }
      } else {
        console.log(
          "Skipping lead details fetch - using default or invalid ID:",
          leadRefId
        );
      }

      // Derive LOB from policy, lead, or navigation state (default: Motor)
      const productType =
        policyData?.productType ||
        policyData?.quotation?.productType ||
        policyData?.data?.productType ||
        policyData?.data?.quotation?.productType ||
        leadData?.productType ||
        navLob ||
        "Motor";
      const lob = mapToApiLob(productType);

      const participants =
        policyData?.quotation?.participantDetails ||
        policyData?.participantDetails ||
        [];
      const isCoInsurance = Boolean(
        policyData?.isCoInsurance || policyData?.quotation?.isCoInsurance
      );

      // Holder address: the CLIENT record of the policy first (endorsements update it), then the policy's own
      // address, then the lead the policy came from. One source is taken whole so parts of two addresses never mix.
      const policyRecord =
        policyData?.data && !policyData?.policyNumber ? policyData.data : policyData;
      const addressKeys = ["houseNo", "barangay", "country", "province", "city", "zipCode"];
      const holderAddress =
        [
          policyRecord?.client,
          policyRecord?.address,
          leadData,
          policyRecord?.lead,
        ].find(
          (src) =>
            src && addressKeys.some((k) => String(src[k] ?? "").trim() !== "")
        ) || {};
      const holderClient = policyRecord?.client || null;
      const holderFullName = (src) =>
        src?.firstName && src?.lastName
          ? `${src.firstName} ${src.lastName}`
          : src?.firstName || "";

      // Combine the data
      const combinedData = {
        ...payload,
        policyData,
        leadData,
        productType,
        lob,
        // Map policy data to claim details format
        InsuranceCompanyName:
          policyData?.insuranceCompanyName || policyData?.companyName || "",
        policyNumber: policyData?.policyNumber || "",
        PolicyHolderName:
          policyData?.policyHolderName ||
          policyData?.holderName ||
          holderClient?.displayName ||
          holderFullName(holderClient) ||
          holderFullName(leadData) ||
          policyRecord?.insuredName ||
          "",
        HouseNo: holderAddress.houseNo || "",
        Barangay: holderAddress.barangay || "",
        CountryName: holderAddress.country || "",
        Province: holderAddress.province || "",
        CityName: holderAddress.city || "",
        ZipCode: holderAddress.zipCode || "",
        RoadThanon: holderAddress.roadThanon || "",
        SoiAlley: holderAddress.soiAlley || "",
        MooVillage: holderAddress.mooVillage || "",
        isCoInsurance,
        participatingInsurersCount: participants.length,
      };

      // Normalize country for address API dropdown matching
      combinedData.CountryName = normalizeCountryName(combinedData.CountryName);

      console.log("Combined data for claim details:", combinedData);
      console.log("=== END GET CLAIM DETAILS VIEW DATA ===");

      // Log specific policy details that should be displayed
      console.log("=== POLICY DETAILS FOR DISPLAY ===");
      console.log(
        "Policy Holder Name for display:",
        combinedData.PolicyHolderName
      );
      console.log("Policy Number for display:", combinedData.policyNumber);
      console.log(
        "Insurance Company for display:",
        combinedData.InsuranceCompanyName
      );
      console.log("=== END POLICY DETAILS FOR DISPLAY ===");

      return combinedData;
    } catch (error) {
      console.error("Error in getClaimDetailsViewData:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);

export const getClaimDetailsForEdit = createAsyncThunk(
  "GET_CLAIM_DETAILS_FOR_EDIT",
  async (claimId, { rejectWithValue }) => {
    console.log("=== GET CLAIM DETAILS FOR EDIT ===");
    console.log("Claim ID:", claimId);
    console.log("=== END GET CLAIM DETAILS FOR EDIT ===");

    try {
      console.log("=== CALLING CLAIMS SERVICE ===");
      const result = await claimsService.getClaimDetails(claimId);
      console.log("=== CLAIMS SERVICE RESULT ===");
      console.log("Result success:", result.success);
      console.log("Result data:", result.data);
      console.log("=== END CLAIMS SERVICE RESULT ===");

      if (result.success) {
        const claimData = result.data.data; // Access the nested data
        console.log("=== CLAIM DATA STRUCTURE ===");
        console.log("Full claim data:", claimData);
        console.log("Claim data keys:", Object.keys(claimData));
        console.log("Policy data:", claimData.policy);
        console.log("Driver data:", claimData.driver);
        console.log("Third party data:", claimData.thirdPartyDetails);
        console.log("Direct claim fields:", {
          policyNumber: claimData.policyNumber,
          insuranceCompanyName: claimData.insuranceCompanyName,
          policyHolderName: claimData.policyHolderName,
          driverName: claimData.driverName,
          houseNo: claimData.houseNo,
          barangay: claimData.barangay,
          country: claimData.country,
          province: claimData.province,
          city: claimData.city,
          zipCode: claimData.zipCode,
        });
        console.log("All possible insurance company sources:", {
          claimDataInsuranceCompany: claimData.insuranceCompanyName,
          policyInsuranceCompany: claimData.policy?.insuranceCompanyName,
          quotationInsuranceCompany: claimData.quotation?.insuranceCompanyName,
          quotationCompanyName: claimData.quotation?.companyName,
          leadInsuranceCompany: claimData.lead?.insuranceCompanyName,
        });
        console.log("Policy object details:", {
          policyNumber: claimData.policy?.policyNumber,
          insuredName: claimData.policy?.insuredName,
          insuranceCompanyName: claimData.policy?.insuranceCompanyName,
          houseNo: claimData.policy?.houseNo,
          barangay: claimData.policy?.barangay,
          country: claimData.policy?.country,
          province: claimData.policy?.province,
          city: claimData.policy?.city,
          zipCode: claimData.policy?.zipCode,
        });
        console.log("Lead object details:", {
          firstName: claimData.lead?.firstName,
          lastName: claimData.lead?.lastName,
          houseNo: claimData.lead?.houseNo,
          barangay: claimData.lead?.barangay,
          country: claimData.lead?.country,
          province: claimData.lead?.province,
          city: claimData.lead?.city,
          zipCode: claimData.lead?.zipCode,
        });
        console.log("Quotation object details:", {
          insuranceCompanyName: claimData.quotation?.insuranceCompanyName,
          companyName: claimData.quotation?.companyName,
          fullQuotationObject: claimData.quotation,
        });
        console.log("Insurance Company Name mapping:", {
          policyInsuranceCompany: claimData.policy?.insuranceCompanyName,
          quotationInsuranceCompany: claimData.quotation?.insuranceCompanyName,
          quotationCompanyName: claimData.quotation?.companyName,
          finalValue:
            claimData.policy?.insuranceCompanyName ||
            claimData.quotation?.insuranceCompanyName ||
            claimData.quotation?.companyName ||
            "",
        });
        console.log("=== END CLAIM DATA STRUCTURE ===");

        // Map claim data to claim details format
        const mappedData = {
          lob: claimData.lob || mapToApiLob(claimData.productType),
          productType: claimData.productType || (claimData.lob === "FIRE" ? "Fire and Allied Perils" : "Motor"),
          InsuranceCompanyName:
            claimData.insuranceCompanyName ||
            claimData.policy?.insuranceCompanyName ||
            claimData.quotation?.insuranceCompanyName ||
            claimData.quotation?.companyName ||
            claimData.lead?.insuranceCompanyName ||
            "",
          policyNumber: claimData.policy?.policyNumber || "",
          PolicyHolderName:
            claimData.policy?.insuredName ||
            claimData.policy?.policyHolderName ||
            `${claimData.lead?.firstName || ""} ${
              claimData.lead?.lastName || ""
            }`.trim() ||
            "",
          HouseNo:
            claimData.houseNo ||
            claimData.driverHouseNo ||
            claimData.policy?.houseNo ||
            claimData.lead?.houseNo ||
            "",
          Barangay:
            claimData.barangay ||
            claimData.driverBarangay ||
            claimData.policy?.barangay ||
            claimData.lead?.barangay ||
            "",
          CountryName: normalizeCountryName(
            claimData.country ||
              claimData.driverCountry ||
              claimData.policy?.country ||
              claimData.lead?.country ||
              ""
          ),
          Province:
            claimData.province ||
            claimData.driverProvince ||
            claimData.policy?.province ||
            claimData.lead?.province ||
            "",
          CityName:
            claimData.city ||
            claimData.driverCity ||
            claimData.policy?.city ||
            claimData.lead?.city ||
            "",
          ZipCode:
            claimData.zipCode ||
            claimData.driverZipCode ||
            claimData.policy?.zipCode ||
            claimData.lead?.zipCode ||
            "",
          RoadThanon:
            claimData.roadThanon ||
            claimData.driverRoadThanon ||
            claimData.policy?.roadThanon ||
            claimData.lead?.roadThanon ||
            "",
          SoiAlley:
            claimData.soiAlley ||
            claimData.driverSoiAlley ||
            claimData.policy?.soiAlley ||
            claimData.lead?.soiAlley ||
            "",
          MooVillage:
            claimData.mooVillage ||
            claimData.driverMooVillage ||
            claimData.policy?.mooVillage ||
            claimData.lead?.mooVillage ||
            "",
          isCoInsurance: Boolean(
            claimData.isCoInsurancePolicy ??
              claimData.isCoInsurance ??
              claimData.policy?.isCoInsurance ??
              claimData.quotation?.isCoInsurance
          ),
          participatingInsurersCount:
            claimData.participatingInsurersCount ??
            claimData.quotation?.participantDetails?.length ??
            0,
          // Driver details
          driverName: claimData.driverName || "",
          driverHouseNo: claimData.driverHouseNo || "",
          driverBarangay: claimData.driverBarangay || "",
          driverCountry: normalizeCountryName(claimData.driverCountry || ""),
          driverProvince: claimData.driverProvince || "",
          driverCity: claimData.driverCity || "",
          driverZipCode: claimData.driverZipCode || "",
          driverRoadThanon: claimData.driverRoadThanon || "",
          driverSoiAlley: claimData.driverSoiAlley || "",
          driverMooVillage: claimData.driverMooVillage || "",
          // Third party details
          InsuranceCompanyN:
            claimData.thirdPartyWitnessDetails?.[0]
              ?.thirdPartyInsuranceCompanyName ||
            claimData.thirdPartyWitnessDetails?.insuranceCompanyName ||
            "",
          name:
            claimData.thirdPartyWitnessDetails?.[0]?.thirdPartyName ||
            claimData.thirdPartyWitnessDetails?.name ||
            "",
          contactNumber:
            claimData.thirdPartyWitnessDetails?.[0]
              ?.thirdPartyContactNumber ||
            claimData.thirdPartyWitnessDetails?.contactNumber ||
            "",
          plateNumber:
            claimData.thirdPartyWitnessDetails?.[0]
              ?.thirdPartyPlateNumber ||
            claimData.thirdPartyWitnessDetails?.plateNumber ||
            "",
          unit:
            claimData.thirdPartyWitnessDetails?.[0]?.thirdPartyUnit ||
            claimData.thirdPartyWitnessDetails?.unit ||
            "",
          shop:
            claimData.thirdPartyWitnessDetails?.[0]?.thirdPartyShop ||
            claimData.thirdPartyWitnessDetails?.shop ||
            "",
        };

        console.log("Mapped data for edit:", mappedData);
        return mappedData;
      } else {
        console.error("Failed to fetch claim details for edit:", result.error);
        return rejectWithValue(result.error);
      }
    } catch (error) {
      console.error("Get claim details for edit error:", error);
      return rejectWithValue(
        error?.response?.data?.error?.message || error.message
      );
    }
  }
);

export const postClaimDetailsData = createAsyncThunk(
  POST_CLAIM_DETAILS_DATA,
  async (payload, { rejectWithValue }) => {
    console.log(payload, "payload");
    const data = {
      // Policyholder address (persisted into view data on fulfill)
      PolicyHolderName: payload?.PolicyHolderName,
      HouseNo: payload?.HouseNo,
      Barangay: payload?.Barangay,
      CountryName: payload?.CountryName,
      Province: payload?.Province,
      CityName: payload?.CityName,
      ZipCode: payload?.ZipCode,
      RoadThanon: payload?.RoadThanon,
      SoiAlley: payload?.SoiAlley,
      MooVillage: payload?.MooVillage,
      // Third party details
      InsuranceCompanyN: payload?.InsuranceCompanyN,
      name: payload?.name,
      contactNumber: payload?.contactNumber,
      plateNumber: payload?.plateNumber,
      unit: payload?.unit,
      shop: payload?.shop,
      // Driver details - store all driver information (Motor only)
      driverName: payload?.driverName,
      driverHouseNo: payload?.driverHouseNo,
      driverBarangay: payload?.driverBarangay,
      driverCountry: payload?.driverCountry,
      driverProvince: payload?.driverProvince,
      driverCity: payload?.driverCity,
      driverZipCode: payload?.driverZipCode,
      driverRoadThanon: payload?.driverRoadThanon,
      driverSoiAlley: payload?.driverSoiAlley,
      driverMooVillage: payload?.driverMooVillage,
      isPolicyHolderTheDriver: payload?.isPolicyHolderTheDriver === true,
      // Incident details (shared; Fire uses for loss location/cause)
      dateOfIncident: payload?.dateOfIncident,
      timeOfIncident: payload?.timeOfIncident,
      addressOfIncident: payload?.addressOfIncident,
      cityOfIncident: payload?.cityOfIncident,
      provinceOfIncident: payload?.provinceOfIncident,
      typeOfIncident: payload?.typeOfIncident,
      estimatedClaimAmount: payload?.estimatedClaimAmount,
      insuranceCompanyClaimNumber: payload?.insuranceCompanyClaimNumber,
      // LOB for API (MOTOR | FIRE)
      lob: payload?.lob,
      // Store reference IDs for API
      leadRefId: payload?.leadRefId,
      quoteRefId: payload?.quoteRefId,
      policyRefId: payload?.policyRefId,
    };

    try {
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
