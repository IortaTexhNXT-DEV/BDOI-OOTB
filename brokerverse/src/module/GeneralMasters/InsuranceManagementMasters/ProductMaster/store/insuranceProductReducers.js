import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceProductListMiddleWare,
  postInsuranceProductMiddleWare,
  patchInsuranceProductMiddleWare,
  getSearchInsuranceProductMiddleware,
} from "./insuranceProductMiddleware";

const initialState = {
  loading: false,
  error: "",
  InsuranceProductList: [
    {
      id: 1,
      modifiedby: "Roberto Reyes",
      modifiedOn: "03/28/2025",
      Status: 1,
      productCode: "MOT-001",
      productName: "Comprehensive Motor Insurance",
      lineofBusiness: "Motor",
      insurer: "Malayan Insurance",
      commissionCode: "COM-MOT-15",
      commissionRate: "15%",
      description: "Full coverage for private vehicles including own damage, theft, acts of nature, and third-party liability",
      minPremium: "₱15,000",
      coverage: "Own Damage, Theft, Acts of Nature, Third Party Liability, Personal Accident",
      action: 1,
    },
    {
      id: 2,
      modifiedby: "Roberto Reyes",
      modifiedOn: "03/28/2025",
      Status: 1,
      productCode: "MOT-002",
      productName: "Compulsory Third Party Liability (CTPL)",
      lineofBusiness: "Motor",
      insurer: "Multiple Insurers",
      commissionCode: "COM-CTPL-5",
      commissionRate: "5%",
      description: "Mandatory insurance coverage for bodily injury or death to third parties as required by LTO",
      minPremium: "₱650",
      coverage: "Third Party Bodily Injury/Death up to ₱100,000",
      action: 2,
    },
    {
      id: 3,
      modifiedby: "Maria Santos",
      modifiedOn: "03/28/2025",
      Status: 1,
      productCode: "MOT-003",
      productName: "Motorcycle Comprehensive Insurance",
      lineofBusiness: "Motor",
      insurer: "PGA Sompo",
      commissionCode: "COM-MC-12",
      commissionRate: "12%",
      description: "Complete protection for motorcycles including theft, accidents, and third-party liability",
      minPremium: "₱3,500",
      coverage: "Own Damage, Theft, Third Party Liability, Rider Personal Accident",
      action: 3,
    },
    {
      id: 4,
      modifiedby: "Juan Dela Cruz",
      modifiedOn: "03/27/2025",
      Status: 1,
      productCode: "FIRE-001",
      productName: "Standard Fire & Allied Perils",
      lineofBusiness: "Fire",
      insurer: "Charter Ping An",
      commissionCode: "COM-FIRE-20",
      commissionRate: "20%",
      description: "Protection against fire, lightning, explosion, and allied perils for commercial and residential properties",
      minPremium: "₱5,000",
      coverage: "Fire, Lightning, Explosion, Aircraft Damage, Vehicle Impact, Smoke, Typhoon, Flood, Earthquake",
      action: 4,
    },
    {
      id: 5,
      modifiedby: "Pedro Gonzales",
      modifiedOn: "03/27/2025",
      Status: 1,
      productCode: "FIRE-002",
      productName: "Industrial All Risk (IAR)",
      lineofBusiness: "Fire",
      insurer: "Malayan Insurance",
      commissionCode: "COM-IAR-18",
      commissionRate: "18%",
      description: "Comprehensive coverage for industrial facilities including machinery breakdown and business interruption",
      minPremium: "₱50,000",
      coverage: "Property All Risk, Machinery Breakdown, Business Interruption, Stock",
      action: 5,
    },
    {
      id: 6,
      modifiedby: "Ana Garcia",
      modifiedOn: "03/27/2025",
      Status: 1,
      productCode: "FIRE-003",
      productName: "Homeowners Insurance",
      lineofBusiness: "Fire",
      insurer: "Pioneer Insurance",
      commissionCode: "COM-HOME-15",
      commissionRate: "15%",
      description: "Complete protection for residential properties including structure, contents, and liability",
      minPremium: "₱8,000",
      coverage: "Building, Contents, Personal Effects, Family Personal Accident, Liability",
      action: 6,
    },
    {
      id: 7,
      modifiedby: "Carmen Bautista",
      modifiedOn: "03/26/2025",
      Status: 1,
      productCode: "MAR-001",
      productName: "Marine Cargo Insurance",
      lineofBusiness: "Marine",
      insurer: "Standard Insurance",
      commissionCode: "COM-MAR-15",
      commissionRate: "15%",
      description: "Coverage for goods in transit via sea, air, or land including import/export shipments",
      minPremium: "₱3,000",
      coverage: "All Risk Coverage for Cargo in Transit, War & SRCC optional",
      action: 7,
    },
    {
      id: 8,
      modifiedby: "Carmen Bautista",
      modifiedOn: "03/26/2025",
      Status: 1,
      productCode: "MAR-002",
      productName: "Marine Hull Insurance",
      lineofBusiness: "Marine",
      insurer: "FPG Insurance",
      commissionCode: "COM-HULL-12",
      commissionRate: "12%",
      description: "Comprehensive coverage for vessels including hull, machinery, and equipment",
      minPremium: "₱100,000",
      coverage: "Hull & Machinery, Total Loss, Particular Average, Collision Liability",
      action: 8,
    },
    {
      id: 9,
      modifiedby: "Rosa Fernandez",
      modifiedOn: "03/25/2025",
      Status: 1,
      productCode: "PA-001",
      productName: "Personal Accident Insurance",
      lineofBusiness: "Personal Accident",
      insurer: "AXA Thailand",
      commissionCode: "COM-PA-25",
      commissionRate: "25%",
      description: "24/7 worldwide coverage for accidental death, disability, and medical expenses",
      minPremium: "₱500",
      coverage: "Accidental Death, Permanent Disability, Medical Reimbursement, Daily Hospital Income",
      action: 9,
    },
    {
      id: 10,
      modifiedby: "Rosa Fernandez",
      modifiedOn: "03/25/2025",
      Status: 1,
      productCode: "PA-002",
      productName: "Group Personal Accident",
      lineofBusiness: "Personal Accident",
      insurer: "Malayan Insurance",
      commissionCode: "COM-GPA-20",
      commissionRate: "20%",
      description: "Accident protection for employees and groups with flexible benefit limits",
      minPremium: "₱300 per person",
      coverage: "Accidental Death & Dismemberment, Medical Expenses, Bereavement, Unprovoked Murder & Assault",
      action: 10,
    },
    {
      id: 11,
      modifiedby: "Elena Martinez",
      modifiedOn: "03/24/2025",
      Status: 1,
      productCode: "HEALTH-001",
      productName: "Group Health Insurance",
      lineofBusiness: "Health",
      insurer: "Maxicare",
      commissionCode: "COM-GH-10",
      commissionRate: "10%",
      description: "Comprehensive health coverage for corporate employees including hospitalization and outpatient benefits",
      minPremium: "₱2,000 per person",
      coverage: "Hospitalization, Outpatient, Emergency, Preventive Care, Dental, Optical",
      action: 11,
    },
    {
      id: 12,
      modifiedby: "Elena Martinez",
      modifiedOn: "03/24/2025",
      Status: 1,
      productCode: "HEALTH-002",
      productName: "Individual Health Insurance",
      lineofBusiness: "Health",
      insurer: "Medicard",
      commissionCode: "COM-IH-8",
      commissionRate: "8%",
      description: "Personal health insurance with access to nationwide network of hospitals and clinics",
      minPremium: "₱15,000",
      coverage: "In-patient, Out-patient, Emergency, Annual Physical Exam, Specialist Consultations",
      action: 12,
    },
    {
      id: 13,
      modifiedby: "Miguel Torres",
      modifiedOn: "03/23/2025",
      Status: 1,
      productCode: "LIAB-001",
      productName: "General Third Party Liability",
      lineofBusiness: "Liability",
      insurer: "Pioneer Insurance",
      commissionCode: "COM-GTPL-15",
      commissionRate: "15%",
      description: "Protection against legal liability for bodily injury or property damage to third parties",
      minPremium: "₱10,000",
      coverage: "Bodily Injury, Property Damage, Legal Defense Costs",
      action: 13,
    },
    {
      id: 14,
      modifiedby: "Miguel Torres",
      modifiedOn: "03/23/2025",
      Status: 1,
      productCode: "LIAB-002",
      productName: "Professional Indemnity Insurance",
      lineofBusiness: "Liability",
      insurer: "AXA Thailand",
      commissionCode: "COM-PI-12",
      commissionRate: "12%",
      description: "Coverage for professionals against claims of negligence or errors in professional services",
      minPremium: "₱25,000",
      coverage: "Professional Negligence, Legal Defense, Libel & Slander, Loss of Documents",
      action: 14,
    },
    {
      id: 15,
      modifiedby: "Roberto Reyes",
      modifiedOn: "03/22/2025",
      Status: 1,
      productCode: "ENG-001",
      productName: "Contractor's All Risk (CAR)",
      lineofBusiness: "Engineering",
      insurer: "Charter Ping An",
      commissionCode: "COM-CAR-15",
      commissionRate: "15%",
      description: "Comprehensive coverage for construction projects including materials, equipment, and third-party liability",
      minPremium: "₱50,000",
      coverage: "Contract Works, Construction Plant & Equipment, Third Party Liability, Maintenance Period",
      action: 15,
    },
    {
      id: 16,
      modifiedby: "Roberto Reyes",
      modifiedOn: "03/22/2025",
      Status: 1,
      productCode: "ENG-002",
      productName: "Erection All Risk (EAR)",
      lineofBusiness: "Engineering",
      insurer: "Malayan Insurance",
      commissionCode: "COM-EAR-15",
      commissionRate: "15%",
      description: "Coverage for machinery and equipment installation projects",
      minPremium: "₱40,000",
      coverage: "Machinery Erection, Testing, Third Party Liability, Maintenance Coverage",
      action: 16,
    },
    {
      id: 17,
      modifiedby: "Juan Dela Cruz",
      modifiedOn: "03/21/2025",
      Status: 1,
      productCode: "TRAVEL-001",
      productName: "Travel Insurance",
      lineofBusiness: "Travel",
      insurer: "Pioneer Insurance",
      commissionCode: "COM-TRV-30",
      commissionRate: "30%",
      description: "Comprehensive travel protection for domestic and international trips",
      minPremium: "₱200",
      coverage: "Medical Emergency, Trip Cancellation, Lost Baggage, Personal Accident, Flight Delay",
      action: 17,
    },
    {
      id: 18,
      modifiedby: "Maria Santos",
      modifiedOn: "03/21/2025",
      Status: 1,
      productCode: "BOND-001",
      productName: "Surety Bond",
      lineofBusiness: "Bonds",
      insurer: "Thai Guarantee",
      commissionCode: "COM-BOND-10",
      commissionRate: "10%",
      description: "Performance bonds, bid bonds, and other surety requirements for contractors and suppliers",
      minPremium: "₱5,000",
      coverage: "Performance Bond, Bid Bond, Advance Payment Bond, Warranty Bond",
      action: 18,
    },
    // Employee Benefit Products
    {
      id: 19,
      modifiedby: "Maria Santos",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-001",
      productName: "Group Life Insurance",
      lineofBusiness: "Employee Benefits",
      insurer: "Sun Life Thailand",
      commissionCode: "COM-GL-15",
      commissionRate: "15%",
      description: "Life insurance coverage for employees with optional dependent coverage",
      minPremium: "₱500 per person per year",
      coverage: "Death Benefit, Total & Permanent Disability, Accidental Death, Burial Assistance",
      action: 19,
    },
    {
      id: 20,
      modifiedby: "Maria Santos",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-002",
      productName: "Group Health & Medical Insurance",
      lineofBusiness: "Employee Benefits",
      insurer: "Maxicare",
      commissionCode: "COM-GHM-12",
      commissionRate: "12%",
      description: "Comprehensive health coverage for employees including HMO and traditional insurance",
      minPremium: "₱3,500 per person per year",
      coverage: "Hospitalization, Outpatient, Emergency Care, Preventive Care, Dental, Optical, Maternity",
      action: 20,
    },
    {
      id: 21,
      modifiedby: "Juan Dela Cruz",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-003",
      productName: "Group Personal Accident Insurance",
      lineofBusiness: "Employee Benefits",
      insurer: "AXA Thailand",
      commissionCode: "COM-GPAI-18",
      commissionRate: "18%",
      description: "24/7 worldwide accident protection for employees",
      minPremium: "₱250 per person per year",
      coverage: "Accidental Death, Dismemberment, Medical Reimbursement, Daily Hospital Income, Bereavement",
      action: 21,
    },
    {
      id: 22,
      modifiedby: "Juan Dela Cruz",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-004",
      productName: "Group Retirement & Savings Plan",
      lineofBusiness: "Employee Benefits",
      insurer: "Pru Life UK",
      commissionCode: "COM-RSP-10",
      commissionRate: "10%",
      description: "Retirement savings program with life insurance component for employees",
      minPremium: "₱1,000 per person per month",
      coverage: "Retirement Fund, Life Insurance, Investment Returns, Disability Waiver",
      action: 22,
    },
    {
      id: 23,
      modifiedby: "Pedro Gonzales",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-005",
      productName: "Group Disability Income Insurance",
      lineofBusiness: "Employee Benefits",
      insurer: "Manulife Thailand",
      commissionCode: "COM-DI-14",
      commissionRate: "14%",
      description: "Income replacement for employees unable to work due to illness or injury",
      minPremium: "₱400 per person per year",
      coverage: "Short-term Disability, Long-term Disability, Partial Disability, Rehabilitation Benefits",
      action: 23,
    },
    {
      id: 24,
      modifiedby: "Pedro Gonzales",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-006",
      productName: "Executive Medical Check-up Program",
      lineofBusiness: "Employee Benefits",
      insurer: "Medicard",
      commissionCode: "COM-EMC-8",
      commissionRate: "8%",
      description: "Annual comprehensive health screening for executives and key employees",
      minPremium: "₱8,000 per person per year",
      coverage: "Full Body Check-up, Cardiac Assessment, Cancer Markers, Specialist Consultations, Health Report",
      action: 24,
    },
    {
      id: 25,
      modifiedby: "Elena Martinez",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-007",
      productName: "Group Travel Insurance",
      lineofBusiness: "Employee Benefits",
      insurer: "Pacific Cross",
      commissionCode: "COM-GTI-20",
      commissionRate: "20%",
      description: "Travel protection for employees on business trips",
      minPremium: "₱1,500 per person per trip",
      coverage: "Medical Emergency, Trip Cancellation, Lost Baggage, Personal Liability, Emergency Evacuation",
      action: 25,
    },
    {
      id: 26,
      modifiedby: "Elena Martinez",
      modifiedOn: "03/29/2025",
      Status: 1,
      productCode: "EB-008",
      productName: "Employee Assistance Program (EAP)",
      lineofBusiness: "Employee Benefits",
      insurer: "MindNation",
      commissionCode: "COM-EAP-12",
      commissionRate: "12%",
      description: "Mental health and wellness support for employees",
      minPremium: "₱200 per person per month",
      coverage: "24/7 Counseling, Mental Health Support, Work-Life Balance, Financial Consultation, Legal Advice",
      action: 26,
    }
  ],
  searchInsuranceProductList: [],
};

let nextId = 27;
const InsuranceProductReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceProductListMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInsuranceProductListMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceProductList = [action.payload];
      }
    );
    builder.addCase(
      getInsuranceProductListMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsuranceProductList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(postInsuranceProductMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsuranceProductMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const newItem2 = { ...action.payload, id: nextId++ };
        state.InsuranceProductList = [
          ...state.InsuranceProductList,
          newItem2,
        ];
        console.log(state.InsuranceProductList, "voucherTableList");
      }
    );
    builder.addCase(
      postInsuranceProductMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        //   state.paymentVocherList = state.paymentVocherList;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getSearchInsuranceProductMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsuranceProductMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.searchInsuranceProductList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceProductMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.searchInsuranceProductList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(patchInsuranceProductMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceProductMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.InsuranceProductList.findIndex(
          (item) => item.id === action.payload.id
        );
        console.log(updatedIndex, "updatedIndex");
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.InsuranceProductList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.InsuranceProductList = updatedCurrencyList;
        } else {
          state.InsuranceProductList = [
            ...state.InsuranceProductList,
            action.payload,
          ];
        }
      }
    );
    builder.addCase(
      patchInsuranceProductMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default InsuranceProductReducer.reducer;