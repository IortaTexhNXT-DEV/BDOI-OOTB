import { createSlice } from "@reduxjs/toolkit";
import { getProfileMiddleware, getEmployeeListByIdMiddleware, patchProfileEditMiddleware, getProfileEditMiddleWare } from "./profileMiddleware";
const initialState = {
  loading: false,
  error: "",
  profileData: [
    {
      id: 1,
      firstName: "Carson",
      lastName: "Darrin",
      prefferedName: "Carson Darrin",
      dateOfBirth: "03/01/24",
      gender: "Male",
      emailId: "Carsondarrin@gmail.com",
      contactNumber: "987321654",
      houseNoUnitNoStreet: "Building #1234, Street 132",
      barangaySubd: "Davao City ",
      country: "Thailand",
      province: "Cagayan",
      city: "Manila",
      zipCode: "500080"


    },






  ],
  profileEditData: [],

};

const profileReducers = createSlice({
  name: "profile",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getProfileMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getProfileMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.profileData = action.payload;
    });
    builder.addCase(getProfileMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.profileData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });





    builder.addCase(patchProfileEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchProfileEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.profileData.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.profileData];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.profileData = updatedCurrencyList;

        } else {
          state.profileData = [...state.profileData, action.payload];
        }
      }
    );
    builder.addCase(
      patchProfileEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );




    builder.addCase(getProfileEditMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getProfileEditMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.profileEditData = action.payload;
      }
    );
    builder.addCase(
      getProfileEditMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.profileEditData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


  },
});

export default profileReducers.reducer;
