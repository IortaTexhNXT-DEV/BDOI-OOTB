import { BASE_URL } from "../utility/constant";
import authService from "./authService";

class SystemSettingsService {
  constructor() {
    this.baseURL = `${BASE_URL}/system-settings`;
  }

  async getSettings() {
    const response = await fetch(this.baseURL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Failed to load settings (${response.status})`);
    }

    const json = await response.json();
    return json.data || json;
  }

  /** Configuration values of a group (GET /settings?group=tax) as [{ key, value, label, type }]. */
  async getConfiguration(group) {
    const response = await fetch(`${BASE_URL}/settings?group=${encodeURIComponent(group)}`, {
      method: "GET",
      headers: { Accept: "application/json", ...authService.getAuthHeader() },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.message || `Failed to load configuration (${response.status})`);
    }
    return json.data || [];
  }

  async updateSettings(payload) {
    const response = await fetch(this.baseURL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.message || `Failed to update settings (${response.status})`);
    }
    return json.data || json;
  }

  async uploadAsset(field, file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseURL}/upload/${field}`, {
      method: "POST",
      headers: {
        ...authService.getAuthHeader(),
      },
      body: formData,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.message || `Upload failed (${response.status})`);
    }
    return json.data || json;
  }

  /**
   * Add a company logo preset.
   * @param {{ label: string, url?: string, file?: File, setActive?: boolean }} params
   */
  async addLogoPreset({ label, url, file, setActive = true }) {
    let response;
    if (file) {
      const formData = new FormData();
      formData.append("label", label);
      formData.append("file", file);
      formData.append("setActive", String(setActive));
      response = await fetch(`${this.baseURL}/logo-presets`, {
        method: "POST",
        headers: {
          ...authService.getAuthHeader(),
        },
        body: formData,
      });
    } else {
      response = await fetch(`${this.baseURL}/logo-presets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ label, url, setActive }),
      });
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.message || `Failed to add logo (${response.status})`);
    }
    return json.data || json;
  }

  async removeLogoPreset(id) {
    const response = await fetch(
      `${this.baseURL}/logo-presets/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...authService.getAuthHeader(),
        },
      }
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.message || `Failed to remove logo (${response.status})`);
    }
    return json.data || json;
  }
}

const systemSettingsService = new SystemSettingsService();
export default systemSettingsService;
