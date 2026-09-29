import { createSlice } from "@reduxjs/toolkit";
import { getQuoteSearchDataMiddleWare, getquotetableMiddleware} from "./quoteMiddleware";

const initialState = {
    loading: false,
    error: "",
    quotetabledata:[
        {
          id: "1",
          Company: "Malayan Insurance",
          QuoteID: "QT-2025-MOT-001",
          PolicyType: "Motor Comprehensive",
          ClientName: "Juan Dela Cruz",
          VehicleDetails: "Toyota Vios 1.3E 2025",
          Grosspremium: "₱28,500.00",
          Date: "28 MAR 2025",
          Status: "Approved",
          ExpiryDate: "05 APR 2025",
        },
        {
          id: "2",
          Company: "Pioneer Insurance",
          QuoteID: "QT-2025-FIRE-002",
          PolicyType: "Fire & Allied Perils",
          ClientName: "SM Prime Holdings",
          PropertyAddress: "Mall of Asia Complex, Pasay",
          Grosspremium: "₱185,000.00",
          Date: "27 MAR 2025",
          Status: "Pending Review",
          ExpiryDate: "03 APR 2025",
        },
        {
          id: "3",
          Company: "AXA Thailand",
          QuoteID: "QT-2025-HLT-003",
          PolicyType: "Group Health Insurance",
          ClientName: "TechnoHub Solutions Inc.",
          NumberOfEmployees: "45",
          Grosspremium: "₱92,500.00",
          Date: "26 MAR 2025",
          Status: "Draft",
          ExpiryDate: "02 APR 2025",
        },
        {
          id: "4",
          Company: "PGA Sompo",
          QuoteID: "QT-2025-MOT-004",
          PolicyType: "Motor CTPL Only",
          ClientName: "Maria Santos",
          VehicleDetails: "Honda Click 150i 2025",
          Grosspremium: "₱680.00",
          Date: "26 MAR 2025",
          Status: "Approved",
          ExpiryDate: "30 MAR 2025",
        },
        {
          id: "5",
          Company: "Charter Ping An",
          QuoteID: "QT-2025-MAR-005",
          PolicyType: "Marine Cargo",
          ClientName: "2GO Group Inc.",
          ShipmentDetails: "Electronics - Manila to Cebu",
          Grosspremium: "₱12,750.00",
          Date: "25 MAR 2025",
          Status: "Processing",
          ExpiryDate: "01 APR 2025",
        },
        {
          id: "6",
          Company: "Malayan Insurance",
          QuoteID: "QT-2025-PA-006",
          PolicyType: "Personal Accident",
          ClientName: "Roberto Reyes",
          Coverage: "24/7 Worldwide Coverage",
          Grosspremium: "₱3,500.00",
          Date: "25 MAR 2025",
          Status: "Approved",
          ExpiryDate: "30 MAR 2025",
        },
        {
          id: "7",
          Company: "FPG Insurance",
          QuoteID: "QT-2025-MOT-007",
          PolicyType: "Commercial Vehicle",
          ClientName: "Jollibee Foods Corp",
          VehicleDetails: "Mitsubishi L300 Delivery Van",
          Grosspremium: "₱45,200.00",
          Date: "24 MAR 2025",
          Status: "Under Negotiation",
          ExpiryDate: "31 MAR 2025",
        },
        {
          id: "8",
          Company: "Standard Insurance",
          QuoteID: "QT-2025-ENG-008",
          PolicyType: "Contractor's All Risk",
          ClientName: "Ayala Corporation",
          ProjectName: "BGC Tower Construction",
          Grosspremium: "₱850,000.00",
          Date: "23 MAR 2025",
          Status: "Pending Documents",
          ExpiryDate: "30 MAR 2025",
        },
        {
          id: "9",
          Company: "Oriental Assurance",
          QuoteID: "QT-2025-TRV-009",
          PolicyType: "Travel Insurance",
          ClientName: "Ana Garcia",
          Destination: "Japan - 15 days",
          Grosspremium: "₱2,850.00",
          Date: "23 MAR 2025",
          Status: "Approved",
          ExpiryDate: "28 MAR 2025",
        },
        {
          id: "10",
          Company: "Thai Guarantee",
          QuoteID: "QT-2025-BOND-010",
          PolicyType: "Surety Bond",
          ClientName: "Construction Plus Inc.",
          BondType: "Performance Bond",
          Grosspremium: "₱125,000.00",
          Date: "22 MAR 2025",
          Status: "Awaiting Approval",
          ExpiryDate: "29 MAR 2025",
        },
        {
          id: "11",
          Company: "Maxicare",
          QuoteID: "QT-2025-HMO-011",
          PolicyType: "HMO Coverage",
          ClientName: "Call Center Thailand Inc.",
          NumberOfEmployees: "200",
          Grosspremium: "₱420,000.00",
          Date: "22 MAR 2025",
          Status: "Revised Quote",
          ExpiryDate: "29 MAR 2025",
        },
        {
          id: "12",
          Company: "Sun Life Thailand",
          QuoteID: "QT-2025-LIFE-012",
          PolicyType: "Group Life Insurance",
          ClientName: "San Miguel Corporation",
          NumberOfEmployees: "500",
          Grosspremium: "₱1,250,000.00",
          Date: "21 MAR 2025",
          Status: "Client Review",
          ExpiryDate: "28 MAR 2025",
        },
    ],
    quoteSearchList:[],
    
};

const quoteReducer = createSlice({
    name: "quoteReducer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {

         //getquotetableMiddleware

    builder.addCase(getquotetableMiddleware.pending, (state) => {
        state.loading = true;
      });
      builder.addCase(
        getquotetableMiddleware.fulfilled,
        (state, action) => {
          state.loading = false;
          state.quotetabledata = [action.payload]
        }
      );
      builder.addCase(
        getquotetableMiddleware.rejected,
        (state, action) => {
          state.loading = false;
          state.error = typeof action.payload === "string" ? action.payload : "";
        }
      );



      // getQuoteSearchDataMiddleWare

      builder.addCase(getQuoteSearchDataMiddleWare.pending, (state) => {
        state.loading = true;
      });
      builder.addCase(getQuoteSearchDataMiddleWare.fulfilled, (state, action) => {
        state.loading = false;
        state.quoteSearchList = action.payload;
      });
      builder.addCase(getQuoteSearchDataMiddleWare.rejected, (state, action) => {
        state.loading = false;
  
        state.quoteSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      });
      
    },
});

export default quoteReducer.reducer;