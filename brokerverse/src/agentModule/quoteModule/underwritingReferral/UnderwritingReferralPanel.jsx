import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { BASE_URL } from "../../../utility/constant";
import authService from "../../../services/authService";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import "./UnderwritingReferralPanel.scss";

/** Roles of the signed-in user (stored at sign-in). */
const myRoles = () => {
  try {
    return JSON.parse(localStorage.getItem("USER_ROLES") || "[]");
  } catch {
    return [];
  }
};

/** Whether the user may decide a referral: one of its authority roles, or the System Administrator. */
export const mayDecide = (referral, roles = myRoles()) => roles.includes("system-admin") || (referral?.authorityRoles || []).some((r) => roles.includes(r));

const decide = async (quotationId, body) => {
  const response = await fetch(`${BASE_URL}/quotations/${encodeURIComponent(quotationId)}/underwriting-referral`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) throw new Error(json.message || `Request failed (${response.status})`);
  return json.data;
};

const SEVERITY = { pending: "warning", approved: "success", declined: "danger" };

/**
 * Underwriting outcome of a quotation from the product's acceptance rules: a pending referral (with Approve / Decline
 * for the authority role), an approved or declined referral, and the loadings added to the premium.
 */
const UnderwritingReferralPanel = ({ quotation, onDecided }) => {
  const { t } = useTranslation();
  const [decision, setDecision] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const referral = quotation?.underwritingReferral;
  const uw = quotation?.premiumBreakdown?.underwriting;
  const loadings = (uw?.results || []).filter((r) => r.outcome === "loaded");
  if (!referral && !loadings.length) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await decide(quotation.quotationId, { decision, remarks: remarks || null, insurerReference: reference || null });
      notifySuccess(t(decision === "approve" ? "underwritingReferral.approved" : "underwritingReferral.declined"));
      setDecision(null);
      onDecided?.();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="uw-referral" aria-label={t("underwritingReferral.title")}>
      {referral && (
        <div className="uw-referral__row">
          <div>
            <strong>{t("underwritingReferral.title")}</strong>{" "}
            <Tag value={t(`underwritingReferral.status.${referral.status}`)} severity={SEVERITY[referral.status] || "info"} />
            <ul className="uw-referral__reasons">
              {(referral.reasons || referral.ruleCodes || []).map((r) => <li key={r}>{r}</li>)}
            </ul>
            {referral.status === "pending" && (
              <small>{t("underwritingReferral.awaiting", { roles: (referral.authorityRoleNames || referral.authorityRoles || []).join(" / ") })}</small>
            )}
            {referral.status !== "pending" && (
              <small>
                {t("underwritingReferral.decidedBy", { user: referral.decidedBy || "" })}
                {referral.insurerReference ? ` · ${t("underwritingReferral.insurerReference")}: ${referral.insurerReference}` : ""}
                {referral.remarks ? ` · ${referral.remarks}` : ""}
              </small>
            )}
          </div>
          {referral.status === "pending" && mayDecide(referral) && (
            <div className="uw-referral__actions">
              <Button label={t("underwritingReferral.approve")} icon="pi pi-check" onClick={() => setDecision("approve")} />
              <Button label={t("underwritingReferral.decline")} icon="pi pi-times" className="p-button-outlined p-button-danger" onClick={() => setDecision("decline")} />
            </div>
          )}
        </div>
      )}
      {loadings.length > 0 && (
        <p className="uw-referral__loadings">
          {t("underwritingReferral.loadings")}: {loadings.map((l) => `${l.ruleName} (+${l.loadingPercent}%)`).join(", ")}
        </p>
      )}
      <Dialog header={t(decision === "approve" ? "underwritingReferral.approveTitle" : "underwritingReferral.declineTitle")} visible={Boolean(decision)} onHide={() => setDecision(null)} style={{ width: "32rem" }} breakpoints={{ "640px": "95vw" }}>
        <div className="p-fluid">
          <div className="field">
            <label htmlFor="uw-remarks">{t("underwritingReferral.remarks")}{decision === "decline" ? " *" : ""}</label>
            <InputTextarea id="uw-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="uw-ref">{t("underwritingReferral.insurerReference")}</label>
            <InputText id="uw-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button label={t("common.confirm")} onClick={submit} loading={busy} disabled={decision === "decline" && !remarks.trim()} />
        </div>
      </Dialog>
    </section>
  );
};

UnderwritingReferralPanel.propTypes = { quotation: PropTypes.object, onDecided: PropTypes.func };

export default UnderwritingReferralPanel;
