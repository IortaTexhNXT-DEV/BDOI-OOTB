import { createAsyncThunk } from "@reduxjs/toolkit";
import { getProductTemplateById } from "../../../services/productConfiguratorService";

export const fetchProductTemplateByIdMiddleware = createAsyncThunk(
  "productConfigurator/fetchProductTemplateById",
  async ({ templateId, templateCode }, { rejectWithValue }) => {
    try {
      const response = await getProductTemplateById({
        id: templateId,
        templateCode,
      });

      if (!response) {
        return rejectWithValue("Product template not found");
      }

      return response;
    } catch (error) {
      return rejectWithValue(
        error?.message || "Failed to fetch product template"
      );
    }
  }
);
