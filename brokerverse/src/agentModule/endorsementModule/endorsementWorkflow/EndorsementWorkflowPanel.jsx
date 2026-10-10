import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { MultiSelect } from "primereact/multiselect";
import endorsementService from "../../../services/endorsementService";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import ApprovalActions from "../../../components/ApprovalActions";
import FieldError from "../../../components/FieldError";

const SECTIONS = ["insured", "vehicle", "cover", "period", "cancellation", "other"];

/**
 * The broker-mediated flow of an endorsement (TIS-BRD-ENDT-02): its endorsement types (M12), submission for approval,
 * the approval by a second user, sending to the insurer and booking once the insurer confirms. The server says which
 * step the user may take (workflow).
 */
const EndorsementWorkflowPanel = ({ endorsementId, onChanged }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [e, setE] = useState(null);
  const [types, setTypes] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await endorsementService.getEndorsementWorkflow(endorsementId);
      setE(data);
      setChosen(data.endorsementTypeCodes || []);
      if (data.workflow?.canSubmit) setTypes(await endorsementService.getEndorsementTypes(data.policyId));
    } catch (err) {
      notifyError(err.message);
    }
  }, [endorsementId]);

  useEffect(() => {
    if (endorsementId) load();
  }, [endorsementId, load]);

  if (!e?.workflow) return null;
  const w = e.workflow;
  const changed = () => {
    load();
    onChanged?.();
  };

  const submit = async () => {
    if (!chosen.length) {
      setError(t("endorsementWorkflow.chooseTypes"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await endorsementService.setEndorsementTypes(e.endorsementId, chosen);
      await endorsementService.submitEndorsementForApproval(e.endorsementId);
      notifySuccess(t("endorsementWorkflow.submitted"));
      changed();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const facts = [
    { label: t("endorsementWorkflow.endorsement"), value: e.endorsementNumber },
    { label: t("endorsementWorkflow.policy"), value: e.policyNumber },
    { label: t("endorsementWorkflow.premiumChange"), value: e.premiumDelta, type: "amount" },
  ];
  const approve = async () => {
    if (await openConfirm({ title: t("endorsementWorkflow.approveTitle"), facts, confirmLabel: t("endorsementWorkflow.approve"),
      onConfirm: () => endorsementService.decideEndorsement(e.endorsementId, "approve") })) {
      notifySuccess(t("endorsementWorkflow.approved"));
      changed();
    }
  };
  const reject = async () => {
    if (await openConfirm({ title: t("endorsementWorkflow.rejectTitle"), severity: "danger", facts, reason: { context: "endorsement_reject" },
      confirmLabel: t("endorsementWorkflow.reject"), onConfirm: (why) => endorsementService.decideEndorsement(e.endorsementId, "reject", why) })) {
      notifySuccess(t("endorsementWorkflow.rejected"));
      changed();
    }
  };
  const send = async () => {
    if (await openConfirm({ title: t("endorsementWorkflow.sendTitle"), facts, confirmLabel: t("endorsementWorkflow.send"),
      onConfirm: () => endorsementService.sendEndorsementToInsurer(e.endorsementId, e.isCancelPolicy) })) {
      notifySuccess(t("endorsementWorkflow.sent"));
      changed();
    }
  };

  const actions = (
    <>
      {w.canApprove ? <ApprovalActions initiator={{ id: e.createdById }} size="small" approveLabel={t("endorsementWorkflow.approve")}
        rejectLabel={t("endorsementWorkflow.reject")} onApprove={approve} onReject={reject} /> : null}
      {w.canSend ? <Button label={t("endorsementWorkflow.send")} icon="pi pi-send" size="small" onClick={send} /> : null}
      {w.canComplete ? <Button label={t("endorsementWorkflow.book")} icon="pi pi-check-square" size="small"
        onClick={() => navigate(`/agent/uploadendorsement/${e.endorsementId}`, { state: { endorsementId: e.endorsementId, endorsementData: e } })} /> : null}
    </>
  );
  const prorata = e.premiumChange?.prorata;
  const typeText = SECTIONS.flatMap((s) => (e.endorsementTypes || []).filter((x) => x.section === s)
    .map((x) => `${t(`endorsementWorkflow.sections.${s}`)}: ${x.name}`));
  const options = types.map((x) => ({ label: `${x.code} · ${x.name}`, value: x.code, group: x.section }));

  return (
    <DetailSection className="mt-3" title={t("endorsementWorkflow.title")} actions={actions}>
      <KeyValueGrid columns={3} items={[
        { label: t("endorsementWorkflow.types"), value: typeText.length ? <ul className="m-0 pl-3">{typeText.map((x) => <li key={x}>{x}</li>)}</ul> : null, span: "full" },
        { label: t("endorsementWorkflow.submittedAt"), value: e.submittedAt, type: "datetime", hidden: !e.submittedAt },
        { label: t("endorsementWorkflow.approvedBy"), value: e.approvedBy, hidden: !e.approvedBy },
        { label: t("endorsementWorkflow.approvedAt"), value: e.approvedAt, type: "datetime", hidden: !e.approvedAt },
        { label: t("endorsementWorkflow.rejectionReason"), value: e.rejectionReason, span: "full", hidden: !e.rejectionReason },
        { label: t("endorsementWorkflow.unexpiredDays"), value: prorata ? t("endorsementWorkflow.daysOf", { days: prorata.unexpiredDays, term: prorata.termDays }) : null, hidden: !prorata },
        { label: t("endorsementWorkflow.annualChange"), value: prorata?.annualNetDelta, type: "amount", hidden: !prorata },
        { label: t("endorsementWorkflow.insurerNumber"), value: e.completionDetails?.insurerEndorsementNumber, hidden: !e.completionDetails?.insurerEndorsementNumber },
      ]} />
      {w.canSubmit ? (
        <div className="p-fluid mt-3">
          <label htmlFor="endt-types" className="block mb-1">{t("endorsementWorkflow.types")} *</label>
          <MultiSelect inputId="endt-types" value={chosen} options={options} onChange={(ev) => setChosen(ev.value)} filter display="chip"
            placeholder={t("endorsementWorkflow.chooseTypes")} />
          <FieldError error={error} />
          <div className="flex justify-content-end mt-2">
            <Button label={t("endorsementWorkflow.submit")} icon="pi pi-check" loading={busy} onClick={submit} />
          </div>
        </div>
      ) : null}
    </DetailSection>
  );
};

EndorsementWorkflowPanel.propTypes = { endorsementId: PropTypes.string, onChanged: PropTypes.func };
EndorsementWorkflowPanel.defaultProps = { endorsementId: null, onChanged: null };

export default EndorsementWorkflowPanel;
