import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import systemSettingsService from "../../../services/systemSettingsService";
import { applySystemSettings } from "../../../utility/applySystemSettings";
import {
  DEFAULT_SYSTEM_SETTINGS,
  LOGO_PRESETS,
} from "../../../utility/systemCurrencies";

const mapLogoPresets = (presets) => {
  if (Array.isArray(presets) && presets.length > 0) return presets;
  return LOGO_PRESETS.map((p, i) => ({
    id: `local-${i}`,
    label: p.label,
    url: p.value,
    builtIn: true,
  }));
};

const applyPayloadToState = (state, payload) => {
  if (!payload) return;
  state.logoUrl = payload.logoUrl || state.logoUrl || DEFAULT_SYSTEM_SETTINGS.logoUrl;
  state.logoPresets = mapLogoPresets(payload.logoPresets);
  state.displayCurrency = payload.displayCurrency ?? state.displayCurrency;
  state.primaryColor = payload.primaryColor ?? state.primaryColor;
  state.secondaryColor = payload.secondaryColor ?? state.secondaryColor;
  state.defaultLanguage = payload.defaultLanguage ?? state.defaultLanguage;
  state.faviconUrl = payload.faviconUrl ?? state.faviconUrl;
  state.systemName = payload.systemName ?? state.systemName;
  if (payload.currencies) {
    state.currencies = payload.currencies;
  }
  // accounting (ledger) base currency from the Currency master; the display currency only relabels amounts
  state.baseCurrency = payload.baseCurrency ?? state.baseCurrency ?? null;
};

export const fetchSystemSettings = createAsyncThunk(
  "systemSettings/fetch",
  async (options = {}, { rejectWithValue }) => {
    try {
      const data = await systemSettingsService.getSettings();
      applySystemSettings(data, options);
      return data;
    } catch (error) {
      applySystemSettings(DEFAULT_SYSTEM_SETTINGS, options);
      return rejectWithValue(error.message);
    }
  }
);

export const saveSystemSettings = createAsyncThunk(
  "systemSettings/save",
  async ({ payload, applyOptions = {} }, { rejectWithValue }) => {
    try {
      const data = await systemSettingsService.updateSettings(payload);
      applySystemSettings(data, applyOptions);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const uploadSystemAsset = createAsyncThunk(
  "systemSettings/upload",
  async ({ field, file, applyOptions = {} }, { rejectWithValue }) => {
    try {
      const data = await systemSettingsService.uploadAsset(field, file);
      applySystemSettings(data, applyOptions);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addLogoPreset = createAsyncThunk(
  "systemSettings/addLogoPreset",
  async ({ label, url, file, setActive = true, applyOptions = {} }, { rejectWithValue }) => {
    try {
      const data = await systemSettingsService.addLogoPreset({
        label,
        url,
        file,
        setActive,
      });
      applySystemSettings(data, applyOptions);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const removeLogoPreset = createAsyncThunk(
  "systemSettings/removeLogoPreset",
  async ({ id, applyOptions = {} }, { rejectWithValue }) => {
    try {
      const data = await systemSettingsService.removeLogoPreset(id);
      applySystemSettings(data, applyOptions);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  ...DEFAULT_SYSTEM_SETTINGS,
  logoPresets: mapLogoPresets(),
  currencies: [],
  loading: false,
  saving: false,
  error: null,
  loaded: false,
};

const systemSettingsSlice = createSlice({
  name: "systemSettings",
  initialState,
  reducers: {
    clearSystemSettingsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSystemSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPayloadToState(state, action.payload);
      })
      .addCase(fetchSystemSettings.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload;
      })
      .addCase(saveSystemSettings.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveSystemSettings.fulfilled, (state, action) => {
        state.saving = false;
        applyPayloadToState(state, action.payload);
      })
      .addCase(saveSystemSettings.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(uploadSystemAsset.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(uploadSystemAsset.fulfilled, (state, action) => {
        state.saving = false;
        applyPayloadToState(state, action.payload);
      })
      .addCase(uploadSystemAsset.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(addLogoPreset.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(addLogoPreset.fulfilled, (state, action) => {
        state.saving = false;
        applyPayloadToState(state, action.payload);
      })
      .addCase(addLogoPreset.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(removeLogoPreset.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(removeLogoPreset.fulfilled, (state, action) => {
        state.saving = false;
        applyPayloadToState(state, action.payload);
      })
      .addCase(removeLogoPreset.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { clearSystemSettingsError } = systemSettingsSlice.actions;
export default systemSettingsSlice.reducer;
