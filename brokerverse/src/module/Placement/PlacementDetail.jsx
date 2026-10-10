import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import placementService from "../../services/placementService";
import authService from "../../services/authService";
import s3Service from "../../services/s3Service";
import { useEmailSending, withQueuedNotice } from "../../utility/emailNotice";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { loadKycConfig, requiredKycFor } from "../../utility/kyc";
import { hasPermission } from "../../utils/canOpen";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import { RecordActivityLog } from "../../components/ActivityLog";
import { printPdf } from "../../components/Print";
import { Field, JourneyTimeline, PageHeader, ParticipantEditor, ParticipantsTable, StatusTag, formatDate, formatDateTime, participantProblem, riskLabel, usePlacementOptions } from "./shared";
import { EpolicyDialog, SlipComparison } from "./EpolicyForm";
import "./index.scss";

const WITH_INSURER = ["sent", "acknowledged"];

/**
 * Placement Slip detail: the chain Placement raised -> Sent to insurer -> Acknowledged -> e-Policy received -> Checked
 * against slip -> Insurer issued (Booked), one action per step. The broker never issues cover: the policy exists only
 * once the insurer's e-policy has been checked against the slip by a second user and booked.
 */
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
  const [acknowledging, setAcknowledging] = useState(null);
  const [recording, setRecording] = useState(false);
  const [checking, setChecking] = useState(null);
  const [editing, setEditing] = useState(null);
  const [booking, setBooking] = useState(null);
  const [kycConfig, setKycConfig] = useState(null);
  const userId = String(authService.getUser()?.userId || localStorage.getItem("USER_ID") || "");

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
  useEffect(() => { if (booking && !kycConfig) loadKycConfig().then(setKycConfig); }, [booking, kycConfig]);

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
  const setKyc = (patch) => setBooking((b) => ({ ...b, kyc: { ...b.kyc, ...patch } }));

  if (!p) return <div className="placement-page"><Toast ref={toast} /><div className="placement-card">{t("placement.messages.loading")}</div></div>;
  const write = hasPermission("write:quotations");
  const approver = hasPermission("write:policies");
  // the check against the slip is the checker's step (approve:policies)
  const checker = write && hasPermission("approve:policies");
  const editable = write && ["draft", "declined"].includes(p.status);
  const keyedByMe = Boolean(p.epolicy?.receivedById) && String(p.epolicy.receivedById) === userId;
  const canBook = p.status === "checked" && write && approver;
  const steps = (p.timeline || []).map((s) => ({ ...s, current: !s.done && (p.timeline.find((x) => !x.done)?.key === s.key) }));
  const pdf = (insurerId) => printPdf(`/placements/${encodeURIComponent(p.id)}/documents/placement-slip${insurerId ? `?insurerId=${encodeURIComponent(insurerId)}` : ""}`,
    { fileName: `${p.placementNumber}.pdf` }).catch((e) => notify("error", e.message));
  const slipFacts = () => [
    { label: t("placement.placementSlip.title"), value: p.placementNumber },
    { label: t("placement.fields.customer"), value: p.insuredName || p.customerName },
    { label: t("placement.fields.period"), value: `${formatDate(p.inceptionDate)} - ${formatDate(p.expiryDate)}` },
    { label: t("placement.fields.grossPremium"), value: p.grossPremium, type: "amount" },
  ];
  // the action runs inside the confirmation (a failure stays there with its message), then the slip is reloaded
  const confirmAct = async (options, fn, message) => {
    let out = null;
    const done = await openConfirm({ ...options, onConfirm: async (value) => { out = await fn(value); } });
    if (done === false || done === null) return;
    notify("success", message);
    await load();
    return out;
  };
  // the firm order goes to every insurer still on the slip; the confirmation names them and the slip
  const sendToInsurers = async () => {
    const insurers = p.participants.filter((x) => x.status !== "declined");
    let out = null;
    const done = await openConfirm({
      title: t(p.status === "draft" ? "placement.send.title" : "placement.send.resendTitle", { number: p.placementNumber }),
      message: t("placement.send.message", { count: insurers.length }),
      facts: [
        ...slipFacts(),
        ...insurers.map((x) => ({ label: x.isLead ? t("placement.send.leadInsurer") : t("placement.send.coInsurer"), value: `${x.insuranceCompanyName} · ${x.sharePercent}%` })),
      ],
      confirmLabel: t(p.status === "draft" ? "placement.actions.sendToInsurers" : "placement.actions.resend"),
      confirmIcon: "pi pi-send",
      onConfirm: async () => { out = await placementService.sendPlacement(p.id); },
    });
    if (!done) return;
    notify("success", withQueuedNotice(t("placement.messages.sent", { count: out?.sent?.length || 0 }), emailSending));
    await load();
  };
  const recordDecline = (x) => confirmAct({
    title: t("placement.decline.title", { insurer: x.insuranceCompanyName }),
    severity: "danger",
    message: t("placement.decline.message"),
    facts: [
      { label: t("placement.decline.insurer"), value: x.insuranceCompanyName },
      { label: t("placement.decline.share"), value: x.sharePercent, type: "percent" },
      ...slipFacts().slice(0, 2),
    ],
    input: { type: "textarea", label: t("placement.fields.reason") },
    confirmLabel: t("placement.actions.recordDecline"),
    cancelLabel: t("placement.actions.back"),
  }, (reason) => placementService.declineParticipant(p.id, x.insuranceCompanyId, reason || ""), t("placement.messages.declined"));
  const cancelSlip = () => confirmAct({
    title: t("placement.actions.cancelSlip"),
    severity: "danger",
    message: t("placement.cancel.message"),
    facts: slipFacts(),
    input: { type: "textarea", label: t("placement.fields.reason"), required: true },
    confirmLabel: t("placement.actions.cancelSlip"),
    cancelLabel: t("placement.actions.back"),
  }, (reason) => placementService.cancelPlacement(p.id, reason), t("placement.messages.cancelled"));
  const openFile = async (key) => {
    const r = await s3Service.generatePresignedDownloadUrl(key);
    if (r.success) window.open(r.url, "_blank", "noopener,noreferrer");
    else notify("error", r.error);
  };
  const openCheck = async () => {
    try {
      setChecking({ comparison: await placementService.slipCheck(p.id), reason: "" });
    } catch (e) {
      notify("error", e.message);
    }
  };
  const decide = async (decision) => {
    const ok = await act(() => placementService.decideCheck(p.id, decision, checking.reason), (r) => r.message);
    if (ok) setChecking(null);
  };

  const participantActions = (x) => (
    <>
      {write && ["draft", ...WITH_INSURER].includes(p.status) && x.status !== "declined" && <Button icon="pi pi-ban" size="small" text rounded severity="danger" tooltip={t("placement.actions.recordDecline")} tooltipOptions={{ position: "top" }} aria-label={t("placement.actions.recordDecline")} onClick={() => recordDecline(x)} />}
      <Button icon="pi pi-print" size="small" text rounded onClick={() => pdf(x.insuranceCompanyId)} tooltip={t("placement.actions.participantSlip")} tooltipOptions={{ position: "top" }} aria-label={t("placement.actions.participantSlip")} />
    </>
  );

  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={`${t("placement.placementSlip.title")} ${p.placementNumber}`} subtitle={`${p.insuredName || p.customerName} - ${p.productType || ""} - ${t(`placement.source.${p.source}`)}`} onBack={() => navigate("/placement/placement-slips")}>
        <StatusTag status={p.status} />
        <Button label={t("placement.actions.printSlip")} icon="pi pi-print" severity="secondary" outlined onClick={() => pdf()} className="ml-2" />
        {editable && <Button label={t("placement.actions.editParticipants")} icon="pi pi-users" severity="secondary" outlined className="ml-2"
          onClick={() => setEditing(p.participants.filter((x) => x.status !== "declined").map((x) => ({ insuranceCompanyId: x.insuranceCompanyId, sharePercent: x.sharePercent, isLead: x.isLead })))} />}
        {write && ["draft", ...WITH_INSURER].includes(p.status) && <Button label={p.status === "draft" ? t("placement.actions.sendToInsurers") : t("placement.actions.resend")} icon="pi pi-send" className="ml-2" loading={busy}
          severity={p.status === "draft" ? undefined : "secondary"} outlined={p.status !== "draft"}
          onClick={() => sendToInsurers()} />}
        {write && p.status === "sent" && <Button label={t("placement.actions.acknowledge")} icon="pi pi-inbox" className="ml-2" onClick={() => setAcknowledging({ reference: "", remarks: "" })} />}
        {write && WITH_INSURER.includes(p.status) && <Button label={t("placement.actions.uploadEpolicy")} icon="pi pi-upload" className="ml-2" severity={p.status === "acknowledged" ? undefined : "secondary"} onClick={() => setRecording(true)} />}
        {p.status === "epolicy_received" && <Button label={t("placement.actions.checkAgainstSlip")} icon="pi pi-list-check" className="ml-2" onClick={openCheck} />}
        {canBook && <Button label={t("placement.actions.book")} icon="pi pi-verified" className="ml-2" onClick={() => setBooking({ kyc: { ...(p.kycPrefill || {}) } })} />}
        {write && !["issued", "cancelled"].includes(p.status) && <Button label={t("placement.actions.cancelSlip")} icon="pi pi-times" text severity="danger" className="ml-2" onClick={cancelSlip} />}
      </PageHeader>

      <div className="placement-card"><JourneyTimeline steps={steps} /></div>

      {p.status === "declined" && <Message severity="warn" className="w-full mb-3" text={t("placement.placementSlip.declinedNote")} />}
      {p.status === "epolicy_received" && keyedByMe && <Message severity="info" className="w-full mb-3" text={t("placement.check.makerNote")} />}
      {p.status === "checked" && !canBook && <Message severity="info" className="w-full mb-3" text={t("placement.placementSlip.checkedNoPermission")} />}
      {p.status === "acknowledged" && p.check?.decision === "returned" && <Message severity="warn" className="w-full mb-3" text={t("placement.check.returnedNote", { reason: p.check.reason || "" })} />}

      {p.epolicy && (
        <div className="placement-card">
          <h3 className="section-title">{t("placement.sections.epolicy")} {p.check?.status && <span className={`check-status ${p.check.status}`}>{t(`placement.check.status.${p.check.status}`)}</span>}</h3>
          <div className="field-grid">
            <Field label={t("placement.epolicy.insurerPolicyNumber")}>{p.epolicy.insurerPolicyNumber}</Field>
            <Field label={t("placement.epolicy.brokerPolicyNumber")}>{p.policyNumber || p.epolicy.brokerPolicyNumber || t("placement.epolicy.brokerPolicyNumberPlaceholder")}</Field>
            <Field label={t("placement.epolicy.participantName")}>{p.epolicy.participantName}</Field>
            <Field label={t("placement.epolicy.sumInsured")}>{formatCurrency(p.epolicy.sumInsured)}</Field>
            <Field label={t("placement.epolicy.netPremium")}>{formatCurrency(p.epolicy.netPremium)}</Field>
            {p.epolicy.grossPremium != null && <Field label={t("placement.epolicy.grossPremium")}>{formatCurrency(p.epolicy.grossPremium)}</Field>}
            {p.epolicy.commissionAmount != null && <Field label={t("placement.epolicy.commissionAmount")}>{formatCurrency(p.epolicy.commissionAmount)}</Field>}
            <Field label={t("placement.epolicy.issueDate")}>{formatDate(p.epolicy.issueDate)}</Field>
            <Field label={t("placement.epolicy.issuanceDate")}>{formatDate(p.epolicy.issuanceDate)}</Field>
            <Field label={t("placement.epolicy.effectiveDate")}>{`${formatDate(p.epolicy.effectiveDate)} - ${formatDate(p.epolicy.expiryDate)}`}</Field>
            {p.epolicy.productionDate && <Field label={t("placement.epolicy.productionDate")}>{formatDate(p.epolicy.productionDate)}</Field>}
            {p.epolicy.vehicle && ["chassisNumber", "motorNumber", "plateNumber", "mvFileNumber"].filter((k) => p.epolicy.vehicle[k]).map((k) => <Field key={k} label={t(`placement.epolicy.${k}`)}>{p.epolicy.vehicle[k]}</Field>)}
            <Field label={t("placement.epolicy.receivedBy")}>{`${p.epolicy.receivedBy || "-"} - ${formatDate(p.epolicy.receivedAt)}`}</Field>
            {p.check?.at && <Field label={t("placement.check.decidedBy")}>{`${p.check.by || "-"} - ${t(`placement.check.decision.${p.check.decision}`)} - ${formatDateTime(p.check.at)}`}</Field>}
          </div>
          <div className="attachment-line mt-2">
            <Button label={p.epolicy.documentName || t("placement.epolicy.file")} icon="pi pi-file-pdf" text size="small" onClick={() => openFile(p.epolicy.documentKey)} />
            {p.epolicy.vehiclePhotoKey && <Button label={t("placement.epolicy.vehiclePhoto")} icon="pi pi-image" text size="small" onClick={() => openFile(p.epolicy.vehiclePhotoKey)} />}
          </div>
          {p.check?.items && <><h4 className="mb-2">{t("placement.check.title")}</h4><SlipComparison check={p.check} /></>}
        </div>
      )}

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
            <Field label={t("placement.fields.acknowledged")}>{p.acknowledgement ? `${formatDate(p.acknowledgement.at)}${p.acknowledgement.reference ? ` (${p.acknowledgement.reference})` : ""}` : "-"}</Field>
            {p.slipDocument && <Field label={t("placement.fields.placementFile")}><button type="button" className="journey-link" onClick={() => openFile(p.slipDocument.key)}>{p.slipDocument.fileName}</button></Field>}
            <Field label={t("placement.fields.createdBy")}>{p.createdBy}</Field>
            {p.remarks && <Field label={t("placement.fields.remarks")}>{p.remarks}</Field>}
            {p.cancelReason && <Field label={t("placement.fields.reason")}>{p.cancelReason}</Field>}
          </div>
        </div>
        <div className="col-12 lg:col-4">
          <div className="placement-card side-summary h-full">
            <h3 className="section-title">{t("placement.sections.risk")}</h3>
            {Object.entries(p.riskDetails || {}).map(([k, v]) => <Field key={k} label={riskLabel(t, k)}>{String(v)}</Field>)}
            {p.doc?.insuranceVehicleDetails?.[0] && ["vehicleBrand", "vehicleModel", "modelYear"].map((k) => <Field key={k} label={t(`placement.vehicle.${k}`)}>{p.doc.insuranceVehicleDetails[0][k]}</Field>)}
            {!Object.keys(p.riskDetails || {}).length && !p.doc?.insuranceVehicleDetails?.[0] && <span className="muted">{t("placement.placementSlip.riskFromQuote")}</span>}
          </div>
        </div>
      </div>

      <div className="placement-card">
        <h3 className="section-title">{t("placement.sections.history")}</h3>
        <RecordActivityLog entity="placement" recordId={p.id} />
      </div>

      <DetailDialog header={t("placement.acknowledge.title")} visible={Boolean(acknowledging)} onHide={() => setAcknowledging(null)} size="md" className="placement-dialog"
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setAcknowledging(null)} /><Button label={t("placement.actions.acknowledge")} icon="pi pi-check" loading={busy}
          onClick={async () => { const ok = await act(() => placementService.acknowledgePlacement(p.id, { reference: acknowledging.reference.trim() || undefined, remarks: acknowledging.remarks || undefined }),
            t("placement.messages.acknowledged")); if (ok) setAcknowledging(null); }} /></>}>
        {acknowledging && (
          <>
            <KeyValueGrid columns={2} className="mb-3" items={[
              ...slipFacts().slice(0, 2),
              { label: t("placement.acknowledge.insurers"), value: p.participants.filter((x) => x.status !== "declined").map((x) => x.insuranceCompanyName).join(", ") },
              { label: t("placement.fields.sent"), value: p.sentAt, type: "date" },
            ]} />
            <div className="p-fluid">
              <div className="field">
                <label htmlFor="ack-ref">{t("placement.acknowledge.reference")}</label>
                <InputText id="ack-ref" value={acknowledging.reference} onChange={(e) => setAcknowledging({ ...acknowledging, reference: e.target.value })} autoFocus />
              </div>
              <div className="field mb-0">
                <label htmlFor="ack-rem">{t("placement.fields.remarks")}</label>
                <InputTextarea id="ack-rem" value={acknowledging.remarks} onChange={(e) => setAcknowledging({ ...acknowledging, remarks: e.target.value })} rows={2} />
              </div>
            </div>
          </>
        )}
      </DetailDialog>

      <EpolicyDialog placement={p} visible={recording} onHide={() => setRecording(false)}
        onSaved={async (saved) => { setRecording(false); notify("success", t(saved.check?.status === "match" ? "placement.messages.epolicyMatch" : "placement.messages.epolicyMismatch")); await load(); }} />

      <DetailDialog header={t("placement.check.title")} visible={Boolean(checking)} onHide={() => setChecking(null)} size="xl"
        footer={checking && (
          <>
            {keyedByMe && <span id="chk-maker" className="placement-maker-note"><i className="pi pi-lock" aria-hidden="true" /> {t("placement.check.makerNote")}</span>}
            <Button label={t("placement.actions.cancel")} text onClick={() => setChecking(null)} />
            <Button label={t("placement.check.returnToInsurer")} icon="pi pi-replay" severity="secondary" outlined loading={busy} disabled={keyedByMe || !checker || !checking.reason.trim()}
              aria-describedby={keyedByMe ? "chk-maker" : undefined} onClick={() => decide("return")} />
            {checking.comparison.result === "mismatch"
              ? <Button label={t("placement.check.acceptDifferences")} icon="pi pi-check" loading={busy} disabled={keyedByMe || !approver || !checker || !checking.reason.trim()}
                aria-describedby={keyedByMe ? "chk-maker" : undefined} onClick={() => decide("accept")} />
              : <Button label={t("placement.check.confirm")} icon="pi pi-check" loading={busy} disabled={keyedByMe || !checker}
                aria-describedby={keyedByMe ? "chk-maker" : undefined} onClick={() => decide("confirm")} />}
          </>
        )}>
        {checking && (
          <>
            <KeyValueGrid columns={4} className="mb-3" items={[
              { label: t("placement.epolicy.insurerPolicyNumber"), value: p.epolicy?.insurerPolicyNumber },
              { label: t("placement.epolicy.participantName"), value: p.epolicy?.participantName },
              { label: t("placement.epolicy.receivedBy"), value: p.epolicy?.receivedBy },
              { label: t("placement.check.differences"), value: checking.comparison.differences.length, type: "number" },
            ]} />
            <SlipComparison check={checking.comparison} />
            <label htmlFor="chk-reason" className="mt-3">{t("placement.check.reason")}</label>
            <InputTextarea id="chk-reason" value={checking.reason} onChange={(e) => setChecking({ ...checking, reason: e.target.value })} rows={2} className="w-full" placeholder={t("placement.check.reasonPlaceholder")} />
          </>
        )}
      </DetailDialog>

      <Dialog className="placement-dialog" header={t("placement.actions.editParticipants")} visible={Boolean(editing)} onHide={() => setEditing(null)} style={{ width: "72rem" }} breakpoints={{ "1100px": "96vw" }}
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setEditing(null)} /><Button label={t("placement.actions.save")} icon="pi pi-check" loading={busy} disabled={Boolean(editing && participantProblem(editing, t))}
          onClick={async () => { const ok = await act(() => placementService.updatePlacement(p.id, { participants: editing }), t("placement.messages.participantsSaved")); if (ok) setEditing(null); }} /></>}>
        {editing && <ParticipantEditor value={editing} onChange={setEditing} insurers={options.insurers} totals={p} />}
      </Dialog>

      <DetailDialog header={t("placement.book.title")} visible={Boolean(booking)} onHide={() => setBooking(null)} size="md"
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setBooking(null)} /><Button label={t("placement.actions.book")} icon="pi pi-verified" loading={busy}
          onClick={async () => {
            const res = await act(async () => {
              const kyc = { ...booking.kyc };
              if (booking.idFile) {
                const up = await s3Service.uploadFile(booking.idFile, "id-cards");
                if (!up?.url) throw new Error(up?.error || t("placement.epolicy.errors.upload"));
                kyc.idCardImage = up.url;
              }
              return placementService.bookPolicy(p.id, { additionalPolicyData: kyc });
            },
              (r) => withQueuedNotice(t("placement.messages.booked", { number: r.data?.policy?.policyNumber }), emailSending));
            if (res?.policyId) navigate(`/agent/policydetail/${res.policyId}`);
          }} /></>}>
        {booking && (
          <>
            <KeyValueGrid columns={2} items={[
              { label: t("placement.epolicy.insurerPolicyNumber"), value: p.epolicy?.insurerPolicyNumber },
              { label: t("placement.epolicy.participantName"), value: p.epolicy?.participantName },
              { label: t("placement.fields.customer"), value: p.insuredName || p.customerName },
              { label: t("placement.fields.period"), value: `${formatDate(p.epolicy?.effectiveDate || p.inceptionDate)} - ${formatDate(p.epolicy?.expiryDate || p.expiryDate)}` },
              { label: t("placement.epolicy.sumInsured"), value: p.epolicy?.sumInsured ?? p.sumInsured, type: "amount" },
              { label: t("placement.epolicy.grossPremium"), value: p.epolicy?.grossPremium ?? p.grossPremium, type: "amount" },
            ]} />
            <p className="placement-consequence">{t("placement.book.consequence")}</p>
            {p.lob === "MOTOR" && (
              <div className="grid mt-2">
                <div className="col-12 md:col-6">
                  <label htmlFor="bk-idType">{t("placement.kyc.idType")}</label>
                  <Dropdown inputId="bk-idType" value={booking.kyc.idType || null} options={(kycConfig?.idTypes || []).map((v) => ({ label: v, value: v }))} placeholder={t("placement.kyc.selectIdType")}
                    onChange={(e) => setKyc({ idType: e.value })} className="w-full" />
                </div>
                <div className="col-12 md:col-6">
                  <label htmlFor="bk-idNumber">{t("placement.kyc.idCardNumber")}</label>
                  <InputText id="bk-idNumber" value={booking.kyc.idCardNumber || ""} onChange={(e) => setKyc({ idCardNumber: e.target.value })} className="w-full" placeholder={t("placement.kyc.notCaptured")} />
                </div>
                {requiredKycFor(kycConfig, p.lob).includes("idImage") && (
                  <div className="col-12">
                    <label htmlFor="bk-idImage">{t("placement.kyc.idCardImage")}</label>
                    {booking.kyc.idCardImage && !booking.idFile && <div className="muted">{t("placement.kyc.idCardImageAttached")}</div>}
                    <input id="bk-idImage" type="file" accept="image/*,application/pdf" onChange={(e) => setBooking({ ...booking, idFile: e.target.files?.[0] || null })} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DetailDialog>
    </div>
  );
};

export default PlacementDetail;
