import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceVehicleMiddleWare,
  postInsuranceVehicleMiddleWare,
  patchInsuranceVehicleMiddleWare,
  getSearchInsuranceVehicleMiddleware,
} from "./insuranceVehicleMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsuranceVehicleList: [
    {
      id: 1,
      Status: 1,
      vehicleCode: "VEH-001",
      vehicleName: "Vios",
      vehicleVariant: "1.3 E CVT",
      vehicleModel: "2025",
      vehicleBrand: "Toyota",
      seatingCapacity: 5,
      vehicleType: "Sedan",
      engineCapacity: "1329cc",
      fuelType: "Gasoline",
      estimatedValue: "₱886,000",
      action: 1,
    },
    {
      id: 2,
      Status: 1,
      vehicleCode: "VEH-002",
      vehicleName: "Innova",
      vehicleVariant: "2.8 G DSL AT",
      vehicleModel: "2025",
      vehicleBrand: "Toyota",
      seatingCapacity: 7,
      vehicleType: "MPV",
      engineCapacity: "2755cc",
      fuelType: "Diesel",
      estimatedValue: "₱1,275,000",
      action: 2,
    },
    {
      id: 3,
      Status: 1,
      vehicleCode: "VEH-003",
      vehicleName: "Xpander",
      vehicleVariant: "GLS 1.5 AT",
      vehicleModel: "2025",
      vehicleBrand: "Mitsubishi",
      seatingCapacity: 7,
      vehicleType: "MPV",
      engineCapacity: "1499cc",
      fuelType: "Gasoline",
      estimatedValue: "₱1,130,000",
      action: 3,
    },
    {
      id: 4,
      Status: 1,
      vehicleCode: "VEH-004",
      vehicleName: "City",
      vehicleVariant: "1.5 V CVT",
      vehicleModel: "2025",
      vehicleBrand: "Honda",
      seatingCapacity: 5,
      vehicleType: "Sedan",
      engineCapacity: "1498cc",
      fuelType: "Gasoline",
      estimatedValue: "₱1,125,000",
      action: 4,
    },
    {
      id: 5,
      Status: 1,
      vehicleCode: "VEH-005",
      vehicleName: "Fortuner",
      vehicleVariant: "2.4 G DSL 4x2 AT",
      vehicleModel: "2025",
      vehicleBrand: "Toyota",
      seatingCapacity: 7,
      vehicleType: "SUV",
      engineCapacity: "2393cc",
      fuelType: "Diesel",
      estimatedValue: "₱1,859,000",
      action: 5,
    },
    {
      id: 6,
      Status: 1,
      vehicleCode: "VEH-006",
      vehicleName: "Hilux",
      vehicleVariant: "2.4 E DSL 4x2 MT",
      vehicleModel: "2025",
      vehicleBrand: "Toyota",
      seatingCapacity: 5,
      vehicleType: "Pickup",
      engineCapacity: "2393cc",
      fuelType: "Diesel",
      estimatedValue: "₱1,095,000",
      action: 6,
    },
    {
      id: 7,
      Status: 1,
      vehicleCode: "VEH-007",
      vehicleName: "Ranger",
      vehicleVariant: "2.0 Turbo AT 4x2",
      vehicleModel: "2025",
      vehicleBrand: "Ford",
      seatingCapacity: 5,
      vehicleType: "Pickup",
      engineCapacity: "1996cc",
      fuelType: "Diesel",
      estimatedValue: "₱1,215,000",
      action: 7,
    },
    {
      id: 8,
      Status: 1,
      vehicleCode: "VEH-008",
      vehicleName: "Navara",
      vehicleVariant: "2.5 VL 4x4 AT",
      vehicleModel: "2025",
      vehicleBrand: "Nissan",
      seatingCapacity: 5,
      vehicleType: "Pickup",
      engineCapacity: "2488cc",
      fuelType: "Diesel",
      estimatedValue: "₱1,789,000",
      action: 8,
    },
    {
      id: 9,
      Status: 1,
      vehicleCode: "VEH-009",
      vehicleName: "Click 150i",
      vehicleVariant: "Standard",
      vehicleModel: "2025",
      vehicleBrand: "Honda",
      seatingCapacity: 2,
      vehicleType: "Motorcycle",
      engineCapacity: "149cc",
      fuelType: "Gasoline",
      estimatedValue: "₱96,900",
      action: 9,
    },
    {
      id: 10,
      Status: 1,
      vehicleCode: "VEH-010",
      vehicleName: "Aerox 155",
      vehicleVariant: "S Version",
      vehicleModel: "2025",
      vehicleBrand: "Yamaha",
      seatingCapacity: 2,
      vehicleType: "Scooter",
      engineCapacity: "155cc",
      fuelType: "Gasoline",
      estimatedValue: "₱122,900",
      action: 10,
    },
    {
      id: 11,
      Status: 1,
      vehicleCode: "VEH-011",
      vehicleName: "L300",
      vehicleVariant: "FB Deluxe",
      vehicleModel: "2025",
      vehicleBrand: "Mitsubishi",
      seatingCapacity: 15,
      vehicleType: "Van",
      engineCapacity: "2477cc",
      fuelType: "Diesel",
      estimatedValue: "₱752,000",
      action: 11,
    },
    {
      id: 12,
      Status: 1,
      vehicleCode: "VEH-012",
      vehicleName: "Jeepney",
      vehicleVariant: "Traditional",
      vehicleModel: "2025",
      vehicleBrand: "Sarao/Francisco",
      seatingCapacity: 20,
      vehicleType: "Public Transport",
      engineCapacity: "3000cc",
      fuelType: "Diesel",
      estimatedValue: "₱550,000",
      action: 12,
    },
  ],
  SearchTableList: [],
};
const insuranceManagementVehicleMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceVehicleMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInsuranceVehicleMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceVehicleList = action.payload;
      }
    );
    builder.addCase(getInsuranceVehicleMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.InsuranceVehicleList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //postInsuranceVehicle

    builder.addCase(postInsuranceVehicleMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsuranceVehicleMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceVehicleList = [
          ...state.InsuranceVehicleList,
          action.payload,
        ];
      }
    );
    builder.addCase(
      postInsuranceVehicleMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //EditInsuranceVehicle
    builder.addCase(patchInsuranceVehicleMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceVehicleMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsuranceVehicleList = action.payload;
      }
    );
    builder.addCase(
      patchInsuranceVehicleMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //searchInsuranceVehicle
    builder.addCase(getSearchInsuranceVehicleMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsuranceVehicleMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceVehicleMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementVehicleMasterReducer.reducer;
