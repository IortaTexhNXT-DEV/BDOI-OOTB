import { createSlice } from "@reduxjs/toolkit";
import { getCityMiddleware, getCityListByIdMiddleware, postAddCityMiddleware, patchCityEditMiddleware, getSearchCityMiddleware } from "./cityMiddleware";

const initialState = {
  loading: false,
  error: "",
  cityTableList: [
    {
      id: 1,
      "Citycode": "DVOMAT933",
      "CityName": "MATI",
      "State": "DAVAO ORIENTAL",
      "Modifiedby": "ADMIN1",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
       
    },
    {
      id: 2,
      "Citycode": "NEODON434",
      "CityName": "DON SALVADOR BENEDICTO",
      "State": "NEGROS OCCIDENTAL",
      "Modifiedby": "ADMIN2",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: 3,
      "Citycode": "QZNSAN984",
      "CityName": "SANTA TERESITA",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN3",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: 4,
      "Citycode": "QZNSAN985",
      "CityName": "SANTOL",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN4",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: 5,
      "Citycode": "QZNSTO986",
      "CityName": "STO. CRISTO",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN5",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: 6,
      "Citycode": "QZNSTO987",
      "CityName": "STO. NIÑO",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN6",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: 7,
      "Citycode": "QZNSAU988",
      "CityName": "SAUYO",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN7",
      "ModifiedOn": "2024-01-12"
    },
    {
      id: 8,
      "Citycode": "QZNSAU989",
      "CityName": "SIENNA",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN8",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: 9,
      "Citycode": "QZNSIK990",
      "CityName": "SIKATUNA VILLAGE",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN9",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: 10,
      "Citycode": "QZNSIK991",
      "CityName": "SILANGAN",
      "State": "QUEZON CITY",
      "Modifiedby": "ADMIN10",
      "ModifiedOn": "2024-01-12",
      Description:"TEST PURPOSE",
    }
  ]
  ,
  CityListById: "",
  SearchCity: [],
  CityEdit: ""
};
const cityReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getCityMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCityMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.cityTableList = action.payload;
    });
    builder.addCase(getCityMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.userTableList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getCityListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCityListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.CityListById = action.payload;
    });
    builder.addCase(getCityListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.CityListById = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchCityMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchCityMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.SearchCity = action.payload;
    });
    builder.addCase(getSearchCityMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.SearchCity = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddCityMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddCityMiddleware.fulfilled, (state, action) => {
      console.log(action.payload, 'find action.payload')
      state.loading = false;
      state.cityTableList = [...state.cityTableList, action.payload];
    });
    builder.addCase(postAddCityMiddleware.rejected, (state, action) => {
      state.loading = false;

      //   state.paymentVocherList = state.paymentVocherList;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(patchCityEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchCityEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        console.log(state.cityTableList, "state.countryTableList");
        const updatedIndex = state.cityTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedAddDisbursmentTable = [...state.cityTableList];
          updatedAddDisbursmentTable[updatedIndex] = action.payload;
          state.cityTableList = updatedAddDisbursmentTable;
        } else {
          state.cityTableList = [...state.cityTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchCityEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.CityEdit = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );



  },
});

export default cityReducer.reducer;
