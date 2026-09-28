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
  return handleResponse(response);
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

const productConfiguratorService = {
  getProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  getProductTemplateById,
};

export default productConfiguratorService;
