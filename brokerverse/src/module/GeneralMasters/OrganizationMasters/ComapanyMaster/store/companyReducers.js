import { createSlice } from "@reduxjs/toolkit";
import {
  getCompanyListMiddleware,
  getCompanyListByIdMiddleware,
  postAddCompanyMiddleware,
  patchCompanyEditMiddleware,
  getSearchCompanyMiddleware,
  getComapnyListByIdMiddleware,
  getCompanyView,
  getCompanyViewMiddleWare,
  getCompanyEditData,
} from "./companyMiddleware";

const initialState = {
  loading: false,
  error: "",
  companyTableList: [
    {
      id: "1",
      CompanyCode: "CORP-001",
      CompanyName: "SM Prime Holdings Inc.",
      LicenseNumber: "SEC-1991-0654321",
      EmailID: "insurance@smprime.com",
      Logo: "",
      Websitelink: "www.smprime.com",
      Description: "Leading integrated property developer in Thailand",
      AddressLine1: "Mall of Asia Complex",
      AddressLine2: "Seaside Boulevard",
      AddressLine3: "",
      PinCode: "1300",
      City: "Pasay",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 2 8831 1000",
      Fax: "+63 2 8831 1001",
      Industry: "Real Estate & Retail",
      ContactPerson: "Juan Carlos Mendoza",
      TotalPolicies: 45,
      TotalPremium: 12500000
    },
    {
      id: "2",
      CompanyCode: "CORP-002",
      CompanyName: "Ayala Corporation",
      LicenseNumber: "SEC-1968-0123456",
      EmailID: "riskmanagement@ayala.com.ph",
      Logo: "",
      Websitelink: "www.ayala.com.ph",
      Description: "Thailand's oldest and largest conglomerate",
      AddressLine1: "Makati Avenue",
      AddressLine2: "Ayala Triangle",
      AddressLine3: "",
      PinCode: "1224",
      City: "Makati",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 2 7908 3000",
      Fax: "+63 2 7908 3001",
      Industry: "Conglomerate",
      ContactPerson: "Maria Teresa Santos",
      TotalPolicies: 68,
      TotalPremium: 25000000
    },
    {
      id: "3",
      CompanyCode: "CORP-003",
      CompanyName: "2GO Group Inc.",
      LicenseNumber: "SEC-2010-0789123",
      EmailID: "insurance@2go.com.ph",
      Logo: "",
      Websitelink: "www.2go.com.ph",
      Description: "Integrated transportation and logistics company",
      AddressLine1: "Pier 4, North Harbor",
      AddressLine2: "Tondo",
      AddressLine3: "",
      PinCode: "1012",
      City: "Manila",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 2 8528 7000",
      Fax: "+63 2 8528 7001",
      Industry: "Logistics & Shipping",
      ContactPerson: "Roberto dela Cruz",
      TotalPolicies: 25,
      TotalPremium: 8750000
    },
    {
      id: "4",
      CompanyCode: "CORP-004",
      CompanyName: "Jollibee Foods Corporation",
      LicenseNumber: "SEC-1978-0456789",
      EmailID: "riskteam@jollibee.com.ph",
      Logo: "",
      Websitelink: "www.jollibee.com.ph",
      Description: "Largest fast food chain in Thailand",
      AddressLine1: "Jollibee Plaza",
      AddressLine2: "Emerald Avenue, Ortigas Center",
      AddressLine3: "",
      PinCode: "1605",
      City: "Pasig",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 2 8634 1111",
      Fax: "+63 2 8634 1112",
      Industry: "Food & Beverage",
      ContactPerson: "Ana Marie Garcia",
      TotalPolicies: 38,
      TotalPremium: 6250000
    },
    {
      id: "5",
      CompanyCode: "CORP-005",
      CompanyName: "Cebu Pacific Air",
      LicenseNumber: "SEC-1996-0321654",
      EmailID: "insurance@cebupacificair.com",
      Logo: "",
      Websitelink: "www.cebupacificair.com",
      Description: "Leading low-cost carrier in Thailand",
      AddressLine1: "Domestic Road",
      AddressLine2: "Pasay City",
      AddressLine3: "",
      PinCode: "1301",
      City: "Pasay",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 2 8702 0888",
      Fax: "+63 2 8702 0889",
      Industry: "Aviation",
      ContactPerson: "Carlos Martinez",
      TotalPolicies: 32,
      TotalPremium: 18500000
    },
    {
      id: "6",
      CompanyCode: "CORP-006",
      CompanyName: "San Miguel Corporation",
      LicenseNumber: "SEC-1913-0000001",
      EmailID: "riskmanagement@sanmiguel.com.ph",
      Logo: "",
      Websitelink: "www.sanmiguel.com.ph",
      Description: "Diversified conglomerate with over 130 years of history",
      AddressLine1: "40 San Miguel Avenue",
      AddressLine2: "Mandaluyong City",
      AddressLine3: "",
      PinCode: "1550",
      City: "Mandaluyong",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 2 8632 3000",
      Fax: "+63 2 8632 3001",
      Industry: "Conglomerate",
      ContactPerson: "Miguel Torres",
      TotalPolicies: 85,
      TotalPremium: 35000000
    },
    {
      id: "7",
      CompanyCode: "SME-001",
      CompanyName: "TechnoHub Solutions Inc.",
      LicenseNumber: "SEC-2015-0987654",
      EmailID: "admin@technohub.ph",
      Logo: "",
      Websitelink: "www.technohub.ph",
      Description: "IT solutions provider for enterprise clients",
      AddressLine1: "BGC Corporate Center",
      AddressLine2: "30th Street, BGC",
      AddressLine3: "",
      PinCode: "1634",
      City: "Taguig",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 917 888 9999",
      Fax: "",
      Industry: "Information Technology",
      ContactPerson: "Pedro Gonzales",
      TotalPolicies: 8,
      TotalPremium: 850000
    },
    {
      id: "8",
      CompanyCode: "IND-001",
      CompanyName: "Juan Dela Cruz",
      LicenseNumber: "TIN-123-456-789",
      EmailID: "juan.delacruz@gmail.com",
      Logo: "",
      Websitelink: "",
      Description: "Individual client - Motor and Health Insurance",
      AddressLine1: "123 Rizal Street",
      AddressLine2: "Sampaloc",
      AddressLine3: "",
      PinCode: "1008",
      City: "Manila",
      State: "Metro Manila",
      Country: "PHILIPPINES",
      PhoneNumber: "+63 917 123 4567",
      Fax: "",
      Industry: "Personal",
      ContactPerson: "Self",
      TotalPolicies: 2,
      TotalPremium: 45000
    }
  ],
  companySearchList: [],
  companyView: {},
  getcompanyEdit:{}
};
let nextId = 3;
const receiptsReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getCompanyListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCompanyListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.companyTableList = [action.payload];
    });
    builder.addCase(getCompanyListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.companyTableList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getComapnyListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getComapnyListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.companyDetailList = action.payload;
    });
    builder.addCase(getComapnyListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.companyDetailList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchCompanyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchCompanyMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.companySearchList = action.payload;
    });
    builder.addCase(getSearchCompanyMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.companySearchList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddCompanyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddCompanyMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = { ...action.payload, id: nextId++ };
      state.companyTableList = [...state.companyTableList, newItem2];
      console.log(state.companyTableList, "companyTableList");
    });
    builder.addCase(postAddCompanyMiddleware.rejected, (state, action) => {
      state.loading = false;

      //   state.paymentVocherList = state.paymentVocherList;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getCompanyViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getCompanyViewMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.companyView = action.payload;
        console.log( state.companyView = action.payload," state.companyView = action.payload;");
   
      }
    );
    builder.addCase(
      getCompanyViewMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.companyView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    
    builder.addCase(getCompanyEditData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getCompanyEditData.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getcompanyEdit= action.payload;
      }
    );
    builder.addCase(
      getCompanyEditData.rejected,
      (state, action) => {
        state.loading = false;
        state.getcompanyEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

  
    builder.addCase(patchCompanyEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchCompanyEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.companyTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        console.log(updatedIndex,"updatedIndex");
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.companyTableList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.companyTableList = updatedCurrencyList;
        } else {
          state.companyTableList = [...state.companyTableList, action.payload];
        }
      }
    );
    builder.addCase(patchCompanyEditMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.editList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default receiptsReducer.reducer;
