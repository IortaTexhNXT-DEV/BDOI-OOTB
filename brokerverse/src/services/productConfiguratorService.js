import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch product configurator data");
  }

  const data = await response.json().catch(() => null);

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  if (data && Array.isArray(data.results)) {
    return data.results;
  }

  return data ?? [];
};

export const getProductTemplates = async () => {
  const response = await fetch(`${BASE_URL}/product-configurator/products`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeader()
    }
  });
  return handleResponse(response);
};

export const getProductTemplateById = async ({ id, templateCode }) => {
  let response;
  if (id) {
    response = await fetch(
      `${BASE_URL}/product-configurator/products/configurator?id=${id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader()
        }
      }
    );
  } else if (templateCode) {
    response = await fetch(
      `${BASE_URL}/product-configurator/products/configurator?templateCode=${templateCode}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader()
        }
      }
    );
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch product template");
  }
  const data = await response.json().catch(() => null);
  return data?.data ?? data;
};

export const createProductTemplate = async (templateData) => {
  const response = await fetch(`${BASE_URL}/product-configurator/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeader()
    },
    body: JSON.stringify(templateData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to create product template");
  }

  const data = await response.json().catch(() => ({}));
  if (data && data.data) {
    return data.data;
  }
  return data;
};

export const updateProductTemplate = async (templateData) => {
  const response = await fetch(
    `${BASE_URL}/product-configurator/products/${templateData.id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader()
      },
      body: JSON.stringify(templateData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to update product template");
  }

  const data = await response.json().catch(() => ({}));
  if (data && data.data) {
    return data.data;
  }
  return data;
};

const getRiskMappings = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.status) params.append("status", filters.status);
  if (filters.definitionType) params.append("definitionType", filters.definitionType);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(
    `${BASE_URL}/product-configurator/risk-mappings${qs}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
    }
  );
  return handleResponse(response);
};

const getRiskMappingById = async (id, { includeInactive = false } = {}) => {
  const qs = includeInactive ? "?includeInactive=true" : "";
  const response = await fetch(
    `${BASE_URL}/product-configurator/risk-mappings/${id}${qs}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch risk mapping");
  }
  const data = await response.json().catch(() => ({}));
  return data?.data ?? data;
};

const updateRiskMapping = async (id, payload) => {
  const response = await fetch(
    `${BASE_URL}/product-configurator/risk-mappings/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to update risk mapping");
  }
  const data = await response.json().catch(() => ({}));
  return data?.data ?? data;
};

const getRiskSectionOptions = async (id) => {
  const response = await fetch(
    `${BASE_URL}/product-configurator/risk-mappings/${id}/section-options`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
    }
  );
  return handleResponse(response);
};

const addRiskSection = async (id, payload) => {
  const response = await fetch(
    `${BASE_URL}/product-configurator/risk-mappings/${id}/sections`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to add section");
  }
  const data = await response.json().catch(() => ({}));
  return data?.data ?? data;
};

const updateRiskSection = async (id, sectionId, payload) => {
  const response = await fetch(
    `${BASE_URL}/product-configurator/risk-mappings/${id}/sections/${sectionId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to update section");
  }
  const data = await response.json().catch(() => ({}));
  return data?.data ?? data;
};

const deactivateRiskSection = async (id, sectionId) => {
  const response = await fetch(
    `${BASE_URL}/product-configurator/risk-mappings/${id}/sections/${sectionId}/deactivate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to remove section");
  }
  const data = await response.json().catch(() => ({}));
  return data?.data ?? data;
};

/** JSON request for the /product-configurator endpoints; throws with the API's message. */
const call = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}/product-configurator/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    const detail = json.errors?.map((e) => e.message).join(", ");
    throw new Error(detail || json.message || `Request failed (${response.status})`);
  }
  return json.data;
};

/**
 * Configuration components by kind: coverages, rating-factors, underwriting-rules, documents, workflows,
 * market-mappings, commissions, taxes, acceptance-limits, rating-parameters.
 */
const listComponents = (kind, params = {}) => {
  const qs = new URLSearchParams({ perPage: 200, ...params }).toString();
  return call("GET", `${kind}?${qs}`);
};
const createComponent = (kind, payload) => call("POST", kind, payload);
const updateComponent = (kind, id, payload) => call("PUT", `${kind}/${id}`, payload);
const deleteComponent = (kind, id) => call("DELETE", `${kind}/${id}`);
const saveComponent = (kind, record) => {
  const { id, createdAt, updatedAt, createdBy, templateCode, ...payload } = record;
  return id ? updateComponent(kind, id, payload) : createComponent(kind, payload);
};

const retireProductTemplate = (id, reason) => call("POST", `products/${id}/retire`, { reason });
const reactivateProductTemplate = (id) => call("POST", `products/${id}/reactivate`, {});
const createProductVersion = (id, payload = {}) => call("POST", `products/${id}/versions`, payload);
const getProductAnalytics = () => call("GET", "analytics");

const productConfiguratorService = {
  listComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  saveComponent,
  retireProductTemplate,
  reactivateProductTemplate,
  createProductVersion,
  getProductAnalytics,
  getProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  getProductTemplateById,
  getRiskMappings,
  getRiskMappingById,
  updateRiskMapping,
  getRiskSectionOptions,
  addRiskSection,
  updateRiskSection,
  deactivateRiskSection,
};

export default productConfiguratorService;
