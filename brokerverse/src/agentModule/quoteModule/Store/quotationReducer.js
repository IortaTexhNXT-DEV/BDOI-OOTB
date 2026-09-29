import { createSlice } from "@reduxjs/toolkit";
import {
  createQuotationMiddleware,
  getQuotationsMiddleware,
  getQuotationByIdMiddleware,
  updateQuotationMiddleware,
  deleteQuotationMiddleware,
  getQuotationStatsMiddleware,
} from "./quotationMiddleware";

const initialState = {
  loading: false,
  error: "",
  quotations: [],
  currentQuotation: {},
  totalQuotations: 0,
  currentPage: 1,
  pageSize: 10,
  createQuotationData: {},
  updateQuotationData: {},
  quotationStats: {
    totalQuotations: 0,
    recentQuotations: 0,
    last30DaysQuotations: 0,
    convertedToPolicyCount: 0,
    approvedQuotations: 0,
    pendingQuotations: 0,
    activeQuotationsCount: 0,
    conversionRate: 0,
    approvalRate: 0,
    growthRate: 0,
    averagePremium: 0,
    totalPremiumValue: 0,
    averageApprovedPremium: 0,
    quotationsByStatus: [],
    quotationsByProductType: [],
  },
  // Multi-step quote creation state
  currentQuoteCreation: {
    leadRefId: null,
    policyDetails: null,
    coverageDetails: null,
    accessories: null,
    orderSummary: null,
    isEditMode: false,
    quotationId: null,
  },
};

const quotationSlice = createSlice({
  name: "quotationReducers",
  initialState,
  reducers: {
    clearQuotationError: (state) => {
      state.error = "";
    },
    clearCurrentQuotation: (state) => {
      state.currentQuotation = {};
    },
    clearCreateQuotationData: (state) => {
      state.createQuotationData = {};
    },
    clearUpdateQuotationData: (state) => {
      state.updateQuotationData = {};
    },
    // Multi-step quote creation actions
    setQuoteLeadRefId: (state, action) => {
      state.currentQuoteCreation.leadRefId = action.payload;
    },
    setQuotePolicyDetails: (state, action) => {
      state.currentQuoteCreation.policyDetails = action.payload;
    },
    setQuoteCoverageDetails: (state, action) => {
      state.currentQuoteCreation.coverageDetails = action.payload;
    },
    setQuoteAccessories: (state, action) => {
      state.currentQuoteCreation.accessories = action.payload;
    },
    setQuoteOrderSummary: (state, action) => {
      state.currentQuoteCreation.orderSummary = action.payload;
    },
    setQuoteEditMode: (state, action) => {
      state.currentQuoteCreation.isEditMode = action.payload.isEditMode;
      state.currentQuoteCreation.quotationId = action.payload.quotationId;
    },
    clearCurrentQuoteCreation: (state) => {
      state.currentQuoteCreation = {
        leadRefId: null,
        policyDetails: null,
        coverageDetails: null,
        accessories: null,
        orderSummary: null,
        isEditMode: false,
        quotationId: null,
      };
    },
    // Load existing quotation data into creation state for editing
    loadQuotationForEdit: (state, action) => {
      const quotation = action.payload;
      state.currentQuoteCreation.isEditMode = true;
      state.currentQuoteCreation.quotationId = quotation.quotationId;
      state.currentQuoteCreation.leadRefId = quotation.leadRefId;
      // Pre-populate all steps with existing data
      state.currentQuoteCreation.policyDetails = {
        insuranceCompanyName:
          quotation.participantDetails?.[0]?.insuranceCompanyName || "",
        insurancePolicyType: quotation.insurancePolicyType || "",
        accountCode: quotation.accountCode || "",
        vehicleType:
          quotation.insuranceVehicleDetails?.[0]?.vehicleType || quotation.vehicleType || "",
        vehicleBrand:
          quotation.insuranceVehicleDetails?.[0]?.vehicleBrand || "",
        modelYear: quotation.insuranceVehicleDetails?.[0]?.modelYear || "",
        vehicleModel:
          quotation.insuranceVehicleDetails?.[0]?.vehicleModel || "",
        modelVariant:
          quotation.insuranceVehicleDetails?.[0]?.modelVariant || "",
        vehicleColor:
          quotation.insuranceVehicleDetails?.[0]?.vehicleColor || "",
        seatingCapacity:
          quotation.insuranceVehicleDetails?.[0]?.seatingCapacity || "",
        paymentType: quotation.paymentType || "",
        installmentType: quotation.installmentType || "",
        isCoInsurance: quotation.isCoInsurance || false,
        participantDetails: quotation.participantDetails || [],
      };
      state.currentQuoteCreation.coverageDetails = {
        lossAndDamageCoverage: quotation.lossAndDamageCoverage || "",
        lossAndDamageCoverageRate: quotation.lossAndDamageCoverageRate || "",
        lossAndDamageCoveragePremium:
          quotation.lossAndDamageCoveragePremium || "",
        actsOfNatureRate: quotation.actsOfNatureRate || "",
        actsOfNaturePremium: quotation.actsOfNaturePremium || "",
        includeCTPL: Boolean(quotation.includeCTPL ?? Number(quotation.ctplCoverageRate)),
        ctplCoverageRate: quotation.ctplCoverageRate || "",
        ctplCoveragePremium: quotation.ctplCoveragePremium || "",
        roadsideAssistanceRate: quotation.roadsideAssistanceRate || "",
        roadsideAssistancePremium: quotation.roadsideAssistancePremium || "",
        personalAccidentCoverRate: quotation.personalAccidentCoverRate || "",
        personalAccidentCoverPremium: quotation.personalAccidentCoverPremium || "",
        appaSeats: quotation.appaSeats || "",
        bodilyInjury: quotation.bodilyInjury || "",
        bodilyInjuryCoveragePremium:
          quotation.bodilyInjuryCoveragePremium || "",
        propertyDamage: quotation.propertyDamage || "",
        propertyDamageCoveragePremium:
          quotation.propertyDamageCoveragePremium || "",
        autoPassengerPersonalAccident:
          quotation.autoPassengerPersonalAccident || "",
        APPAtotalCoverage: quotation.APPAtotalCoverage || "",
        APPAcoveragePremium: quotation.APPAcoveragePremium || "",
        totalSumInsured: quotation.totalSumInsured || "",
        // Include premium breakdown from quotation
        netPremium: quotation.netPremium || "",
        documentaryStampTax: quotation.documentaryStampTax || "",
        valueAddedTax: quotation.valueAddedTax || "",
        localGovernmentTax: quotation.localGovernmentTax || "",
        discount: quotation.discount || "",
        grossPremium: quotation.grossPremium || "",
      };
      state.currentQuoteCreation.accessories = {
        aircon: quotation.aircon || "",
        stereo: quotation.stereo || "",
        magWheels: quotation.magWheels || "",
        others: quotation.others || "",
        deductible: quotation.deductible || "",
        towing: quotation.towing || "",
        repairLimit: quotation.repairLimit || "",
      };
      state.currentQuoteCreation.orderSummary = {
        netPremium: quotation.netPremium || "",
        valueAddedTax: quotation.valueAddedTax || "",
        accountPremiumOthers: quotation.accountPremiumOthers || "",
        documentaryStampTax: quotation.documentaryStampTax || "",
        localGovernmentTax: quotation.localGovernmentTax || "",
        NCD: quotation.NCD || "",
        discount: quotation.discount || "",
        grossPremium: quotation.grossPremium || "",
        authorizedSignature: quotation.authorizedSignature || "",
        commissionDetails: quotation.commissionDetails || null,
      };
    },
  },
  extraReducers: (builder) => {
    // Create Quotation
    builder.addCase(createQuotationMiddleware.pending, (state) => {
      state.loading = true;
      state.error = "";
    });
    builder.addCase(createQuotationMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.createQuotationData = action.payload;
      state.error = "";
    });
    builder.addCase(createQuotationMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error =
        typeof action.payload === "string"
          ? action.payload
          : "Failed to create quotation";
    });

    // Get Quotations
    builder.addCase(getQuotationsMiddleware.pending, (state) => {
      state.loading = true;
      state.error = "";
    });
    builder.addCase(getQuotationsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.quotations = action.payload.data || [];
      state.totalQuotations = action.payload.total || 0;
      state.currentPage = action.payload.page || 1;
      state.pageSize = action.payload.pageSize || 10;
      state.error = "";
    });
    builder.addCase(getQuotationsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error =
        typeof action.payload === "string"
          ? action.payload
          : "Failed to fetch quotations";
    });

    // Get Quotation by ID
    builder.addCase(getQuotationByIdMiddleware.pending, (state) => {
      state.loading = true;
      state.error = "";
    });
    builder.addCase(getQuotationByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.currentQuotation = action.payload;
      state.error = "";
    });
    builder.addCase(getQuotationByIdMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error =
        typeof action.payload === "string"
          ? action.payload
          : "Failed to fetch quotation";
    });

    // Update Quotation
    builder.addCase(updateQuotationMiddleware.pending, (state) => {
      state.loading = true;
      state.error = "";
    });
    builder.addCase(updateQuotationMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.updateQuotationData = action.payload;
      state.error = "";
      // Update the quotation in the list if it exists
      const index = state.quotations.findIndex(
        (q) => q.quotationId === action.payload.quotationId
      );
      if (index !== -1) {
        state.quotations[index] = action.payload;
      }
    });
    builder.addCase(updateQuotationMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error =
        typeof action.payload === "string"
          ? action.payload
          : "Failed to update quotation";
    });

    // Delete Quotation
    builder.addCase(deleteQuotationMiddleware.pending, (state) => {
      state.loading = true;
      state.error = "";
    });
    builder.addCase(deleteQuotationMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // Remove the quotation from the list
      state.quotations = state.quotations.filter(
        (q) => q.quotationId !== action.payload.quotationId
      );
      state.totalQuotations = state.totalQuotations - 1;
      state.error = "";
    });
    builder.addCase(deleteQuotationMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error =
        typeof action.payload === "string"
          ? action.payload
          : "Failed to delete quotation";
    });

    // Get Quotation Stats
    builder.addCase(getQuotationStatsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getQuotationStatsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.quotationStats = action.payload;
    });
    builder.addCase(getQuotationStatsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export const {
  clearQuotationError,
  clearCurrentQuotation,
  clearCreateQuotationData,
  clearUpdateQuotationData,
  setQuoteLeadRefId,
  setQuotePolicyDetails,
  setQuoteCoverageDetails,
  setQuoteAccessories,
  setQuoteOrderSummary,
  setQuoteEditMode,
  clearCurrentQuoteCreation,
  loadQuotationForEdit,
} = quotationSlice.actions;

export default quotationSlice.reducer;
