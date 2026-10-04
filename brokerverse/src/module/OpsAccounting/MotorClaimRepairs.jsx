import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { promptText } from "../../utility/dialogs";
import { Field, OpsTag, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess } from "./common";

const STAGES = ["all", "no-estimate", "awaiting-approval", "approved", "in-repair", "released"];
const AMOUNTS = ["parts", "labour", "paint", "other", "vat"];

/**
 * Operations > Motor Claim Repairs: estimates of accredited repair shops, the insurer adjuster's decision recorded by
 * the claims officer, supplementary estimates, the letter of authority with the insured's participation and the
 * release of the repaired vehicle.
 */
const MotorClaimRepairs = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [shops, setShops] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [decision, setDecision] = useState(null);
  const [loa, setLoa] = useState(null);
  const [release, setRelease] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.motorRepairs({ stage, search: search || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [stage, search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { service.repairShops().then(setShops).catch(() => {}); }, []);

  const open = async (claimId) => {
    try {
      setFile(await service.repairFile(claimId));
    } catch (e) {
      showError(toast, e);
    }
  };
  const run = async (fn, message, after) => {
    try {
      const r = await fn();
      showSuccess(toast, typeof message === "function" ? message(r) : message);
      after?.();
      await open(file.claimId);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const total = (e) => AMOUNTS.reduce((s, k) => s + Number(e?.[k] || 0), 0);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.motor.title")} group={t("opsAcc.operations")} subtitle={t("opsAcc.motor.intro")} />
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <Dropdown value={stage} options={STAGES.map((s) => ({ label: t(`opsAcc.status.${s}`), value: s }))} onChange={(e) => setStage(e.value)} className="w-14rem" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.claimSearch")} className="w-20rem" />
        </div>
        <DataTable value={rows} dataKey="claimId" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("opsAcc.none")} rowHover onRowClick={(e) => open(e.data.claimId)}>
          <Column field="claimNumber" header={t("opsAcc.claim")} />
          <Column field="policyNumber" header={t("opsAcc.policy")} />
          <Column field="insured" header={t("opsAcc.motor.insured")} />
          <Column field="claimType" header={t("opsAcc.motor.claimType")} />
          <Column field="estimates" header={t("opsAcc.motor.estimates")} {...numericColumn} />
          <Column header={t("opsAcc.motor.approved")} body={(r) => money(r.approvedAmount)} {...numericColumn} />
          <Column field="loaNumbers" header={t("opsAcc.motor.loa")} />
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.stage} />} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={file ? `${file.claimNumber} · ${file.vehicle || file.policyNumber}` : ""} visible={!!file} style={{ width: "min(1100px, 98vw)" }} onHide={() => setFile(null)}>
        {file && (
          <>
            <p className="mt-0">{file.insuredName} · {file.insurerName} · {t("opsAcc.motor.sumInsured")} {money(file.sumInsured)} · {t("opsAcc.motor.defaultParticipation")} {money(file.defaultParticipation)}</p>
            <div className="flex gap-2 mb-2">
              <Button label={t("opsAcc.motor.addEstimate")} icon="pi pi-plus" onClick={() => setEstimate({ repairShopCode: shops[0]?.code || null, shopReference: "", estimateDate: new Date() })} />
              <Button label={t("opsAcc.motor.issueLoa")} icon="pi pi-file" outlined disabled={!file.readyForLoa.length}
                onClick={() => setLoa({ participation: file.loas.some((l) => l.status === "issued") ? 0 : file.defaultParticipation, depreciation: null, remarks: "" })} />
              <Button label={t("opsAcc.motor.release")} icon="pi pi-car" outlined disabled={!file.loas.some((l) => l.status === "issued")}
                onClick={() => setRelease({ releasedTo: file.insuredName || "", releasedOn: new Date(), repairCompletedOn: null, participationCollected: null, odometer: "" })} />
            </div>
            <h4>{t("opsAcc.motor.estimates")}</h4>
            <DataTable value={file.estimates} dataKey="id" size="small" stripedRows emptyMessage={t("opsAcc.none")}>
              <Column field="seq" header="#" />
              <Column header={t("opsAcc.motor.kind")} body={(r) => t(`opsAcc.motor.kinds.${r.kind}`)} />
              <Column field="repairShopName" header={t("opsAcc.motor.shop")} />
              <Column header={t("opsAcc.date")} body={(r) => date(r.estimateDate)} />
              <Column header={t("opsAcc.motor.total")} body={(r) => money(r.total)} {...numericColumn} />
              <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
              <Column header={t("opsAcc.motor.approved")} body={(r) => (r.approvedAmount === null ? "" : money(r.approvedAmount))} {...numericColumn} />
              <Column header={t("opsAcc.motor.adjuster")} body={(r) => [r.adjusterName, r.approvalReference].filter(Boolean).join(" · ")} />
              <Column body={(r) => (r.status === "submitted" ? <Button label={t("opsAcc.motor.recordDecision")} size="small" outlined
                onClick={() => setDecision({ estimate: r, decision: "approve", approvedAmount: r.total, adjusterName: "", adjusterCompany: "", approvalReference: "", remarks: "" })} /> : null)} />
            </DataTable>
            <h4>{t("opsAcc.motor.loas")}</h4>
            <DataTable value={file.loas} dataKey="id" size="small" stripedRows emptyMessage={t("opsAcc.none")}>
              <Column field="loaNumber" header={t("opsAcc.motor.loa")} />
              <Column header={t("opsAcc.motor.kind")} body={(r) => t(`opsAcc.motor.kinds.${r.kind}`)} />
              <Column field="repairShopName" header={t("opsAcc.motor.shop")} />
              <Column header={t("opsAcc.motor.repairCost")} body={(r) => money(r.approvedRepairCost)} {...numericColumn} />
              <Column header={t("opsAcc.motor.participation")} body={(r) => money(r.participation)} {...numericColumn} />
              <Column header={t("opsAcc.motor.byInsurer")} body={(r) => money(r.payableByInsurer)} {...numericColumn} />
              <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
              <Column body={(r) => (
                <span className="flex gap-1">
                  <Button icon="pi pi-print" text size="small" aria-label={t("opsAcc.print")} tooltip={t("opsAcc.print")} onClick={() => service.printLoa(file.claimId, r.id).catch((e) => showError(toast, e))} />
                  {r.status === "issued" && <Button icon="pi pi-times" text size="small" severity="danger" aria-label={t("opsAcc.cancel")} tooltip={t("opsAcc.cancel")}
                    onClick={async () => { const reason = await promptText(t("opsAcc.motor.cancelLoaReason")); if (reason) run(() => service.cancelLoa(file.claimId, r.id, reason), t("opsAcc.motor.loaCancelled")); }} />}
                </span>
              )} />
            </DataTable>
            {file.releases.length > 0 && (
              <>
                <h4>{t("opsAcc.motor.releases")}</h4>
                <DataTable value={file.releases} dataKey="id" size="small">
                  <Column header={t("opsAcc.motor.releasedOn")} body={(r) => date(r.releasedOn)} />
                  <Column field="releasedTo" header={t("opsAcc.motor.releasedTo")} />
                  <Column header={t("opsAcc.motor.participationCollected")} body={(r) => money(r.participationCollected)} {...numericColumn} />
                  <Column body={(r) => <Button icon="pi pi-print" text size="small" aria-label={t("opsAcc.print")} tooltip={t("opsAcc.print")} onClick={() => service.printRelease(file.claimId, r.id).catch((e) => showError(toast, e))} />} />
                </DataTable>
              </>
            )}
          </>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("opsAcc.motor.addEstimate")} visible={!!estimate} style={{ width: "min(720px, 96vw)" }} onHide={() => setEstimate(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setEstimate(null)} /><Button label={t("opsAcc.save")} icon="pi pi-save"
          onClick={() => run(() => service.addEstimate(file.claimId, { ...estimate, estimateDate: isoOf(estimate.estimateDate) }), t("opsAcc.motor.estimateSaved"), () => setEstimate(null))} /></div>}>
        {estimate && (
          <div className="grid">
            <Field label={t("opsAcc.motor.shop")} col="col-12 md:col-6" required>
              <Dropdown value={estimate.repairShopCode} options={shops.map((s) => ({ label: `${s.name}${s.city ? `, ${s.city}` : ""}`, value: s.code }))} filter onChange={(e) => setEstimate({ ...estimate, repairShopCode: e.value })} className="w-full" />
            </Field>
            <Field label={t("opsAcc.motor.shopReference")} col="col-12 md:col-3"><InputText value={estimate.shopReference} onChange={(e) => setEstimate({ ...estimate, shopReference: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.date")} col="col-12 md:col-3"><Calendar value={estimate.estimateDate} onChange={(e) => setEstimate({ ...estimate, estimateDate: e.value })} showIcon className="w-full" /></Field>
            {AMOUNTS.map((k) => (
              <Field key={k} label={t(`opsAcc.motor.amounts.${k}`)} col="col-6 md:col-4">
                <InputNumber value={estimate[k] ?? null} mode="decimal" minFractionDigits={2} min={0} onValueChange={(e) => setEstimate({ ...estimate, [k]: e.value })} className="w-full" />
              </Field>
            ))}
            <div className="col-12 md:col-4 flex align-items-end"><b>{t("opsAcc.motor.total")}: {money(total(estimate))}</b></div>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={decision ? t("opsAcc.motor.decisionTitle", { seq: decision.estimate.seq }) : ""} visible={!!decision} style={{ width: "min(640px, 96vw)" }} onHide={() => setDecision(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setDecision(null)} /><Button label={t("opsAcc.save")} icon="pi pi-check"
          onClick={() => { const { estimate: est, ...body } = decision; run(() => service.decideEstimate(file.claimId, est.id, { ...body, approvedAmount: body.decision === "approve" ? body.approvedAmount : undefined }), t("opsAcc.motor.decisionSaved"), () => setDecision(null)); }} /></div>}>
        {decision && (
          <div className="grid">
            <Field label={t("opsAcc.motor.decision")} col="col-12 md:col-6">
              <Dropdown value={decision.decision} options={["approve", "reject"].map((d) => ({ label: t(`opsAcc.motor.decisions.${d}`), value: d }))} onChange={(e) => setDecision({ ...decision, decision: e.value })} className="w-full" />
            </Field>
            {decision.decision === "approve" && <Field label={t("opsAcc.motor.approvedAmount")} col="col-12 md:col-6"><InputNumber value={decision.approvedAmount} mode="decimal" minFractionDigits={2} onValueChange={(e) => setDecision({ ...decision, approvedAmount: e.value })} className="w-full" /></Field>}
            <Field label={t("opsAcc.motor.adjusterName")} col="col-12 md:col-6" required><InputText value={decision.adjusterName} onChange={(e) => setDecision({ ...decision, adjusterName: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.motor.adjusterCompany")} col="col-12 md:col-6"><InputText value={decision.adjusterCompany} onChange={(e) => setDecision({ ...decision, adjusterCompany: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.motor.approvalReference")} col="col-12 md:col-6"><InputText value={decision.approvalReference} onChange={(e) => setDecision({ ...decision, approvalReference: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.remarks")} col="col-12 md:col-6"><InputText value={decision.remarks} onChange={(e) => setDecision({ ...decision, remarks: e.target.value })} className="w-full" /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("opsAcc.motor.issueLoa")} visible={!!loa} style={{ width: "min(560px, 96vw)" }} onHide={() => setLoa(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setLoa(null)} /><Button label={t("opsAcc.motor.issueLoa")} icon="pi pi-check"
          onClick={() => run(() => service.issueLoa(file.claimId, { participation: loa.participation ?? undefined, depreciation: loa.depreciation ?? undefined, remarks: loa.remarks || null }),
            (r) => t("opsAcc.motor.loaIssued", { number: r.loaNumber }), () => setLoa(null))} /></div>}>
        {loa && (
          <div className="grid">
            <Field label={t("opsAcc.motor.participation")} col="col-12 md:col-6"><InputNumber value={loa.participation} mode="decimal" minFractionDigits={2} min={0} onValueChange={(e) => setLoa({ ...loa, participation: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.motor.depreciation")} col="col-12 md:col-6"><InputNumber value={loa.depreciation} mode="decimal" minFractionDigits={2} min={0} placeholder={t("opsAcc.motor.fromSettings")} onValueChange={(e) => setLoa({ ...loa, depreciation: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.remarks")} col="col-12"><InputText value={loa.remarks} onChange={(e) => setLoa({ ...loa, remarks: e.target.value })} className="w-full" /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("opsAcc.motor.release")} visible={!!release} style={{ width: "min(560px, 96vw)" }} onHide={() => setRelease(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setRelease(null)} /><Button label={t("opsAcc.save")} icon="pi pi-check"
          onClick={() => run(() => service.releaseVehicle(file.claimId, { releasedTo: release.releasedTo, releasedOn: isoOf(release.releasedOn), repairCompletedOn: isoOf(release.repairCompletedOn) || undefined,
            participationCollected: release.participationCollected ?? undefined, odometer: release.odometer || null }), t("opsAcc.motor.released"), () => setRelease(null))} /></div>}>
        {release && (
          <div className="grid">
            <Field label={t("opsAcc.motor.releasedTo")} col="col-12" required><InputText value={release.releasedTo} onChange={(e) => setRelease({ ...release, releasedTo: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.motor.repairCompleted")} col="col-12 md:col-6"><Calendar value={release.repairCompletedOn} onChange={(e) => setRelease({ ...release, repairCompletedOn: e.value })} showIcon className="w-full" /></Field>
            <Field label={t("opsAcc.motor.releasedOn")} col="col-12 md:col-6"><Calendar value={release.releasedOn} onChange={(e) => setRelease({ ...release, releasedOn: e.value })} showIcon className="w-full" /></Field>
            <Field label={t("opsAcc.motor.participationCollected")} col="col-12 md:col-6"><InputNumber value={release.participationCollected} mode="decimal" minFractionDigits={2} min={0} onValueChange={(e) => setRelease({ ...release, participationCollected: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.motor.odometer")} col="col-12 md:col-6"><InputText value={release.odometer} onChange={(e) => setRelease({ ...release, odometer: e.target.value })} className="w-full" /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default MotorClaimRepairs;
