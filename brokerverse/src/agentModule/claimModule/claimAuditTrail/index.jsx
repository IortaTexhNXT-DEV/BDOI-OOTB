import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import claimsService from "../../../services/claimsService";
import { AuditTimeline } from "../../../components/AuditTrail";
import { statusSeverity } from "../../../utils/statusSeverity";
import logger from "../../../utility/logger";
import "./index.scss";

/**
 * Claims > Audit trail of one claim: every business event of the claim (registration, adjuster report, settlement,
 * status changes) as a timeline, newest first, with who did it, from where, and the fields it changed.
 */
const ClaimAuditTrail = () => {
  const { t } = useTranslation();
  const { claimId } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);

  useEffect(() => {
    let live = true;
    claimsService.getClaimDetails(claimId).then((r) => {
      if (live && r?.success) setClaim(r.data?.data || r.data || null);
    }).catch((e) => logger.error("Error fetching claim details:", e));
    return () => { live = false; };
  }, [claimId]);

  const status = claim?.claimStatus || claim?.status;
  const facts = [
    [t("claimAuditTrail.policyNumber", { defaultValue: "Policy number" }), claim?.policyNumber],
    [t("claimAuditTrail.insured", { defaultValue: "Insured" }), claim?.policyHolderName || claim?.clientName],
    [t("claimAuditTrail.insurer", { defaultValue: "Insurer" }), claim?.insuranceCompanyName],
    [t("claimAuditTrail.insurerClaimNumber", { defaultValue: "Insurer claim number" }), claim?.insuranceCompanyClaimNumber],
  ];

  return (
    <div className="claim-audit">
      <BreadCrumb className="claim-audit__crumbs"
        model={[{ label: t("claimAuditTrail.claims", { defaultValue: "Claims" }), command: () => navigate("/agent/claim"), className: "bv-crumb-link" },
          { label: t("claimAuditTrail.title", { defaultValue: "Audit trail" }) }]}
        home={{ label: t("claimAuditTrail.operations", { defaultValue: "Operations" }) }} />
      <div className="claim-audit__header">
        <div>
          <h2 className="claim-audit__title">
            {t("claimAuditTrail.heading", { defaultValue: "Claim audit trail" })}
          </h2>
          <div className="claim-audit__subtitle">
            <span className="claim-audit__number">{claim?.claimNumber || claimId}</span>
            {status ? <Tag value={status} severity={statusSeverity(claim?.lifecycleStatus || status)} /> : null}
          </div>
        </div>
        <div className="claim-audit__actions">
          <Button icon="pi pi-eye" outlined size="small" label={t("claimAuditTrail.viewClaim", { defaultValue: "View claim" })}
            onClick={() => navigate(`/agent/claimdetail/${claim?.id || claimId}`)} />
          <Button icon="pi pi-arrow-left" text size="small" label={t("claimAuditTrail.back", { defaultValue: "Back" })} onClick={() => navigate("/agent/claim")} />
        </div>
      </div>
      <dl className="claim-audit__facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="claim-audit__card">
        <AuditTimeline entity="claim" recordId={claimId} />
      </div>
    </div>
  );
};

export default ClaimAuditTrail;
