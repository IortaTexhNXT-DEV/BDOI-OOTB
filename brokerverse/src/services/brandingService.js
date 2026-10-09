/**
 * Branding and e-signatures: the theme of the environment (its e-mail and document sections are edited on
 * Master > System Configuration > E-mail Layout and Documents and Reports Layout), sample document / e-mail, printable
 * documents, signature capture and the document signature mapping (Document Signatures).
 */
import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const json = async (response, fallback) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body.message || `${fallback} (${response.status})`);
    err.errors = body.errors || [];
    err.status = response.status;
    throw err;
  }
  return body.data !== undefined ? body.data : body;
};
const headers = (extra = {}) => ({ Accept: "application/json", ...authService.getAuthHeader(), ...extra });
const send = (method, body) => ({ method, headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
const blob = async (response, fallback) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body.message || `${fallback} (${response.status})`);
    err.errors = body.errors || [];
    throw err;
  }
  return response.blob();
};

/** Open a branded PDF of the API in a new tab (bearer request, blob URL). */
const openPdf = async (response) => {
  const file = await blob(response, "Printing failed");
  window.open(URL.createObjectURL(file), "_blank", "noopener");
};

const brandingService = {
  /** Printable journal voucher (Accounts > Journal Voucher > Details > Print). */
  printJournalVoucher: async (id) => openPdf(await fetch(`${BASE_URL}/journal-vouchers/${encodeURIComponent(id)}/pdf`, { headers: headers() })),
  /** Printable endorsement (Endorsement > Detailed view > Print). */
  printEndorsement: async (id) => openPdf(await fetch(`${BASE_URL}/endorsements/${encodeURIComponent(id)}/pdf`, { headers: headers() })),
  getEditor: async () => json(await fetch(`${BASE_URL}/branding/theme`, { headers: headers() }), "Failed to load the theme"),
  validate: async (theme) => json(await fetch(`${BASE_URL}/branding/theme/validate`, send("POST", { theme })), "Failed to check the theme"),
  save: async (theme) => json(await fetch(`${BASE_URL}/branding/theme`, send("PUT", { theme })), "Failed to save the theme"),
  previewDocument: async (theme) => blob(await fetch(`${BASE_URL}/branding/preview-document?lenient=1`, send("POST", { theme })), "Sample document failed"),
  previewEmail: async (theme) => json(await fetch(`${BASE_URL}/branding/preview-email`, send("POST", { theme })), "Sample e-mail failed"),

  // e-signatures
  consent: async (ownerType, ownerId) => json(await fetch(`${BASE_URL}/e-signatures/consent?ownerType=${ownerType}&ownerId=${encodeURIComponent(ownerId || "")}`, { headers: headers() }), "Failed to load the consent statement"),
  listSignatures: async (ownerType, ownerId) => json(await fetch(`${BASE_URL}/e-signatures?ownerType=${ownerType}&ownerId=${encodeURIComponent(ownerId || "")}`, { headers: headers() }), "Failed to load signatures"),
  captureDrawn: async ({ ownerType, ownerId, imageData, effectiveFrom, consent }) =>
    json(await fetch(`${BASE_URL}/e-signatures`, send("POST", { ownerType, ownerId, method: "drawn", imageData, effectiveFrom, consent })), "Failed to save the signature"),
  captureUpload: async ({ ownerType, ownerId, file, effectiveFrom, consent }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("ownerType", ownerType);
    if (ownerId) form.append("ownerId", ownerId);
    form.append("method", "uploaded");
    if (effectiveFrom) form.append("effectiveFrom", effectiveFrom);
    form.append("consent", String(!!consent));
    return json(await fetch(`${BASE_URL}/e-signatures`, { method: "POST", headers: headers(), body: form }), "Failed to save the signature");
  },
  revokeSignature: async (id, reason) => json(await fetch(`${BASE_URL}/e-signatures/${id}/revoke`, send("POST", { reason })), "Failed to revoke the signature"),
  signatureImage: async (id) => blob(await fetch(`${BASE_URL}/e-signatures/${id}/image`, { headers: headers() }), "Failed to load the signature"),
  getSlots: async () => json(await fetch(`${BASE_URL}/e-signatures/slots`, { headers: headers() }), "Failed to load the signature mapping"),
  saveSlots: async (slots) => json(await fetch(`${BASE_URL}/e-signatures/slots`, send("PUT", { slots })), "Failed to save the signature mapping"),
};

export default brandingService;
