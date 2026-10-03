import { createSlice } from "@reduxjs/toolkit";
import { getProfileMiddleware, patchProfileEditMiddleware, getProfileEditMiddleWare } from "./profileMiddleware";
const initialState = {
  loading: false,
  error: "",
  profileData: [],
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

      state.profileData = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });





    builder.addCase(patchProfileEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchProfileEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.profileData = [action.payload];
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
