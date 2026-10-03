import { createAsyncThunk } from "@reduxjs/toolkit";
import paymentsService from "../../../services/paymentsService";

const DAY_MS = 24 * 60 * 60 * 1000;

const daysUntil = (date) => {
  if (!date) return "";
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / DAY_MS);
  return `${days} Days`;
};

/** Open-item rows in the field names each "See more" table reads. */
export const ROW_MAPPERS = {
  quote: (item) => ({
    id: item.id,
    Name: item.name,
    LeadId: item.clientId || "",
    QuoteId: item.quoteId || "",
    Category: item.quoteStatus || "",
    PolicyType: item.insurer || "",
    Date: item.validUntil || "",
    Actions: item.amount || "",
  }),
  renewal: (item) => ({
    id: item.id,
    policyId: item.policyId,
    Name: item.name,
    ClientId: item.clientId || "",
    PolicyNumber: item.policyNo || "",
    PolicyType: item.insurer || "",
    Date: item.renewalDate || "",
    Category: item.renewalStatus || "",
    Actions: item.clientId || "",
  }),
  expiring: (item) => ({
    id: item.id,
    policyId: item.policyId,
    AssuredName: item.name,
    PolicyNumber: item.policyNo || "",
    ExpiryDate: item.expiryDate || "",
    policyIssued: item.insurer || "",
    gross: item.amount || "",
    Expiry: daysUntil(item.expiryDate),
    Actions: item.clientId || "",
  }),
};

const errorMessage = (error) => error?.message || "Something went wrong";

/** Thunk that loads the open items of one type (quote, renewal, expiring); search is optional. */
export const openItemsThunk = (actionType, type) =>
  createAsyncThunk(actionType, async (params, { rejectWithValue }) => {
    try {
      const { items = [] } = await paymentsService.getOpenItems({
        type,
        search: params?.value || params?.search,
      });
      return items.map(ROW_MAPPERS[type]);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  });
