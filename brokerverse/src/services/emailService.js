import authService from "./authService";
import { BASE_URL } from "../utility/constant";
import { apiErrorMessage } from "../utility/apiError";

/**
 * E-mails of the quote Share dialog (/email/*). Every method resolves to
 * { success: true, data } or { success: false, error } and never throws.
 */
const EMAIL_URL = `${BASE_URL}/email`;

async function post(path, body, fallbackError, timeoutMs = 15000) {
  return postUrl(`${EMAIL_URL}${path}`, body, fallbackError, timeoutMs);
}

async function postUrl(url, body, fallbackError, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({}));
    // a validation failure names the field: show its message ("The client has no e-mail address; enter one")
    if (!response.ok) throw new Error(apiErrorMessage(json, response.status, fallbackError));
    return { success: true, data: json };
  } catch (error) {
    return {
      success: false,
      error: error.name === "AbortError" ? "Request timeout. Please try again." : error.message || fallbackError,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Last answer of GET /email/sending-status: { at, value }. */
let sendingCache = null;

const emailService = {
  /** E-mail a quotation with the standard share_quote template. */
  shareQuote(to, quotationData, message = "") {
    return post("/share-quote", { to, quotationData, message }, "Failed to share quote");
  },

  /** Send the quotation to insurers (one e-mail per company, PDF attached); `partial` is true when some failed. */
  async shareQuoteToInsurers({ quotationId, insuranceCompanies, productType, quotationNumber }) {
    // PDF generation and several sends take longer than one e-mail.
    const result = await post(
      "/share-quote-to-insurers",
      { quotationId, insuranceCompanies, productType, quotationNumber },
      "Failed to share quote to insurance companies",
      60000
    );
    if (result.success) result.partial = Array.isArray(result.data?.data?.failed) && result.data.data.failed.length > 0;
    return result;
  },

  /** Send an e-mail composed in the dialog: { to, subject, html | text, quotationId }. */
  sendEmail(emailData) {
    return post("/send", emailData, "Failed to send email");
  },

  /**
   * Suggested subject and body for a quote e-mail, filled in by the backend from the configured
   * share_quote template. data: { subject, previewText, html, text }.
   */
  async generateEmailContent({ template = "custom", context = {}, recipient = {} }) {
    const result = await post("/generate", { template, context, recipient }, "Failed to prepare the e-mail content", 30000);
    return result.success ? { success: true, data: result.data.data } : result;
  },

  /**
   * Whether queued e-mail actually goes out: { enabled, smtpConfigured, active }. Read once and kept for a minute;
   * null when the server cannot be asked (the caller then assumes sending works, as before).
   */
  async sendingStatus() {
    if (sendingCache && Date.now() - sendingCache.at < 60000) return sendingCache.value;
    try {
      const response = await fetch(`${EMAIL_URL}/sending-status`, { headers: { ...authService.getAuthHeader() } });
      const json = await response.json().catch(() => ({}));
      const value = response.ok ? json.data || null : null;
      sendingCache = { at: Date.now(), value };
      return value;
    } catch {
      return null;
    }
  },

  /** E-mail an official receipt to the client with its PDF attached: body { to, cc, note }; data: { message, data: { emailId, to } }. */
  emailReceipt(receiptId, body) {
    return postUrl(`${BASE_URL}/receipts/${encodeURIComponent(receiptId)}/email`, body, "Failed to e-mail the receipt", 30000);
  },

  /** E-mail the premium invoice / statement of account of a bill (receivable id or bill number) with its PDF attached. */
  emailInvoice(billId, body) {
    return postUrl(`${BASE_URL}/billing-statement/bills/${encodeURIComponent(billId)}/email`, body, "Failed to e-mail the invoice", 30000);
  },

  /** E-mail outbox (administrators): { data, sending, counts, total }. params: status, search, page, pageSize. */
  async getOutbox(params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
    const response = await fetch(`${EMAIL_URL}/outbox${qs ? `?${qs}` : ""}`, { headers: { ...authService.getAuthHeader() } });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.message || "Failed to load the e-mail outbox");
    return json;
  },

  /** Queue a failed e-mail again (sent at once when sending is enabled): { message, data }. */
  async retryOutbox(id) {
    const result = await post(`/outbox/${encodeURIComponent(id)}/retry`, {}, "Failed to retry the e-mail", 30000);
    if (!result.success) throw new Error(result.error);
    sendingCache = null;
    return result.data;
  },
};


export default emailService;
