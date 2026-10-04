import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Address Service
 * Philippine address masters (PSGC): countries, regions, provinces, cities / municipalities, barangays, the ZIP codes
 * of a city and the ZIP code look-up.
 */
class AddressService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /** GET a list from /addresses/...; { success, data } or { success: false, error }. */
  async getList(path, failure) {
    try {
      const response = await fetch(`${this.baseURL}/addresses/${path}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || failure);
      }
      const data = await response.json();
      return { success: true, data: Array.isArray(data) ? data : data?.data ?? [] };
    } catch (error) {
      return { success: false, error: error.message || failure };
    }
  }

  /** Regions of a country (id, code or name), in the PSA order. */
  async getRegionsByCountry(countryId) {
    if (!countryId) return { success: true, data: [] };
    return this.getList(`countries/${encodeURIComponent(countryId)}/regions`, "Failed to fetch regions");
  }

  /** Provinces of a region (id, code or name). */
  async getProvincesByRegion(regionId) {
    if (!regionId) return { success: true, data: [] };
    return this.getList(`regions/${encodeURIComponent(regionId)}/provinces`, "Failed to fetch provinces");
  }

  /** Barangays of a city / municipality (id, PSGC code or name); empty when not loaded. */
  async getBarangaysByCity(cityId) {
    if (!cityId) return { success: true, data: [] };
    return this.getList(`cities/${encodeURIComponent(cityId)}/barangays`, "Failed to fetch barangays");
  }

  /** ZIP codes of a city / municipality: its main ZIP code first. */
  async getPostalCodesByCity(cityId) {
    if (!cityId) return { success: true, data: [] };
    return this.getList(`cities/${encodeURIComponent(cityId)}/postal-codes`, "Failed to fetch ZIP codes");
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
      return { success: false, error: error.message || "Failed to fetch districts" };
    }
  }

  /**
   * ZIP / postal code look-up. Returns [{ region, province, city, district }] for auto-fill.
   * @param {string} countryCode - e.g. "PH"
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
      return { success: false, error: error.message || "Postal code lookup failed" };
    }
  }
}

const addressService = new AddressService();
export default addressService;
