import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Address Service
 * Address masters: countries, provinces, cities, districts, and postal code lookup (Thailand).
 */
class AddressService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Get all countries
   * @returns {Promise<Object>} { success, data: [{ id, code, name }] }
   */
  async getCountries() {
    try {
      const response = await fetch(`${this.baseURL}/addresses/countries`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to fetch countries");
      }
      const data = await response.json();
      return { success: true, data: Array.isArray(data) ? data : data?.data ?? data };
    } catch (error) {
      console.error("getCountries error:", error);
      return { success: false, error: error.message || "Failed to fetch countries" };
    }
  }

  /**
   * Get provinces by country ID
   * @param {string|number} countryId
   * @returns {Promise<Object>} { success, data: [{ id, code?, name }] }
   */
  async getProvincesByCountry(countryId) {
    if (!countryId) return { success: true, data: [] };
    try {
      const response = await fetch(
        `${this.baseURL}/addresses/countries/${encodeURIComponent(countryId)}/provinces`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to fetch provinces");
      }
      const data = await response.json();
      return { success: true, data: Array.isArray(data) ? data : data?.data ?? data };
    } catch (error) {
      console.error("getProvincesByCountry error:", error);
      return { success: false, error: error.message || "Failed to fetch provinces" };
    }
  }

  /**
   * Get cities by province ID
   * @param {string|number} provinceId
   * @returns {Promise<Object>} { success, data: [{ id, code?, name }] }
   */
  async getCitiesByProvince(provinceId) {
    if (!provinceId) return { success: true, data: [] };
    try {
      const response = await fetch(
        `${this.baseURL}/addresses/provinces/${encodeURIComponent(provinceId)}/cities`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to fetch cities");
      }
      const data = await response.json();
      return { success: true, data: Array.isArray(data) ? data : data?.data ?? data };
    } catch (error) {
      console.error("getCitiesByProvince error:", error);
      return { success: false, error: error.message || "Failed to fetch cities" };
    }
  }

  /**
   * Get districts by city ID
   * @param {string|number} cityId
   * @returns {Promise<Object>} { success, data: [{ id, code?, name }] }
   */
  async getDistrictsByCity(cityId) {
    if (!cityId) return { success: true, data: [] };
    try {
      const response = await fetch(
        `${this.baseURL}/addresses/cities/${encodeURIComponent(cityId)}/districts`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to fetch districts");
      }
      const data = await response.json();
      return { success: true, data: Array.isArray(data) ? data : data?.data ?? data };
    } catch (error) {
      console.error("getDistrictsByCity error:", error);
      return { success: false, error: error.message || "Failed to fetch districts" };
    }
  }

  /**
   * Postal code lookup (e.g. Thailand). Returns [{ province, city, district }] for auto-fill.
   * @param {string} countryCode - e.g. "TH"
   * @param {string} code - postal/zip code
   * @returns {Promise<Object>} { success, data: Array<{ province, city, district }> }
   */
  async getPostalCodeLookup(countryCode, code) {
    if (!countryCode || !code || String(code).trim() === "")
      return { success: true, data: [] };
    try {
      const params = new URLSearchParams({ countryCode, code });
      const response = await fetch(
        `${this.baseURL}/addresses/postal-code?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Postal code not found");
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : data?.data ?? (data ? [data] : []);
      return { success: true, data: list };
    } catch (error) {
      console.error("getPostalCodeLookup error:", error);
      return { success: false, error: error.message || "Postal code lookup failed" };
    }
  }
}

const addressService = new AddressService();
export default addressService;
