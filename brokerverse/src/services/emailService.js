import authService from "./authService";
import { BASE_URL } from "../utility/constant";

/**
 * E-mails of the quote Share dialog (/email/*). Every method resolves to
 * { success: true, data } or { success: false, error } and never throws.
 */
const EMAIL_URL = `${BASE_URL}/email`;

async function post(path, body, fallbackError, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${EMAIL_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.message || fallbackError);
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
};

export default emailService;
