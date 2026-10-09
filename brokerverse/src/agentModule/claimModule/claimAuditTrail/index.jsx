import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import claimsService from "../../../services/claimsService";
import { AuditTimeline } from "../../../components/AuditTrail";
import { KeyFacts, PageHeader, SectionCard, StatusChip } from "../../../components/RecordPage";
import { claimFacts } from "../../claimsModule/shared/ClaimJourneyLayout";
import logger from "../../../utility/logger";

/**
 * Claims > History of one claim: every business event of the claim (registration, adjuster report, settlement, status
 * changes) as a timeline, newest first, with who did it, from where and the fields it changed; filters and export.
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

  const number = claim?.claimNumber || claimId;
  return (
    <div className="bv-ops-page claim-audit">
      <PageHeader
        title={t("claimAuditTrail.heading", { defaultValue: "Claim history" })}
        crumbs={[{ label: t("claimAuditTrail.operations", { defaultValue: "Operations" }) },
          { label: t("claimAuditTrail.claims", { defaultValue: "Claims" }), onClick: () => navigate("/agent/claim") },
          { label: number, onClick: () => navigate(`/agent/claimdetail/${claim?.id || claimId}`) },
          { label: t("claimAuditTrail.title", { defaultValue: "History" }) }]}
        meta={(
          <>
            <span className="bv-page-header__code">{number}</span>
            {claim?.claimStatus ? <StatusChip status={claim.lifecycleStatus || claim.claimStatus} label={claim.claimStatus} /> : null}
          </>
        )}
        actions={(
          <>
            <Button icon="pi pi-arrow-left" outlined label={t("claimAuditTrail.back", { defaultValue: "All claims" })} onClick={() => navigate("/agent/claim")} />
            <Button icon="pi pi-eye" label={t("claimAuditTrail.viewClaim", { defaultValue: "View claim" })} onClick={() => navigate(`/agent/claimdetail/${claim?.id || claimId}`)} />
          </>
        )} />
      {claim ? <KeyFacts items={claimFacts(claim, t)} /> : null}
      <SectionCard>
        <AuditTimeline entity="claim" recordId={claimId} />
      </SectionCard>
    </div>
  );
};

export default ClaimAuditTrail;
