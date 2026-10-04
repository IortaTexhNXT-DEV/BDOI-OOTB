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
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
import { BirTag, Kpis, PageHeader, YearPicker, date, money, showError, showSuccess } from "./common";

const pct = (v) => (v === null || v === undefined ? "-" : `${Number(v).toLocaleString("en-PH", { maximumFractionDigits: 2 })}%`);

/** One computation: figures, per line production, settlements, and the actions of its status. */
const ComputationDetail = ({ comp, onHide, onChanged, toast }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [settle, setSettle] = useState(null);
  const run = async (fn, msg) => { try { const r = await fn(); if (msg) showSuccess(toast, typeof msg === "function" ? msg(r) : msg); onChanged(); } catch (e) { showError(toast, e); } };
  const doReason = () => run(async () => {
    if (reason.kind === "reject") await birTaxService.rejectOverride(comp.id, reason.text);
    else await birTaxService.cancelOverride(comp.id, reason.text);
    setReason(null);
  }, t("birTax.saved"));
  const doSettle = () => run(async () => {
    const r = await birTaxService.settleOverride(comp.id, { statementReference: settle.statementReference, statementDate: toIsoDate(settle.statementDate), statementAmount: Number(settle.statementAmount || 0),
      cashReceived: Number(settle.cashReceived || 0), ewtWithheld: Number(settle.ewtWithheld || 0), form2307No: settle.form2307No || undefined, differenceTreatment: settle.differenceTreatment,
      remarks: settle.remarks || undefined });
    setSettle(null);
    return r;
  }, (r) => (r.statementMatches ? t("birTax.settledMsg") : t("birTax.statementDiffMsg", { diff: money(r.statementDifference) })));
  const invoice = () => run(() => birTaxService.issueInvoice({ sourceType: "override_commission", sourceId: comp.id }), (r) => `${r.invoiceNumber} ${t("birTax.issuedMsg")}`);
  return (
    <Dialog className="pe-dialog" visible header={`${comp.computationNumber} · ${comp.insurerName} · ${comp.periodLabel}`} style={{ width: "min(1000px, 96vw)" }} onHide={onHide}
      footer={(
        <div className="flex flex-wrap gap-2 justify-content-end">
          {comp.status === "draft" && <Button label={t("birTax.submit")} icon="pi pi-send" onClick={() => run(() => birTaxService.submitOverride(comp.id), t("birTax.saved"))} />}
          {comp.status === "submitted" && <Button label={t("birTax.approve")} icon="pi pi-check" onClick={() => run(() => birTaxService.approveOverride(comp.id), t("birTax.approvedMsg"))} />}
          {comp.status === "submitted" && <Button label={t("birTax.reject")} icon="pi pi-times" severity="danger" outlined onClick={() => setReason({ kind: "reject", text: "" })} />}
          {["approved", "partially_settled", "settled"].includes(comp.status) && comp.receivable > 0 && <Button label={t("birTax.issueInvoice")} icon="pi pi-file" outlined onClick={invoice} />}
          {["approved", "partially_settled"].includes(comp.status) && (
            <Button label={t("birTax.settle")} icon="pi pi-wallet" onClick={() => setSettle({ statementReference: "", statementDate: new Date(), statementAmount: comp.receivable,
              cashReceived: Math.round((comp.balance - comp.expectedEwt) * 100) / 100, ewtWithheld: comp.expectedEwt, differenceTreatment: "leave_open" })} />
          )}
          {["draft", "submitted", "approved"].includes(comp.status) && <Button label={t("birTax.cancelComputation")} icon="pi pi-ban" severity="danger" text onClick={() => setReason({ kind: "cancel", text: "" })} />}
        </div>
      )}>
      <div className="flex gap-2 align-items-center mb-2"><BirTag status={comp.status} /><span className="pe-muted">{t(`birTax.overrideType.${comp.commissionType}`)} · {t(`birTax.basisValue.${comp.basis}`)} · {date(comp.periodFrom)} to {date(comp.periodTo)}</span></div>
      <Kpis items={[{ label: t("birTax.production"), value: money(comp.production) }, { label: t("birTax.claimsIncurred"), value: `${money(comp.claimsIncurred)} (${t(`birTax.claimsSource.${comp.claimsSource}`)})` },
        { label: t("birTax.lossRatio"), value: pct(comp.lossRatioPct) }, { label: t("birTax.growth"), value: pct(comp.growthPct) },
        { label: t("birTax.tierRate"), value: comp.tierNo ? `${comp.tierNo}: ${comp.rate}%` : "-" }]} />
      <Kpis items={[{ label: t("birTax.commissionAmount"), value: money(comp.commission) }, { label: "VAT", value: money(comp.vat) }, { label: t("birTax.receivable"), value: money(comp.receivable) },
        { label: t("birTax.expectedEwt"), value: money(comp.expectedEwt) }, { label: t("birTax.balance"), value: money(comp.balance) }]} />
      {comp.journalNumber && <p className="pe-muted">{t("birTax.journal")}: {comp.journalNumber}</p>}
      {comp.claimsNote && <p className="pe-muted">{t("birTax.claimsNote")}: {comp.claimsNote}</p>}
      <h4>{t("birTax.productionPerLine")}</h4>
      <DataTable value={comp.details?.perLine || []} size="small" dataKey="lob" emptyMessage={t("birTax.noRows")}>
        <Column field="lob" header={t("birTax.lineOfBusiness")} />
        <Column field="policies" header={t("birTax.policies")} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.production")} body={(r) => money(r.premium)} className="bv-num" headerClassName="bv-num" />
      </DataTable>
      <h4>{t("birTax.settlements")}</h4>
      <DataTable value={comp.settlements || []} size="small" dataKey="id" emptyMessage={t("birTax.noRows")}>
        <Column field="statementReference" header={t("birTax.statementReference")} />
        <Column header={t("birTax.statementDate")} body={(r) => date(r.statementDate)} />
        <Column header={t("birTax.statementAmount")} body={(r) => money(r.statementAmount)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.amountReceived")} body={(r) => money(r.cashReceived)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.ewt")} body={(r) => money(r.ewtWithheld)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.applied")} body={(r) => money(r.applied)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.difference")} body={(r) => money(r.difference)} className="bv-num" headerClassName="bv-num" />
      </DataTable>
      {reason && (
        <Dialog className="pe-dialog" visible header={reason.kind === "reject" ? t("birTax.reject") : t("birTax.cancelComputation")} style={{ width: "min(520px, 95vw)" }} onHide={() => setReason(null)}
          footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setReason(null)} /><Button label={t("birTax.confirm")} severity="danger" disabled={reason.text.trim().length < 3} onClick={doReason} /></div>}>
          <label>{t("birTax.reason")} *</label><InputTextarea value={reason.text} rows={3} onChange={(e) => setReason({ ...reason, text: e.target.value })} className="w-full" />
        </Dialog>
      )}
      {settle && (
        <Dialog className="pe-dialog" visible header={t("birTax.settle")} style={{ width: "min(720px, 95vw)" }} onHide={() => setSettle(null)}
          footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setSettle(null)} /><Button label={t("periodEnd.save")} icon="pi pi-save" disabled={!settle.statementReference} onClick={doSettle} /></div>}>
          <div className="grid">
            <div className="col-12 md:col-6"><label>{t("birTax.statementReference")} *</label><InputText value={settle.statementReference} onChange={(e) => setSettle({ ...settle, statementReference: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.statementDate")}</label><Calendar value={settle.statementDate} onChange={(e) => setSettle({ ...settle, statementDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("birTax.statementAmount")}</label><InputNumber value={settle.statementAmount} onValueChange={(e) => setSettle({ ...settle, statementAmount: e.value })} minFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("birTax.amountReceived")}</label><InputNumber value={settle.cashReceived} onValueChange={(e) => setSettle({ ...settle, cashReceived: e.value })} minFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("birTax.ewt")}</label><InputNumber value={settle.ewtWithheld} onValueChange={(e) => setSettle({ ...settle, ewtWithheld: e.value })} minFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.form2307No")}</label><InputText value={settle.form2307No || ""} onChange={(e) => setSettle({ ...settle, form2307No: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.differenceTreatment")}</label>
              <Dropdown value={settle.differenceTreatment} options={["leave_open", "adjust_income"].map((x) => ({ label: t(`birTax.treatment.${x}`), value: x }))} onChange={(e) => setSettle({ ...settle, differenceTreatment: e.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("periodEnd.remarks")}</label><InputTextarea value={settle.remarks || ""} rows={2} onChange={(e) => setSettle({ ...settle, remarks: e.target.value })} className="w-full" /></div>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
};

/**
 * Commission > Insurer Overrides > Computations: per agreement and year the periods with their computation; compute
 * (with the insurer's claims figure when it differs), submit, approve by another user (posts the receivable), invoice
 * and settle against the insurer's statement. The list below shows every computation of the year; Excel export.
 */
const OverrideComputations = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [agreements, setAgreements] = useState([]);
  const [agreementId, setAgreementId] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [periods, setPeriods] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [compute, setCompute] = useState(null);

  useEffect(() => { birTaxService.overrideAgreements({ status: "active" }).then((a) => { setAgreements(a); if (a.length) setAgreementId((x) => x || a[0].id); }).catch((e) => showError(toast, e)); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await birTaxService.overrideComputations({ year }));
      if (agreementId) setPeriods(await birTaxService.overridePeriods(agreementId, year));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [agreementId, year]);
  useEffect(() => { load(); }, [load]);
  const openDetail = async (id) => { try { setDetail(await birTaxService.overrideComputation(id)); } catch (e) { showError(toast, e); } };
  const preview = async (p, claims) => {
    try {
      const pv = await birTaxService.overridePreview(agreementId, { year, periodLabel: p.label, claimsIncurred: claims ?? undefined });
      setCompute((c) => ({ ...(c || {}), period: p, claims, preview: pv }));
    } catch (e) {
      showError(toast, e);
    }
  };
  const doCompute = async () => {
    try {
      const c = await birTaxService.computeOverride(agreementId, { year, periodLabel: compute.period.label, claimsIncurred: compute.claims ?? null, claimsNote: compute.note || undefined });
      showSuccess(toast, `${c.computationNumber} ${t("birTax.computed")}`);
      setCompute(null);
      load();
      openDetail(c.id);
    } catch (e) {
      showError(toast, e);
    }
  };

  const ag = agreements.find((a) => a.id === agreementId);
  const live = rows.filter((r) => !["rejected", "cancelled"].includes(r.status));
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader section={t("birTax.commission")} title={t("birTax.overrideComputations")} trail={[t("birTax.insurerOverrides"), t("birTax.overrideComputations")]} subtitle={t("birTax.overrideComputationsHelp")}>
        <Dropdown value={agreementId} options={agreements.map((a) => ({ label: `${a.agreementCode} · ${a.insurerName}`, value: a.id }))} onChange={(e) => setAgreementId(e.value)} filter placeholder={t("birTax.agreement")} />
        <YearPicker value={year} onChange={setYear} />
        <Button icon="pi pi-file-excel" outlined label={t("birTax.excel")} onClick={() => birTaxService.overrideExport(year).catch((e) => showError(toast, e))} />
      </PageHeader>
      <Kpis items={[{ label: t("birTax.computations"), value: live.length }, { label: t("birTax.commissionAmount"), value: money(live.reduce((s, r) => s + r.commission, 0)) },
        { label: t("birTax.receivable"), value: money(live.reduce((s, r) => s + r.receivable, 0)) }, { label: t("birTax.balance"), value: money(live.reduce((s, r) => s + r.balance, 0)) }]} />
      {ag && (
        <div className="pe-card">
          <h4>{ag.name}</h4>
          <p className="pe-muted">{t(`birTax.overrideType.${ag.commissionType}`)} · {t(`birTax.basisValue.${ag.basis}`)} · {t(`birTax.periodTypeValue.${ag.periodType}`)} ·{" "}
            {ag.tiers.map((x) => `${x.fromValue.toLocaleString()}${x.toValue === null ? "+" : ` to ${x.toValue.toLocaleString()}`}: ${x.rate}%`).join("; ")}</p>
          <DataTable value={periods} size="small" dataKey="label" emptyMessage={t("birTax.noRows")}>
            <Column field="label" header={t("birTax.period")} />
            <Column header={t("birTax.from")} body={(p) => date(p.from)} />
            <Column header={t("birTax.to")} body={(p) => date(p.to)} />
            <Column header={t("birTax.computation")} body={(p) => (p.computation ? <button type="button" className="pe-link" onClick={() => openDetail(p.computation.id)}>{p.computation.computationNumber}</button> : "")} />
            <Column header={t("birTax.commissionAmount")} body={(p) => (p.computation ? money(p.computation.commission) : "")} className="bv-num" headerClassName="bv-num" />
            <Column header={t("birTax.statusLabel")} body={(p) => (p.computation ? <BirTag status={p.computation.status} /> : "")} />
            <Column body={(p) => (!p.computation || p.computation.status === "draft") && (
              <Button icon="pi pi-calculator" size="small" outlined label={p.computation ? t("birTax.recompute") : t("birTax.compute")} onClick={() => { setCompute({ period: p }); preview(p, null); }} />
            )} />
          </DataTable>
        </div>
      )}
      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("birTax.noRows")}>
          <Column field="computationNumber" header={t("birTax.computation")} body={(r) => <button type="button" className="pe-link" onClick={() => openDetail(r.id)}>{r.computationNumber}</button>} />
          <Column field="insurerName" header={t("birTax.insurer")} />
          <Column field="agreementCode" header={t("birTax.agreement")} />
          <Column field="periodLabel" header={t("birTax.period")} />
          <Column header={t("birTax.production")} body={(r) => money(r.production)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.lossRatio")} body={(r) => pct(r.lossRatioPct)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.rate")} body={(r) => `${r.rate}%`} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.receivable")} body={(r) => money(r.receivable)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.balance")} body={(r) => money(r.balance)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
        </DataTable>
      </div>
      {compute && (
        <Dialog className="pe-dialog" visible header={`${t("birTax.compute")} ${compute.period.label}`} style={{ width: "min(760px, 95vw)" }} onHide={() => setCompute(null)}
          footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setCompute(null)} /><Button label={t("birTax.compute")} icon="pi pi-calculator" onClick={doCompute} /></div>}>
          {compute.preview && (
            <>
              <Kpis items={[{ label: t("birTax.production"), value: money(compute.preview.production) }, { label: t("birTax.policies"), value: compute.preview.policies },
                { label: t("birTax.claimsIncurred"), value: money(compute.preview.claimsIncurred) }, { label: t("birTax.lossRatio"), value: pct(compute.preview.lossRatioPct) },
                { label: t("birTax.growth"), value: pct(compute.preview.growthPct) }]} />
              <Kpis items={[{ label: t("birTax.tierRate"), value: compute.preview.tierNo ? `${compute.preview.tierNo}: ${compute.preview.rate}%` : "-" },
                { label: t("birTax.commissionAmount"), value: money(compute.preview.commission) }, { label: "VAT", value: money(compute.preview.vat) },
                { label: t("birTax.receivable"), value: money(compute.preview.receivable) }]} />
            </>
          )}
          <Message severity="info" className="w-full mb-2" text={t("birTax.insurerClaimsNote")} />
          <div className="grid">
            <div className="col-12 md:col-5"><label>{t("birTax.insurerClaims")}</label><InputNumber value={compute.claims ?? null} onValueChange={(e) => setCompute({ ...compute, claims: e.value })}
              onBlur={() => preview(compute.period, compute.claims)} minFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-7"><label>{t("birTax.claimsNote")}</label><InputText value={compute.note || ""} onChange={(e) => setCompute({ ...compute, note: e.target.value })} className="w-full" /></div>
          </div>
        </Dialog>
      )}
      {detail && <ComputationDetail comp={detail} toast={toast} onHide={() => setDetail(null)} onChanged={() => { load(); openDetail(detail.id); }} />}
    </div>
  );
};

export default OverrideComputations;
