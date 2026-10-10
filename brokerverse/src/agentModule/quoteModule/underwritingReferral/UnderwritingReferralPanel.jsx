import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { BASE_URL } from "../../../utility/constant";
import authService from "../../../services/authService";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import DetailDialog from "../../../components/DetailDialog";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
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

/** A reason as the rule gives it ("RULE_CODE: message"), without its code. */
const reasonText = (reason) => String(reason).replace(/^[A-Z0-9_-]+:\s*/, "");

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

  const open = (next) => {
    setRemarks("");
    setReference("");
    setDecision(next);
  };
  const submit = async () => {
    setBusy(true);
    try {
      await decide(quotation.quotationId, { decision, remarks: remarks.trim() || null, insurerReference: reference.trim() || null });
      notifySuccess(t(decision === "approve" ? "underwritingReferral.approved" : "underwritingReferral.declined"));
      setDecision(null);
      onDecided?.();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reasons = (referral?.reasons || referral?.ruleCodes || []).map(reasonText);
  const reasonList = reasons.length ? <ul className="uw-referral__reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null;
  const decided = referral && referral.status !== "pending";
  const approving = decision === "approve";

  return (
    <DetailSection className="uw-referral" title={t("underwritingReferral.title")}
      actions={referral?.status === "pending" && mayDecide(referral) ? (
        <>
          <Button label={t("underwritingReferral.decline")} icon="pi pi-times" severity="danger" outlined size="small" onClick={() => open("decline")} />
          <Button label={t("underwritingReferral.approve")} icon="pi pi-check" size="small" onClick={() => open("approve")} />
        </>
      ) : null}>
      <KeyValueGrid columns={4} items={[
        { label: t("underwritingReferral.statusLabel"), value: referral ? <StatusChip code={referral.status} label={t(`underwritingReferral.status.${referral.status}`)} /> : null, hidden: !referral },
        { label: t("underwritingReferral.requestedAt"), value: referral?.requestedAt, type: "datetime", hidden: !referral?.requestedAt },
        { label: t("underwritingReferral.authority"), value: (referral?.authorityRoleNames || referral?.authorityRoles || []).join(" / "), hidden: !referral },
        { label: t("underwritingReferral.sumInsured"), value: quotation.totalSumInsured, type: "amount", currency: quotation.currency, hidden: !referral },
        { label: t("underwritingReferral.decidedByLabel"), value: referral?.decidedByName || referral?.decidedBy, hidden: !decided },
        { label: t("underwritingReferral.decidedAt"), value: referral?.decidedAt, type: "datetime", hidden: !decided },
        { label: t("underwritingReferral.insurerReference"), value: referral?.insurerReference, hidden: !decided },
        { label: t("underwritingReferral.remarks"), value: referral?.remarks, span: "full", hidden: !decided },
        { label: t("underwritingReferral.reasons"), value: reasonList, span: "full", hidden: !reasonList },
        { label: t("underwritingReferral.loadings"), value: loadings.map((l) => `${l.ruleName} (+${l.loadingPercent}%)`).join(", "), span: "full", hidden: !loadings.length },
      ]} />
      <DetailDialog visible={Boolean(decision)} onHide={() => setDecision(null)} size="md"
        header={t(approving ? "underwritingReferral.approveTitle" : "underwritingReferral.declineTitle")}
        footer={(
          <>
            <Button type="button" label={t("underwritingReferral.cancel")} text disabled={busy} onClick={() => setDecision(null)} />
            <Button type="button" label={t(approving ? "underwritingReferral.approve" : "underwritingReferral.decline")} severity={approving ? undefined : "danger"}
              loading={busy} disabled={!approving && !remarks.trim()} onClick={submit} />
          </>
        )}>
        <KeyValueGrid columns={2} className="mb-3" items={[
          { label: t("underwritingReferral.quotation"), value: quotation.quotationNumber },
          { label: t("underwritingReferral.sumInsured"), value: quotation.totalSumInsured, type: "amount", currency: quotation.currency },
          { label: t("underwritingReferral.reasons"), value: reasonList, span: "full", hidden: !reasonList },
        ]} />
        <div className="p-fluid">
          <div className="field">
            <label htmlFor="uw-remarks">{t("underwritingReferral.remarks")}{approving ? "" : " *"}</label>
            <InputTextarea id="uw-remarks" rows={3} value={remarks} autoResize onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div className="field mb-0">
            <label htmlFor="uw-ref">{t("underwritingReferral.insurerReference")}</label>
            <InputText id="uw-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
      </DetailDialog>
    </DetailSection>
  );
};

UnderwritingReferralPanel.propTypes = { quotation: PropTypes.object, onDecided: PropTypes.func };

export default UnderwritingReferralPanel;
