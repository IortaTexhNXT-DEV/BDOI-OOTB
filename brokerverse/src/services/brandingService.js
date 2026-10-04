/**
 * Theme and Branding (Master > System Settings > Theme and Branding) and e-signatures: the theme editor, branding
 * images, sample document / e-mail, brand packs, signature capture and the document signature mapping.
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
  save: async (theme, systemName) => json(await fetch(`${BASE_URL}/branding/theme`, send("PUT", { theme, systemName })), "Failed to save the theme"),
  uploadImage: async (asset, file) => {
    const form = new FormData();
    form.append("file", file);
    return json(await fetch(`${BASE_URL}/branding/upload/${asset}`, { method: "POST", headers: headers(), body: form }), "Upload failed");
  },
  resetImage: async (asset) => json(await fetch(`${BASE_URL}/branding/upload/${asset}`, { method: "DELETE", headers: headers() }), "Reset failed"),
  previewDocument: async (theme) => blob(await fetch(`${BASE_URL}/branding/preview-document?lenient=1`, send("POST", { theme })), "Sample document failed"),
  previewEmail: async (theme) => json(await fetch(`${BASE_URL}/branding/preview-email`, send("POST", { theme })), "Sample e-mail failed"),
  exportPack: async (format = "zip") => blob(await fetch(`${BASE_URL}/branding/brand-pack?format=${format}`, { headers: headers() }), "Export failed"),
  importPack: async (file, { dryRun = false, applyDocumentLogo = true, applySystemName = true } = {}) => {
    const form = new FormData();
    form.append("file", file);
    form.append("applyDocumentLogo", String(applyDocumentLogo));
    form.append("applySystemName", String(applySystemName));
    return json(await fetch(`${BASE_URL}/branding/brand-pack?dryRun=${dryRun ? "true" : "false"}`, { method: "POST", headers: headers(), body: form }), "Import failed");
  },
  // bundled brand packs (shipped with the product, enabled on the screen with the trademark acknowledgement)
  bundledPacks: async () => json(await fetch(`${BASE_URL}/branding/packs/bundled`, { headers: headers() }), "Failed to load the bundled brand packs"),
  checkBundledPack: async (id) => json(await fetch(`${BASE_URL}/branding/packs/bundled/${encodeURIComponent(id)}/check`, send("POST", {})), "Check failed"),
  enableBundledPack: async (id, { acknowledgedPermission = false, applyDocumentLogo = true, applySystemName = true } = {}) =>
    json(await fetch(`${BASE_URL}/branding/packs/bundled/${encodeURIComponent(id)}/enable`, send("POST", { acknowledgedPermission: acknowledgedPermission === true, applyDocumentLogo, applySystemName })), "Enable failed"),
  resetDefaultBranding: async () => json(await fetch(`${BASE_URL}/branding/packs/reset-default`, send("POST", {})), "Reset failed"),

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
