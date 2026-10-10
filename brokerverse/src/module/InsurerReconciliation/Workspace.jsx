import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { RadioButton } from "primereact/radiobutton";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/insurerReconciliationService";
import { openConfirm } from "../../components/ConfirmDialog";
import ApprovalActions from "../../components/ApprovalActions";
import { ActivityLog, fromLifecycle, useRecordActivity } from "../../components/ActivityLog";
import { Diff, IrTag, PageHeader, date, money, showError, showSuccess } from "./common";

const num = (v) => Number(v || 0);

// the steps a statement keeps in its own fields, shown when its audit trail cannot be read
const STATEMENT_STEPS = [
  { action: "import", at: "createdAt", by: "createdBy" },
  { action: "submit", at: "submittedAt", by: "submittedBy" },
  { action: "reject", at: "rejectedAt", by: "rejectedBy", remarks: "rejectionReason" },
  { action: "approve", at: "approvedAt", by: "approvedBy", remarks: "approvalRemarks" },
];

/**
 * Accounts > Insurer Reconciliation > statement: the insurer's lines against the broker's records, the differences
 * (amounts, lines not found at the broker, broker records missing on the statement) with their resolution, manual
 * matching, submit / approve / reject and the differences report download.
 */
const Workspace = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resolve, setResolve] = useState(null); // { target, kind, note, premiumAdjustment, commissionAdjustment }
  const [match, setMatch] = useState(null); // { line, search, candidates }
  const activity = useRecordActivity("insurer_statement", id);
  const reloadActivity = activity.reload;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSt(await service.statement(id));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, message) => {
    try {
      const out = await fn();
      if (message) showSuccess(toast, typeof message === "function" ? message(out) : message);
      await load();
      reloadActivity();
      return out;
    } catch (e) {
      showError(toast, e);
      return undefined;
    }
  };
  // the action runs inside the confirmation (an error stays there); the toast and the reload follow once it succeeded
  const confirmRun = async (options, fn, message) => {
    let out;
    const answer = await openConfirm({ ...options, onConfirm: async (value) => { out = await fn(value); } });
    if (answer === false || answer === null) return undefined;
    if (message) showSuccess(toast, message);
    await load();
    reloadActivity();
    return out ?? true;
  };

  const draft = st?.status === "draft";
  const openResolve = (target) => {
    const d = target.differences || {};
    setResolve({ target, kind: target.resolution?.kind || "note", note: target.resolution?.note || "",
      premiumAdjustment: target.resolution?.premiumAdjustment ?? num(d.grossPremium), commissionAdjustment: target.resolution?.commissionAdjustment ?? -num(d.commission) });
  };
  const saveResolve = async () => {
    const r = resolve;
    const body = { kind: r.kind, note: r.note, ...(r.kind === "adjustment" ? { premiumAdjustment: num(r.premiumAdjustment), commissionAdjustment: num(r.commissionAdjustment) } : {}),
      ...(r.target.lineNo ? { lineId: r.target.id } : { brokerType: r.target.type, brokerId: r.target.id }) };
    const out = await run(() => service.resolve(st.id, body), t("insurerRec.resolved"));
    if (out) setResolve(null);
  };
  const searchCandidates = async (line, search) => {
    try {
      setMatch({ line, search, candidates: await service.candidates(st.id, search) });
    } catch (e) {
      showError(toast, e);
    }
  };
  const statementFacts = () => [
    { label: t("insurerRec.insurer"), value: st.insurerName },
    { label: t("insurerRec.type"), value: t(`insurerRec.type_${st.statementType}`) },
    { label: t("insurerRec.period"), value: `${date(st.periodFrom)} – ${date(st.periodTo)}` },
    { label: t("insurerRec.summary.lines"), value: st.summary.lines, type: "number" },
    { label: t("insurerRec.summary.matched"), value: st.summary.matched, type: "number" },
    { label: t("insurerRec.summary.unresolved"), value: st.summary.unresolved, type: "number" },
    { label: t("insurerRec.premiumAdjustment"), value: st.summary.adjustments.premium, type: "amount" },
    { label: t("insurerRec.commissionAdjustment"), value: st.summary.adjustments.commission, type: "amount" },
  ];
  const lineFacts = (l) => [
    { label: t("insurerRec.policyNo"), value: l.policyNumber },
    { label: t("insurerRec.insured"), value: l.insured },
    { label: t("insurerRec.grossPremium"), value: l.grossPremium, type: "amount" },
    { label: t("insurerRec.commission"), value: l.commission, type: "amount" },
    { label: t("insurerRec.amountPaid"), value: l.amountPaid, type: "amount", hidden: l.amountPaid === undefined },
  ];
  const submit = () => confirmRun({
    title: t("insurerRec.confirmations.submitTitle"),
    message: t("insurerRec.confirmations.submitMessage", { number: st.statementNumber }),
    facts: statementFacts(),
    confirmLabel: t("insurerRec.submit"),
  }, () => service.submit(st.id), t("insurerRec.submitted"));
  const decide = (action) => {
    const approve = action === "approve";
    const adjusted = num(st.summary.adjustments.premium) !== 0 || num(st.summary.adjustments.commission) !== 0;
    return confirmRun({
      title: t(approve ? "insurerRec.confirmations.approveTitle" : "insurerRec.confirmations.rejectTitle"),
      severity: approve ? "neutral" : "danger",
      message: t(approve ? "insurerRec.confirmations.approveMessage" : "insurerRec.confirmations.rejectMessage", { number: st.statementNumber }),
      facts: statementFacts(),
      note: approve && adjusted ? t("insurerRec.confirmations.approveNote") : null,
      input: approve
        ? { type: "textarea", label: t("insurerRec.approveRemarks"), maxLength: 1000 }
        : { type: "textarea", label: t("insurerRec.rejectReason"), required: true, maxLength: 1000 },
      confirmLabel: t(approve ? "insurerRec.confirmations.approve" : "insurerRec.confirmations.reject"),
    }, (remarks) => (approve ? service.approve(st.id, remarks) : service.reject(st.id, remarks)), approve ? t("insurerRec.approvedDone") : t("insurerRec.rejectedDone"));
  };
  const cancel = async () => {
    const out = await confirmRun({
      title: t("insurerRec.confirmations.cancelTitle"),
      severity: "danger",
      message: t("insurerRec.confirmations.cancelMessage", { number: st.statementNumber }),
      facts: statementFacts(),
      input: { type: "textarea", label: t("insurerRec.cancelReason"), maxLength: 1000 },
      confirmLabel: t("insurerRec.cancelStatement"),
      cancelLabel: t("insurerRec.confirmations.keepStatement"),
    }, (reason) => service.cancel(st.id, reason), t("insurerRec.cancelled"));
    if (out) navigate("/accounts/insurer-reconciliation/statements");
  };
  const unmatch = (l) => confirmRun({
    title: t("insurerRec.unmatch"),
    severity: "warning",
    message: t("insurerRec.confirmations.unmatchMessage", { line: l.lineNo }),
    facts: [...lineFacts(l), { label: t("insurerRec.brokerGross"), value: l.broker?.grossPremium, type: "amount", hidden: !l.broker }],
    confirmLabel: t("insurerRec.unmatch"),
  }, () => service.unmatch(st.id, l.id), t("insurerRec.unmatched"));
  const removeResolution = (r) => confirmRun({
    title: t("insurerRec.removeResolution"),
    severity: "warning",
    message: t("insurerRec.confirmations.removeResolutionMessage", { policy: r.policyNumber }),
    facts: [
      { label: t("insurerRec.policyNo"), value: r.policyNumber },
      { label: t("insurerRec.insured"), value: r.insured },
      { label: t("insurerRec.resolution"), value: t(`insurerRec.status.${r.resolution.kind}`) },
      { label: t("insurerRec.note"), value: r.resolution.note },
      { label: t("insurerRec.premiumAdjustment"), value: r.resolution.premiumAdjustment, type: "amount", hidden: r.resolution.kind !== "adjustment" },
      { label: t("insurerRec.commissionAdjustment"), value: r.resolution.commissionAdjustment, type: "amount", hidden: r.resolution.kind !== "adjustment" },
    ],
    confirmLabel: t("insurerRec.removeResolution"),
  }, () => service.removeResolution(st.id, r.resolution.id), t("insurerRec.resolutionRemoved"));
  const download = (format) => service.downloadReport(st.id, format, `insurer-reconciliation-${st.statementNumber}`).catch((e) => showError(toast, e));

  const resolutionBody = (r) => (r.resolution ? (
    <div>
      <IrTag status={r.resolution.kind} /> <span className="text-sm">{r.resolution.note}</span>
      {r.resolution.kind === "adjustment" && (
        <div className="pe-muted text-sm">{t("insurerRec.adjustmentAmounts", { premium: money(r.resolution.premiumAdjustment), commission: money(r.resolution.commissionAdjustment) })}
          {r.resolution.journalNumber ? ` · ${r.resolution.journalNumber}` : ` · ${t("insurerRec.postedOnApproval")}`}</div>
      )}
    </div>
  ) : null);
  const lineActions = (l) => (draft ? (
    <div className="flex gap-1">
      {l.matchStatus !== "matched" && <Button icon="pi pi-comment" text size="small" tooltip={t("insurerRec.resolve")} onClick={() => openResolve(l)} aria-label={t("insurerRec.resolve")} />}
      {l.matchStatus === "unmatched"
        ? <Button icon="pi pi-link" text size="small" tooltip={t("insurerRec.matchByHand")} onClick={() => searchCandidates(l, l.policyNumber)} aria-label={t("insurerRec.matchByHand")} />
        : <Button icon="pi pi-times" text size="small" tooltip={t("insurerRec.unmatch")} onClick={() => unmatch(l)} aria-label={t("insurerRec.unmatch")} />}
      {l.resolution && <Button icon="pi pi-undo" text size="small" tooltip={t("insurerRec.removeResolution")} onClick={() => removeResolution(l)} aria-label={t("insurerRec.removeResolution")} />}
    </div>
  ) : null);

  const lineTable = (rows, { differencesOnly = false } = {}) => (
    <DataTable value={rows} dataKey="id" size="small" stripedRows scrollable loading={loading} emptyMessage={t("insurerRec.none")}>
      <Column field="lineNo" header="#" />
      <Column field="policyNumber" header={t("insurerRec.policyNo")} />
      <Column field="insured" header={t("insurerRec.insured")} />
      {!differencesOnly && <Column header={t("insurerRec.statusLabel")} body={(l) => <IrTag status={l.matchStatus} />} />}
      <Column header={t("insurerRec.grossPremium")} body={(l) => money(l.grossPremium)} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.brokerGross")} body={(l) => (l.broker ? money(l.broker.grossPremium) : "-")} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.premiumDiff")} body={(l) => <Diff value={l.differences?.grossPremium} />} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.commission")} body={(l) => money(l.commission)} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.brokerCommission")} body={(l) => (l.broker ? money(l.broker.commission) : "-")} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.commissionDiff")} body={(l) => <Diff value={l.differences?.commission} />} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.amountPaid")} body={(l) => money(l.amountPaid)} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.amountDiff")} body={(l) => <Diff value={l.differences?.amountPaid} />} className="bv-num" headerClassName="bv-num" />
      <Column header={t("insurerRec.resolution")} body={resolutionBody} style={{ minWidth: "14rem" }} />
      <Column body={lineActions} />
    </DataTable>
  );

  if (!st) return <div className="pe-page"><Toast ref={toast} /></div>;
  const s = st.summary;
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={`${st.statementNumber} · ${st.insurerName}`} trail={[t("insurerRec.statements"), st.statementNumber]}
        subtitle={`${t(`insurerRec.type_${st.statementType}`)}${st.statementRef ? ` ${st.statementRef}` : ""} · ${date(st.periodFrom)} - ${date(st.periodTo)} · ${t("insurerRec.tolerance")} ${money(st.tolerance)}`}>
        <IrTag status={st.status} />
        {draft && <Button icon="pi pi-bolt" label={t("insurerRec.autoMatch")} outlined onClick={() => run(() => service.autoMatch(st.id), (r) => t("insurerRec.autoMatched", r))} />}
        {draft && <Button icon="pi pi-send" label={t("insurerRec.submit")} onClick={submit} />}
        {st.status === "submitted" && (
          <ApprovalActions initiator={{ id: st.createdById }} approveLabel={t("insurerRec.confirmations.approve")} rejectLabel={t("insurerRec.confirmations.reject")}
            onApprove={() => decide("approve")} onReject={() => decide("reject")} />
        )}
        {draft && <Button icon="pi pi-ban" label={t("insurerRec.cancelStatement")} text onClick={cancel} />}
        <Button icon="pi pi-file-excel" label="Excel" outlined onClick={() => download("xlsx")} />
        <Button icon="pi pi-file-pdf" label="PDF" outlined onClick={() => download("pdf")} />
      </PageHeader>

      <div className="grid mb-2">
        {[["lines", s.lines], ["matched", s.matched], ["differences", s.differences], ["missingInBroker", s.missingInBroker], ["missingInInsurer", s.missingInInsurer], ["unresolved", s.unresolved]]
          .map(([k, v]) => (
            <div className="col-6 md:col-2" key={k}>
              <div className="pe-card p-3"><div className="pe-muted text-sm">{t(`insurerRec.summary.${k}`)}</div><div className="text-2xl font-semibold">{v}</div></div>
            </div>
          ))}
      </div>
      <div className="pe-card mb-2 text-sm">
        {t("insurerRec.totalsLine", { insurerGross: money(s.insurer.grossPremium), brokerGross: money(s.broker.grossPremium), insurerComm: money(s.insurer.commission),
          brokerComm: money(s.broker.commission), premiumAdj: money(s.adjustments.premium), commissionAdj: money(s.adjustments.commission) })}
        {st.rejectionReason && st.status === "draft" && <div className="text-red-600 mt-1">{t("insurerRec.rejectedBecause", { reason: st.rejectionReason })}</div>}
      </div>

      <div className="pe-card">
        <TabView>
          <TabPanel header={`${t("insurerRec.tab.differences")} (${st.amountDifferences.length})`}>{lineTable(st.amountDifferences, { differencesOnly: true })}</TabPanel>
          <TabPanel header={`${t("insurerRec.tab.missingInBroker")} (${st.missingInBroker.length})`}>{lineTable(st.missingInBroker, { differencesOnly: true })}</TabPanel>
          <TabPanel header={`${t("insurerRec.tab.missingInInsurer")} (${st.missingInInsurer.length})`}>
            <DataTable value={st.missingInInsurer} dataKey="id" size="small" stripedRows emptyMessage={t("insurerRec.none")}>
              <Column field="policyNumber" header={t("insurerRec.policyNo")} />
              <Column field="insured" header={t("insurerRec.insured")} />
              <Column field="document" header={t("insurerRec.document")} />
              <Column header={t("insurerRec.date")} body={(r) => date(r.date)} />
              <Column header={t("insurerRec.brokerGross")} body={(r) => money(r.grossPremium)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("insurerRec.brokerCommission")} body={(r) => money(r.commission)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("insurerRec.brokerAmount")} body={(r) => money(r.amount)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("insurerRec.resolution")} body={resolutionBody} style={{ minWidth: "14rem" }} />
              <Column body={(r) => (draft ? (
                <div className="flex gap-1">
                  <Button icon="pi pi-comment" text size="small" tooltip={t("insurerRec.resolve")} onClick={() => openResolve(r)} aria-label={t("insurerRec.resolve")} />
                  {r.resolution && <Button icon="pi pi-undo" text size="small" tooltip={t("insurerRec.removeResolution")} onClick={() => removeResolution(r)} aria-label={t("insurerRec.removeResolution")} />}
                </div>
              ) : null)} />
            </DataTable>
          </TabPanel>
          <TabPanel header={`${t("insurerRec.tab.all")} (${st.lines.length})`}>{lineTable(st.lines)}</TabPanel>
        </TabView>
      </div>

      <div className="pe-card mt-2">
        <h3 className="mt-0">{t("insurerRec.confirmations.activity")}</h3>
        <ActivityLog entries={activity.error ? fromLifecycle(st, STATEMENT_STEPS) : activity.entries} loading={activity.loading} />
      </div>

      <Dialog className="pe-dialog" header={resolve ? `${t("insurerRec.resolve")} · ${resolve.target.policyNumber}` : ""} visible={!!resolve} style={{ width: "min(620px, 96vw)" }} onHide={() => setResolve(null)}
        footer={<div><Button label={t("insurerRec.cancel")} text onClick={() => setResolve(null)} /><Button label={t("insurerRec.save")} icon="pi pi-save" onClick={saveResolve} disabled={!resolve?.note?.trim()} /></div>}>
        {resolve && (
          <div className="grid">
            <div className="col-12 flex gap-4">
              {["note", "adjustment"].map((k) => (
                <span className="flex align-items-center gap-2" key={k}>
                  <RadioButton inputId={`ir-kind-${k}`} value={k} checked={resolve.kind === k} onChange={(e) => setResolve({ ...resolve, kind: e.value })} />
                  <label htmlFor={`ir-kind-${k}`} className="m-0">{t(`insurerRec.kind.${k}`)}</label>
                </span>
              ))}
            </div>
            <div className="col-12"><label>{t("insurerRec.note")} *</label>
              <InputTextarea value={resolve.note} rows={3} autoResize onChange={(e) => setResolve({ ...resolve, note: e.target.value })} className="w-full" /></div>
            {resolve.kind === "adjustment" && (
              <>
                <div className="col-12 md:col-6"><label>{t("insurerRec.premiumAdjustment")}</label>
                  <InputNumber value={resolve.premiumAdjustment} mode="decimal" minFractionDigits={2} maxFractionDigits={2} onValueChange={(e) => setResolve({ ...resolve, premiumAdjustment: e.value })} className="w-full" />
                  <small className="pe-muted">{t("insurerRec.premiumAdjustmentHelp")}</small></div>
                <div className="col-12 md:col-6"><label>{t("insurerRec.commissionAdjustment")}</label>
                  <InputNumber value={resolve.commissionAdjustment} mode="decimal" minFractionDigits={2} maxFractionDigits={2} onValueChange={(e) => setResolve({ ...resolve, commissionAdjustment: e.value })} className="w-full" />
                  <small className="pe-muted">{t("insurerRec.commissionAdjustmentHelp")}</small></div>
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={match ? `${t("insurerRec.matchByHand")} · ${match.line.policyNumber}` : ""} visible={!!match} style={{ width: "min(900px, 96vw)" }} onHide={() => setMatch(null)}>
        {match && (
          <div>
            <div className="flex gap-2 mb-2">
              <InputText value={match.search} onChange={(e) => setMatch({ ...match, search: e.target.value })} placeholder={t("insurerRec.searchCandidates")} className="w-full" />
              <Button icon="pi pi-search" onClick={() => searchCandidates(match.line, match.search)} aria-label={t("common.search")} tooltip={t("common.search")} tooltipOptions={{ position: "top" }} />
            </div>
            <DataTable value={match.candidates} dataKey="id" size="small" stripedRows scrollable scrollHeight="360px" emptyMessage={t("insurerRec.none")}>
              <Column header={t("insurerRec.brokerRecord")} body={(r) => t(`insurerRec.record.${r.type}`)} />
              <Column field="policyNumber" header={t("insurerRec.policyNo")} />
              <Column field="insured" header={t("insurerRec.insured")} />
              <Column field="document" header={t("insurerRec.document")} />
              <Column header={t("insurerRec.brokerGross")} body={(r) => money(r.grossPremium)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("insurerRec.brokerCommission")} body={(r) => money(r.commission)} className="bv-num" headerClassName="bv-num" />
              <Column body={(r) => <Button label={t("insurerRec.pick")} size="small" onClick={async () => {
                const out = await run(() => service.match(st.id, match.line.id, { brokerType: r.type, brokerId: r.id }), (x) => t("insurerRec.matchedAs", { status: t(`insurerRec.status.${x.status}`) }));
                if (out) setMatch(null);
              }} />} />
            </DataTable>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Workspace;
