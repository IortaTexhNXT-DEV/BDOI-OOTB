import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_PROFILE_DETAILS,
  PATCH_PROFILE_EDIT,
  GET_EDIT_PROFILE,
} from "../../../../../redux/actionTypes";
import profileService from "../../../../../services/profileService";

/** API profile -> the profile card's field names (fields the API does not store stay empty). */
const toProfileCard = (profile) => ({
  id: profile.userId,
  firstName: profile.firstName || "",
  lastName: profile.lastName || "",
  prefferedName: profile.displayName || "",
  emailId: profile.email || "",
  contactNumber: profile.phone || "",
  employeeCode: profile.employeeCode || "",
  dateOfBirth: "",
  gender: "",
  houseNoUnitNoStreet: "",
  barangaySubd: "",
  country: "",
  province: "",
  city: "",
  zipCode: "",
});

const blankToUndefined = (value) => (value ? value : undefined);

export const getProfileMiddleware = createAsyncThunk(
  GET_PROFILE_DETAILS,
  async (_payload, { rejectWithValue }) => {
    try {
      return [toProfileCard(await profileService.getProfile())];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const patchProfileEditMiddleware = createAsyncThunk(
  PATCH_PROFILE_EDIT,
  async (payload, { rejectWithValue }) => {
    try {
      await profileService.updateProfile({
        displayName: blankToUndefined(payload.prefferedName),
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: blankToUndefined(payload.emailId),
        phone: payload.contactNumber,
      });
      return toProfileCard(await profileService.getProfile());
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getProfileEditMiddleWare = createAsyncThunk(
  GET_EDIT_PROFILE,
  async (payload) => payload
);
