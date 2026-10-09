import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import claimsService from "../../../services/claimsService";
import service from "../../../services/opsAccountingService";
import { formatDate } from "../../../utility/dateFormat";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../shared/ClaimJourneyLayout";
import ClaimDocumentChecklist, { ChecklistReminders, useClaimChecklist } from "../shared/ClaimDocumentChecklist";
import FormErrorSummary from "../shared/FormErrorSummary";
import { EDITABLE_STATUSES } from "../shared/claimJourney";

/**
 * Documents step of a claim (after the insurer is advised and the claim registered): the documents of the claim's line
 * of business and cause of loss, what is in and what is missing, and the next step: remind the claimant while required
 * documents are missing, submit the claim file to the insurer once they are in, then review the claim.
 */
const ClaimDocuments = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const claimId = id || location.state?.claimId;
  const [claim, setClaim] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(null); // { reference }
  const { list, error, reload } = useClaimChecklist(claimId);

  useEffect(() => {
    if (!claimId) return;
    claimsService.getClaimDetails(claimId).then((result) => {
      if (result.success) setClaim(result.data?.data || result.data);
      else setLoadError(result.error);
    });
  }, [claimId]);

  const notify = (severity, detail) => toast.current?.show({ severity, summary: t("claimDocs.title"), detail, life: severity === "error" ? 6000 : 3000 });
  const toReview = () => navigate(`/agent/claimrequest/requestapproval/${claimId}`, { state: { claimId, clientId: claim?.clientId } });
  const remind = async () => {
    setBusy(true);
    try {
      const r = await service.remindClaimant(claimId);
      notify("success", t("claimDocs.reminded", { to: r.to }));
      await reload();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    try {
      await service.submitClaimToInsurer(claimId, { reference: submitting.reference.trim() || undefined });
      setSubmitting(null);
      notify("success", t("claimDocs.submitted"));
      await reload();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const s = list?.summary;
  const open = claim ? EDITABLE_STATUSES.includes(claim.lifecycleStatus) || claim.lifecycleStatus === "pending-approval" || claim.lifecycleStatus === "approved" : true;
  const submitted = !!list?.submittedToInsurerAt;
  const missing = s?.missingRequired || 0;
  const mayRemind = open && (missing + (s?.missingOptional || 0)) > 0;
  const maySubmit = open && !submitted && (!missing || list?.requireComplete === false);
  let next = null;
  let tone = "info";
  if (list) {
    if (submitted) next = t("claimDocs.next.submitted", { date: formatDate(list.submittedToInsurerAt) });
    else if (missing) {
      next = list.requireComplete === false ? t("claimDocs.next.missingMaySubmit", { count: missing }) : t("claimDocs.next.missing", { count: missing });
      tone = "warning";
    } else {
      next = t("claimDocs.next.ready");
      tone = "success";
    }
  }

  return (
    <ClaimJourneyLayout
      claim={claim}
      step="documents"
      onBack={() => navigate(claim?.clientId ? `/agent/clientview/${claim.clientId}` : "/agent/claim")}
      title={t("claimDocs.stepTitle")}
    >
      <Toast ref={toast} />
      {!list && !error && !loadError && <p className="claim-journey__hint">{t("claimJourney.loadingClaim")}</p>}
      {(error || loadError) && !list ? <FormErrorSummary serverError={error || loadError} /> : null}
      {list ? (
        <>
          <ClaimSection title={list.lossCause ? t("claimDocs.checklistFor", { cause: list.lossCause }) : t("claimDocs.checklist")}>
            <ClaimDocumentChecklist claimId={claimId} list={list} onChanged={reload} notify={notify} readOnly={!open} />
          </ClaimSection>
          {list.reminders?.length ? (
            <ClaimSection title={t("claimDocs.reminders")}>
              <ChecklistReminders reminders={list.reminders} />
            </ClaimSection>
          ) : null}
        </>
      ) : null}
      <ClaimActions next={next} tone={tone}>
        {submitted || !maySubmit ? (
          <Button type="button" label={t("claimDocs.continueReview")} icon="pi pi-arrow-right" iconPos="right" outlined={!submitted} onClick={toReview} disabled={!claim} />
        ) : null}
        {mayRemind && !submitted ? (
          <Button type="button" label={t("claimDocs.remind")} icon="pi pi-envelope" outlined={!missing || maySubmit} onClick={remind} loading={busy && !submitting} disabled={busy} />
        ) : null}
        {maySubmit ? (
          <Button type="button" label={t("claimDocs.submit")} icon="pi pi-send" onClick={() => setSubmitting({ reference: "" })} disabled={busy} />
        ) : null}
      </ClaimActions>
      <Dialog visible={!!submitting} onHide={() => setSubmitting(null)} style={{ width: "min(460px, 95vw)" }} header={t("claimDocs.submitTitle")}
        footer={(
          <>
            <Button type="button" text label={t("claimDocs.cancel")} onClick={() => setSubmitting(null)} disabled={busy} />
            <Button type="button" icon="pi pi-send" label={t("claimDocs.submit")} onClick={submit} loading={busy} />
          </>
        )}>
        {submitting ? (
          <div className="field">
            <label htmlFor="cd-ref" className="claim-journey__label">{t("claimDocs.submitReference")}</label>
            <InputText id="cd-ref" className="w-full" value={submitting.reference} onChange={(e) => setSubmitting({ reference: e.target.value })} />
            {missing ? <small className="block mt-2">{t("claimDocs.submitWithMissing", { count: missing })}</small> : null}
          </div>
        ) : null}
      </Dialog>
    </ClaimJourneyLayout>
  );
};

export default ClaimDocuments;
