import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import placementService from "../../services/placementService";
import { useEmailSending, withQueuedNotice } from "../../utility/emailNotice";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { hasPermission } from "../../utils/canOpen";
import { Field, JourneyTimeline, PageHeader, ParticipantEditor, ParticipantsTable, StatusTag, formatDate, participantProblem, usePlacementOptions } from "./shared";
import "./index.scss";

/** Placement Slip detail: participants and their binding, the firm order to the insurers and the policy issuance. */
const PlacementDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const options = usePlacementOptions();
  // broker slips and placement slips go to the insurers by e-mail
  const emailSending = useEmailSending();
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [editing, setEditing] = useState(null);
  const [issuing, setIssuing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const notify = (severity, detail) => toast.current?.show({ severity, summary: severity === "error" ? t("common.error") : t("placement.messages.done"), detail, life: severity === "error" ? 6000 : 3000 });
  const load = useCallback(async () => {
    try {
      setP(await placementService.getPlacement(id));
    } catch (e) {
      notify("error", e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      const out = await fn();
      if (message) notify("success", typeof message === "function" ? message(out) : message);
      await load();
      return out || true;
    } catch (e) {
      notify("error", e.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  if (!p) return <div className="placement-page"><Toast ref={toast} /><div className="placement-card">{t("placement.messages.loading")}</div></div>;
  const editable = ["draft", "declined"].includes(p.status);
  const canBind = ["draft", "sent", "declined"].includes(p.status);
  const canIssue = p.status === "bound" && hasPermission("write:policies");
  const steps = (p.timeline || []).map((s) => ({ ...s, current: !s.done && (p.timeline.find((x) => !x.done)?.key === s.key) }));
  const pdf = (insurerId) => placementService.openPlacementPdf(p.id, insurerId).catch((e) => notify("error", e.message));

  const participantActions = (x) => (
    <>
      {canBind && x.status !== "confirmed" && <Button label={t("placement.actions.confirm")} icon="pi pi-check" size="small" text onClick={() => setConfirming({ ...x, insurerReference: x.insurerReference || "" })} />}
      {["draft", "sent"].includes(p.status) && x.status !== "confirmed" && <Button icon="pi pi-ban" size="small" text rounded severity="danger" tooltip={t("placement.actions.recordDecline")} tooltipOptions={{ position: "top" }} aria-label={t("placement.actions.recordDecline")} onClick={() => setDeclining({ ...x, reason: "" })} />}
      <Button icon="pi pi-file-pdf" size="small" text rounded onClick={() => pdf(x.insuranceCompanyId)} tooltip={t("placement.actions.participantSlip")} tooltipOptions={{ position: "top" }} aria-label={t("placement.actions.participantSlip")} />
    </>
  );

  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={`${t("placement.placementSlip.title")} ${p.placementNumber}`} subtitle={`${p.insuredName || p.customerName} - ${p.productType || ""} - ${t(`placement.source.${p.source}`)}`} onBack={() => navigate("/placement/placement-slips")}>
        <StatusTag status={p.status} />
        <Button label={t("placement.actions.slipPdf")} icon="pi pi-file-pdf" severity="secondary" outlined onClick={() => pdf()} className="ml-2" />
        {editable && <Button label={t("placement.actions.editParticipants")} icon="pi pi-users" severity="secondary" outlined className="ml-2"
          onClick={() => setEditing(p.participants.filter((x) => x.status !== "declined").map((x) => ({ insuranceCompanyId: x.insuranceCompanyId, sharePercent: x.sharePercent, isLead: x.isLead })))} />}
        {["draft", "sent"].includes(p.status) && <Button label={p.status === "sent" ? t("placement.actions.resend") : t("placement.actions.sendToInsurers")} icon="pi pi-send" className="ml-2" loading={busy}
          onClick={() => act(() => placementService.sendPlacement(p.id), (r) => withQueuedNotice(t("placement.messages.sent", { count: r.sent?.length || 0 }), emailSending))} />}
        {canIssue && <Button label={t("placement.actions.issuePolicy")} icon="pi pi-verified" severity="success" className="ml-2" onClick={() => setIssuing({ policyNumber: "", kyc: { ...(p.kycPrefill || {}) } })} />}
        {!["issued", "cancelled"].includes(p.status) && <Button label={t("placement.actions.cancelSlip")} icon="pi pi-times" text severity="danger" className="ml-2" onClick={() => setCancelling({ reason: "" })} />}
      </PageHeader>

      <div className="placement-card"><JourneyTimeline steps={steps} /></div>

      {p.status === "declined" && <Message severity="warn" className="w-full mb-3" text={t("placement.placementSlip.declinedNote")} />}
      {p.status === "bound" && !canIssue && <Message severity="info" className="w-full mb-3" text={t("placement.placementSlip.boundNoPermission")} />}

      <div className="placement-card">
        <h3 className="section-title">{t("placement.sections.security")} {p.isCoInsurance && <span className="co-chip">{t("placement.participants.coInsurance")}</span>}</h3>
        <div className="table-scroll" key={p.updatedAt}><ParticipantsTable participants={p.participants} actions={participantActions} /></div>
      </div>

      <div className="grid">
        <div className="col-12 lg:col-4">
          <div className="placement-card side-summary h-full">
            <h3 className="section-title">{t("placement.sections.premium")}</h3>
            <Field label={t("placement.fields.sumInsured")}>{formatCurrency(p.sumInsured)}</Field>
            <Field label={t("placement.fields.netPremium")}>{formatCurrency(p.netPremium)}</Field>
            <Field label={t("placement.fields.vat")}>{formatCurrency(p.valueAddedTax)}</Field>
            <Field label={t("placement.fields.dst")}>{formatCurrency(p.documentaryStampTax)}</Field>
            <Field label={t("placement.fields.lgt")}>{formatCurrency(p.localGovernmentTax)}</Field>
            {p.fireServiceTax > 0 && <Field label={t("placement.fields.fst")}>{formatCurrency(p.fireServiceTax)}</Field>}
            {p.discount > 0 && <Field label={t("placement.fields.discount")}>-{formatCurrency(p.discount)}</Field>}
            <Field label={t("placement.fields.grossPremium")}><strong>{formatCurrency(p.grossPremium)}</strong></Field>
            <Field label={t("placement.fields.commission")}>{formatCurrency(p.commissionAmount)}</Field>
          </div>
        </div>
        <div className="col-12 lg:col-4">
          <div className="placement-card side-summary h-full">
            <h3 className="section-title">{t("placement.sections.summary")}</h3>
            <Field label={t("placement.fields.customer")}>{p.customerName}</Field>
            <Field label={t("placement.fields.period")}>{`${formatDate(p.inceptionDate)} - ${formatDate(p.expiryDate)}`}</Field>
            <Field label={t("placement.fields.billingMode")}>{p.billingMode ? t(`placement.billing.${p.billingMode}`) : t("placement.billing.default")}</Field>
            <Field label={t("placement.fields.sent")}>{formatDate(p.sentAt)}</Field>
            <Field label={t("placement.fields.bound")}>{formatDate(p.boundAt)}</Field>
            <Field label={t("placement.fields.createdBy")}>{p.createdBy}</Field>
            {p.remarks && <Field label={t("placement.fields.remarks")}>{p.remarks}</Field>}
            {p.cancelReason && <Field label={t("placement.fields.reason")}>{p.cancelReason}</Field>}
          </div>
        </div>
        <div className="col-12 lg:col-4">
          <div className="placement-card side-summary h-full">
            <h3 className="section-title">{t("placement.sections.risk")}</h3>
            {Object.entries(p.riskDetails || {}).map(([k, v]) => <Field key={k} label={k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())}>{String(v)}</Field>)}
            {p.doc?.insuranceVehicleDetails?.[0] && ["vehicleBrand", "vehicleModel", "modelYear"].map((k) => <Field key={k} label={t(`placement.vehicle.${k}`)}>{p.doc.insuranceVehicleDetails[0][k]}</Field>)}
            {!Object.keys(p.riskDetails || {}).length && !p.doc?.insuranceVehicleDetails?.[0] && <span className="muted">{t("placement.placementSlip.riskFromQuote")}</span>}
          </div>
        </div>
      </div>

      <Dialog className="placement-dialog" header={confirming ? t("placement.confirm.title", { insurer: confirming.insuranceCompanyName }) : ""} visible={Boolean(confirming)} onHide={() => setConfirming(null)} style={{ width: "30rem" }}
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setConfirming(null)} /><Button label={t("placement.actions.confirm")} icon="pi pi-check" loading={busy} disabled={!confirming?.insurerReference?.trim()}
          onClick={async () => { const ok = await act(() => placementService.confirmPlacement(p.id, [{ insuranceCompanyId: confirming.insuranceCompanyId, insurerReference: confirming.insurerReference.trim(), remarks: confirming.remarks || undefined }]),
            (r) => (r.status === "bound" ? t("placement.messages.bound") : t("placement.messages.confirmed"))); if (ok) setConfirming(null); }} /></>}>
        {confirming && (
          <>
            <p className="muted">{t("placement.confirm.note", { share: confirming.sharePercent })}</p>
            <label htmlFor="ins-ref">{t("placement.confirm.reference")} *</label>
            <InputText id="ins-ref" value={confirming.insurerReference} onChange={(e) => setConfirming({ ...confirming, insurerReference: e.target.value })} className="w-full mb-3" autoFocus />
            <label htmlFor="ins-rem">{t("placement.fields.remarks")}</label>
            <InputTextarea id="ins-rem" value={confirming.remarks || ""} onChange={(e) => setConfirming({ ...confirming, remarks: e.target.value })} rows={2} className="w-full" />
          </>
        )}
      </Dialog>

      <Dialog className="placement-dialog" header={declining ? t("placement.decline.title", { insurer: declining.insuranceCompanyName }) : ""} visible={Boolean(declining)} onHide={() => setDeclining(null)} style={{ width: "30rem" }}
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setDeclining(null)} /><Button label={t("placement.actions.recordDecline")} severity="danger" loading={busy}
          onClick={async () => { const ok = await act(() => placementService.declineParticipant(p.id, declining.insuranceCompanyId, declining.reason), t("placement.messages.declined")); if (ok) setDeclining(null); }} /></>}>
        {declining && <><label htmlFor="dec-reason">{t("placement.fields.reason")}</label><InputTextarea id="dec-reason" value={declining.reason} onChange={(e) => setDeclining({ ...declining, reason: e.target.value })} rows={3} className="w-full" /></>}
      </Dialog>

      <Dialog className="placement-dialog" header={t("placement.actions.editParticipants")} visible={Boolean(editing)} onHide={() => setEditing(null)} style={{ width: "72rem" }} breakpoints={{ "1100px": "96vw" }}
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setEditing(null)} /><Button label={t("placement.actions.save")} icon="pi pi-check" loading={busy} disabled={Boolean(editing && participantProblem(editing, t))}
          onClick={async () => { const ok = await act(() => placementService.updatePlacement(p.id, { participants: editing }), t("placement.messages.participantsSaved")); if (ok) setEditing(null); }} /></>}>
        {editing && <ParticipantEditor value={editing} onChange={setEditing} insurers={options.insurers} totals={p} />}
      </Dialog>

      <Dialog className="placement-dialog" header={t("placement.issue.title")} visible={Boolean(issuing)} onHide={() => setIssuing(null)} style={{ width: "36rem" }}
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setIssuing(null)} /><Button label={t("placement.actions.issuePolicy")} icon="pi pi-verified" severity="success" loading={busy}
          onClick={async () => {
            const res = await act(() => placementService.issuePolicy(p.id, { additionalPolicyData: { ...(issuing.policyNumber ? { policyNumber: issuing.policyNumber } : {}), ...issuing.kyc } }),
              (r) => t("placement.messages.issued", { number: r.data?.policy?.policyNumber }));
            if (res?.policyId) navigate(`/agent/policydetail/${res.policyId}`);
          }} /></>}>
        {issuing && (
          <>
            <p className="muted">{t("placement.issue.note")}</p>
            {p.lob === "MOTOR" && <p className="muted">{t("placement.issue.verifyNote")}</p>}
            <label htmlFor="pol-no">{t("placement.issue.policyNumber")}</label>
            <InputText id="pol-no" value={issuing.policyNumber} onChange={(e) => setIssuing({ ...issuing, policyNumber: e.target.value })} className="w-full mb-2" placeholder={t("placement.issue.policyNumberPlaceholder")} />
            {p.lob === "MOTOR" && (
              <div className="grid mt-2">
                {["idType", "idCardNumber", "chassisNumber", "motorNumber", "plateNumber"].map((k) => (
                  <div className="col-12 md:col-6" key={k}>
                    <label>{t(`placement.kyc.${k}`)}</label>
                    <InputText value={issuing.kyc[k] || ""} onChange={(e) => setIssuing({ ...issuing, kyc: { ...issuing.kyc, [k]: e.target.value } })} className="w-full" placeholder={t("placement.kyc.notCaptured")} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Dialog>

      <Dialog className="placement-dialog" header={t("placement.actions.cancelSlip")} visible={Boolean(cancelling)} onHide={() => setCancelling(null)} style={{ width: "30rem" }}
        footer={<><Button label={t("placement.actions.back")} text onClick={() => setCancelling(null)} /><Button label={t("placement.actions.cancelSlip")} severity="danger" loading={busy}
          onClick={async () => { const ok = await act(() => placementService.cancelPlacement(p.id, cancelling.reason), t("placement.messages.cancelled")); if (ok) setCancelling(null); }} /></>}>
        {cancelling && <><label htmlFor="cxl">{t("placement.fields.reason")}</label><InputTextarea id="cxl" value={cancelling.reason} onChange={(e) => setCancelling({ reason: e.target.value })} rows={3} className="w-full" /></>}
      </Dialog>
    </div>
  );
};

export default PlacementDetail;
