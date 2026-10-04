import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import { confirmAction, promptText } from "../../utility/dialogs";
import { Field, PageHeader, StatusTag, date, dateTime, isoDay, money, num, showError, showSuccess, useInsurers } from "./common";

const BASE = "/reinsurance/facultative";
const SHARE_STATUSES = ["approached", "quoted", "accepted", "declined"];

/** Reinsurance > Facultative Placements: facultative slips where the broker acts as reinsurance broker. */
const FacultativePlacements = () => {
  const { id } = useParams();
  return id ? <SlipDetail id={id} /> : <SlipList />;
};

const SlipList = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:reinsurance");
  const insurers = useInsurers();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ status: null, search: "" });
  const [form, setForm] = useState(null);
  const [bdx, setBdx] = useState(null);
  const [reinsurers, setReinsurers] = useState([]);

  const load = useCallback(async () => {
    try {
      setRows(await service.facPlacements({ status: filters.status || undefined, search: filters.search || undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { service.reinsurers().then((r) => setReinsurers(r.map((x) => ({ value: x.id, label: `${x.name} (${x.rating || "NR"})` })))).catch(() => setReinsurers([])); }, []);

  const create = async () => {
    try {
      const r = await service.createFacPlacement({ ...form, periodFrom: isoDay(form.periodFrom), periodTo: isoDay(form.periodTo) });
      showSuccess(toast, r.message);
      navigate(`${BASE}/${r.data.id}`);
    } catch (e) {
      showError(toast, e);
    }
  };
  const bordereau = async (format) => {
    try {
      await service.facBordereau({ from: isoDay(bdx.from), to: isoDay(bdx.to), reinsurerId: bdx.reinsurerId || undefined, format });
    } catch (e) {
      showError(toast, e);
    }
  };
  const keepBordereau = async () => {
    try {
      const period = isoDay(bdx.from).slice(0, 7);
      showSuccess(toast, (await service.generateFacBordereau({ period, reinsurerId: bdx.reinsurerId })).message);
    } catch (e) {
      showError(toast, e);
    }
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const now = new Date();

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.reinsurance", "Reinsurance")} title={t("distribution.fac.title", "Facultative Placements")}
        subtitle={t("distribution.fac.subtitle", "Risks a cedant offers to the facultative market through the broker: slip, reinsurers' lines, binding, premium settlement and bordereaux.")}>
        <Button label={t("distribution.fac.bordereau", "Bordereau")} icon="pi pi-table" outlined onClick={() => setBdx({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, reinsurerId: null })} />
        {write ? <Button label={t("distribution.fac.new", "New slip")} icon="pi pi-plus"
          onClick={() => setForm({ cedantId: null, cedantPolicyNumber: "", insuredName: "", riskDescription: "", riskLocation: "", lineOfBusiness: "Property", periodFrom: now,
            periodTo: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()), currency: "PHP", sumInsured: null, grossPremium: null, facSharePct: null, cedingCommissionPct: null, brokeragePct: null,
            deductibles: "", conditions: "", claimsBasis: "" })} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="dist-toolbar">
          <Dropdown value={filters.status} options={["draft", "in-market", "placed", "bound", "closed", "cancelled"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} showClear
            placeholder={t("distribution.common.status", "Status")} onChange={(e) => setFilters({ ...filters, status: e.value || null })} />
          <span className="p-input-icon-left"><i className="pi pi-search" />
            <InputText value={filters.search} placeholder={t("distribution.fac.search", "Slip, insured or original policy")} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></span>
        </div>
        <DataTable value={rows} dataKey="id" size="small" stripedRows paginator rows={20} selectionMode="single" onRowClick={(e) => navigate(`${BASE}/${e.data.id}`)} emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column field="slipNumber" header={t("distribution.fac.slip", "Slip")} />
          <Column field="cedantName" header={t("distribution.fac.cedant", "Cedant")} />
          <Column field="insuredName" header={t("distribution.fac.insured", "Original insured")} />
          <Column header={t("distribution.fl.period", "Period")} body={(r) => `${date(r.periodFrom)} to ${date(r.periodTo)}`} />
          <Column header={t("distribution.fac.share", "Share offered")} body={(r) => `${num(r.facSharePct, 2)}%`} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fac.facPremium", "Facultative premium")} body={(r) => money(r.facPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fac.placed", "Placed")} body={(r) => `${num(r.placedPct, 2)}%`} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={t("distribution.fac.new", "New slip")} visible={!!form} style={{ width: "min(860px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setForm(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={create}
          disabled={!form?.cedantId || !form?.insuredName || !form?.riskDescription || !form?.sumInsured || !form?.grossPremium || !form?.facSharePct} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("distribution.fac.cedant", "Cedant")}><Dropdown value={form.cedantId} options={insurers} filter onChange={(e) => set({ cedantId: e.value })} /></Field>
            <Field label={t("distribution.fac.originalPolicy", "Original policy number")}><InputText value={form.cedantPolicyNumber} onChange={(e) => set({ cedantPolicyNumber: e.target.value })} /></Field>
            <Field label={t("distribution.fac.insured", "Original insured")}><InputText value={form.insuredName} onChange={(e) => set({ insuredName: e.target.value })} /></Field>
            <Field label={t("distribution.fac.class", "Class")}><InputText value={form.lineOfBusiness} onChange={(e) => set({ lineOfBusiness: e.target.value })} /></Field>
            <Field label={t("distribution.fac.risk", "Risk")} full><InputTextarea rows={2} value={form.riskDescription} onChange={(e) => set({ riskDescription: e.target.value })} /></Field>
            <Field label={t("distribution.fac.location", "Location")} full><InputText value={form.riskLocation} onChange={(e) => set({ riskLocation: e.target.value })} /></Field>
            <Field label={t("distribution.fl.from", "Period from")}><Calendar value={form.periodFrom} dateFormat="yy-mm-dd" showIcon onChange={(e) => set({ periodFrom: e.value })} /></Field>
            <Field label={t("distribution.fl.to", "Period to")}><Calendar value={form.periodTo} dateFormat="yy-mm-dd" showIcon onChange={(e) => set({ periodTo: e.value })} /></Field>
            <Field label={t("distribution.fac.si100", "Sum insured (100%)")}><InputNumber value={form.sumInsured} min={0} onValueChange={(e) => set({ sumInsured: e.value })} /></Field>
            <Field label={t("distribution.fac.premium100", "Premium (100%)")}><InputNumber value={form.grossPremium} min={0} maxFractionDigits={2} onValueChange={(e) => set({ grossPremium: e.value })} /></Field>
            <Field label={t("distribution.fac.share", "Share offered")}><InputNumber value={form.facSharePct} min={0} max={100} maxFractionDigits={4} suffix="%" onValueChange={(e) => set({ facSharePct: e.value })} /></Field>
            <Field label={t("distribution.fac.cedingPct", "Reinsurance commission %")} help={t("distribution.fac.defaultHelp", "Empty: the default of the Configuration")}>
              <InputNumber value={form.cedingCommissionPct} min={0} max={99} maxFractionDigits={2} onValueChange={(e) => set({ cedingCommissionPct: e.value ?? undefined })} />
            </Field>
            <Field label={t("distribution.fac.brokeragePct", "Brokerage %")} help={t("distribution.fac.defaultHelp", "Empty: the default of the Configuration")}>
              <InputNumber value={form.brokeragePct} min={0} max={99} maxFractionDigits={2} onValueChange={(e) => set({ brokeragePct: e.value ?? undefined })} />
            </Field>
            <Field label={t("distribution.fac.currency", "Currency")}><InputText value={form.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} /></Field>
            <Field label={t("distribution.fac.deductibles", "Deductibles")} full><InputText value={form.deductibles} onChange={(e) => set({ deductibles: e.target.value })} /></Field>
            <Field label={t("distribution.fac.conditions", "Conditions")} full><InputTextarea rows={2} value={form.conditions} onChange={(e) => set({ conditions: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("distribution.fac.bordereau", "Bordereau")} visible={!!bdx} style={{ width: "min(620px, 96vw)" }} onHide={() => setBdx(null)}
        footer={bdx ? (
          <div>
            <Button label="Excel" icon="pi pi-file-excel" outlined onClick={() => bordereau("xlsx")} />
            <Button label="PDF" icon="pi pi-file-pdf" outlined onClick={() => bordereau("pdf")} />
            {write ? <Button label={t("distribution.fac.keep", "Generate and keep (month of From)")} icon="pi pi-save" disabled={!bdx.reinsurerId} onClick={keepBordereau} /> : null}
          </div>
        ) : null}>
        {bdx && (
          <div className="dist-grid">
            <Field label={t("distribution.fl.from", "Period from")}><Calendar value={bdx.from} dateFormat="yy-mm-dd" showIcon onChange={(e) => setBdx({ ...bdx, from: e.value })} /></Field>
            <Field label={t("distribution.fl.to", "Period to")}><Calendar value={bdx.to} dateFormat="yy-mm-dd" showIcon onChange={(e) => setBdx({ ...bdx, to: e.value })} /></Field>
            <Field label={t("distribution.fac.reinsurer", "Reinsurer")} full><Dropdown value={bdx.reinsurerId} options={reinsurers} filter showClear onChange={(e) => setBdx({ ...bdx, reinsurerId: e.value || null })} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

const SlipDetail = ({ id }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:reinsurance");
  const [p, setP] = useState(null);
  const [reinsurers, setReinsurers] = useState([]);
  const [line, setLine] = useState(null);
  const [settle, setSettle] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setP(await service.facPlacement(id));
    } catch (e) {
      showError(toast, e);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { service.reinsurers().then((r) => setReinsurers(r.map((x) => ({ value: x.id, label: `${x.name} (${x.rating || "NR"})`, disabled: x.meetsMinimumRating === false })))).catch(() => setReinsurers([])); }, []);
  const run = async (fn, reload = true) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r?.message) showSuccess(toast, r.message);
      if (reload) await load();
      return r;
    } catch (e) {
      showError(toast, e);
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (!p) return <div className="pe-page"><Toast ref={toast} /></div>;
  const editable = ["draft", "in-market", "placed"].includes(p.status);
  const bound = ["bound", "closed"].includes(p.status);
  const doc = (kind, shareId) => run(() => service.facDocument(p.id, kind, shareId), false);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.reinsurance", "Reinsurance")} section={t("distribution.fac.title", "Facultative Placements")} title={`${p.slipNumber} · ${p.insuredName}`}
        subtitle={`${p.cedantName}${p.cedantPolicyNumber ? ` · ${p.cedantPolicyNumber}` : ""} · ${date(p.periodFrom)} to ${date(p.periodTo)}`}>
        <Button label={t("distribution.common.back", "Back")} icon="pi pi-arrow-left" text onClick={() => navigate(BASE)} />
        <Button label={t("distribution.fac.slipPdf", "Slip")} icon="pi pi-file-pdf" outlined onClick={() => doc("slip")} />
        {bound ? <Button label={t("distribution.fac.coverNote", "Cover note")} icon="pi pi-file-pdf" outlined onClick={() => doc("cover-note")} /> : null}
        {bound ? <Button label={t("distribution.fac.debitNote", "Debit note")} icon="pi pi-file-pdf" outlined onClick={() => doc("debit-note")} /> : null}
        {write && ["draft", "in-market"].includes(p.status) ? <Button label={t("distribution.fac.send", "Send to market")} icon="pi pi-send" disabled={busy}
          onClick={async () => { const email = await confirmAction(t("distribution.fac.emailToo", "Also e-mail the slip to each reinsurer approached?")); run(() => service.sendFacPlacement(p.id, email)); }} /> : null}
        {write && p.status === "placed" ? <Button label={t("distribution.fac.bind", "Bind")} icon="pi pi-check" disabled={busy}
          onClick={async () => { if (await confirmAction(t("distribution.fac.confirmBind", "Bind the slip and book the premium due from the cedant and to the reinsurers?"))) run(() => service.bindFacPlacement(p.id)); }} /> : null}
        {write && editable ? <Button label={t("distribution.fac.cancel", "Cancel slip")} icon="pi pi-times" severity="danger" outlined
          onClick={async () => { const reason = await promptText(t("distribution.fac.cancelReason", "Why is the slip cancelled?")); if (reason) run(() => service.cancelFacPlacement(p.id, reason)); }} /> : null}
      </PageHeader>
      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.common.status", "Status")}</div><div className="pe-kpi-value"><StatusTag status={p.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.fac.facPremium", "Facultative premium")}</div><div className="pe-kpi-value">{money(p.facPremium)}</div>
          <div className="pe-muted text-sm">{`${num(p.facSharePct, 2)}% ${t("distribution.fac.of", "of")} ${money(p.grossPremium)}`}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.fac.dueFromCedant", "Due from the cedant")}</div><div className="pe-kpi-value">{money(p.dueFromCedant)}</div>
          <div className="pe-muted text-sm">{t("distribution.fac.received", "Received")} {money(p.received)}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.fac.brokerage", "Brokerage")}</div><div className="pe-kpi-value">{money(p.brokerage)}</div>
          <div className="pe-muted text-sm">{`${num(p.brokeragePct, 2)}% · ${t("distribution.fac.ceding", "reinsurance commission")} ${num(p.cedingCommissionPct, 2)}%`}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.fac.placed", "Placed")}</div><div className="pe-kpi-value">{num(p.placedPct, 2)}%</div></div>
      </div>
      <div className="pe-card">
        <div className="pe-card-title">
          <span>{t("distribution.fac.lines", "Security (reinsurers' lines)")}</span>
          {write && editable ? <Button label={t("distribution.fac.addLine", "Add reinsurer")} icon="pi pi-plus" size="small" onClick={() => setLine({ reinsurerId: null, sharePct: 0, status: "approached", reinsurerReference: "" })} /> : null}
        </div>
        <DataTable value={p.shares} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.fac.noLines", "No reinsurer approached yet")}>
          <Column field="reinsurerName" header={t("distribution.fac.reinsurer", "Reinsurer")} />
          <Column field="rating" header={t("distribution.fac.rating", "Rating")} />
          <Column header={t("distribution.common.status", "Status")} body={(s) => <StatusTag status={s.status} />} />
          <Column header={t("distribution.fac.line", "Line % of share")} body={(s) => `${num(s.sharePct, 4)}%`} className="bv-num" headerClassName="bv-num" />
          <Column field="reinsurerReference" header={t("distribution.fac.reference", "Reference")} />
          <Column header={t("distribution.fl.premium", "Premium")} body={(s) => (bound ? money(s.premium) : "")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fac.net", "Net due")} body={(s) => (bound ? money(s.netPremium) : "")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fac.paid", "Paid")} body={(s) => (bound ? money(s.paidAmount) : "")} className="bv-num" headerClassName="bv-num" />
          <Column body={(s) => (
            <div className="dist-actions">
              {write && editable ? <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => setLine({ ...s, reinsurerReference: s.reinsurerReference || "" })} /> : null}
              {write && editable ? <Button icon="pi pi-trash" text size="small" severity="danger" aria-label={t("distribution.common.delete", "Delete")} onClick={() => run(() => service.removeFacShare(p.id, s.id))} /> : null}
              {bound && s.status === "accepted" ? <Button icon="pi pi-file-pdf" text size="small" tooltip={t("distribution.fac.creditNote", "Credit note")} aria-label={t("distribution.fac.creditNote", "Credit note")} onClick={() => doc("credit-note", s.id)} /> : null}
              {write && p.status === "bound" && s.status === "accepted" && s.outstanding > 0 ? <Button icon="pi pi-money-bill" text size="small" tooltip={t("distribution.fac.pay", "Record payment")}
                aria-label={t("distribution.fac.pay", "Record payment")} onClick={() => setSettle({ direction: "paid", shareId: s.id, amount: s.outstanding, settledOn: new Date(), reference: "", bankAccount: "" })} /> : null}
            </div>
          )} />
        </DataTable>
      </div>
      <div className="pe-card">
        <div className="pe-card-title">
          <span>{t("distribution.fac.settlements", "Settlements")}</span>
          {write && p.status === "bound" && p.dueFromCedant - p.received > 0.005 ? <Button label={t("distribution.fac.receive", "Record premium received")} icon="pi pi-plus" size="small"
            onClick={() => setSettle({ direction: "received", shareId: null, amount: Math.round((p.dueFromCedant - p.received) * 100) / 100, settledOn: new Date(), reference: "", bankAccount: "" })} /> : null}
        </div>
        <DataTable value={p.settlements} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column header={t("distribution.fac.date", "Date")} body={(s) => date(s.settledOn)} />
          <Column header={t("distribution.fac.direction", "Direction")} body={(s) => (s.direction === "received" ? t("distribution.fac.fromCedant", "Received from the cedant") : `${t("distribution.fac.toReinsurer", "Paid to")} ${s.reinsurerName}`)} />
          <Column header={t("distribution.fac.amount", "Amount")} body={(s) => money(s.amount)} className="bv-num" headerClassName="bv-num" />
          <Column field="reference" header={t("distribution.fac.reference", "Reference")} />
          <Column field="journalNumber" header={t("distribution.fac.journal", "Journal")} />
          <Column header={t("distribution.fac.recorded", "Recorded")} body={(s) => dateTime(s.createdAt)} />
        </DataTable>
        {p.journalNumber ? <p className="pe-muted">{t("distribution.fac.bindJournal", "Binding journal")}: {p.journalNumber}</p> : null}
      </div>

      <Dialog className="pe-dialog" header={line?.id ? t("distribution.fac.editLine", "Reinsurer's line") : t("distribution.fac.addLine", "Add reinsurer")} visible={!!line} style={{ width: "min(560px, 96vw)" }} onHide={() => setLine(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setLine(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save"
          onClick={async () => { const r = await run(() => service.saveFacShare(p.id, { reinsurerId: line.reinsurerId, sharePct: line.sharePct || 0, status: line.status, reinsurerReference: line.reinsurerReference || null })); if (r) setLine(null); }}
          disabled={!line?.reinsurerId} /></div>}>
        {line && (
          <div className="dist-grid">
            <Field label={t("distribution.fac.reinsurer", "Reinsurer")} full help={t("distribution.fac.ratingHelp", "Reinsurers below the minimum security rating cannot be chosen")}>
              <Dropdown value={line.reinsurerId} options={reinsurers} filter disabled={!!line.id} optionDisabled="disabled" onChange={(e) => setLine({ ...line, reinsurerId: e.value })} />
            </Field>
            <Field label={t("distribution.common.status", "Status")}>
              <Dropdown value={line.status} options={SHARE_STATUSES.map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} onChange={(e) => setLine({ ...line, status: e.value })} />
            </Field>
            <Field label={t("distribution.fac.line", "Line % of share")}><InputNumber value={line.sharePct} min={0} max={100} maxFractionDigits={4} suffix="%" onValueChange={(e) => setLine({ ...line, sharePct: e.value })} /></Field>
            <Field label={t("distribution.fac.reference", "Reference")} full><InputText value={line.reinsurerReference} onChange={(e) => setLine({ ...line, reinsurerReference: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={settle?.direction === "received" ? t("distribution.fac.receive", "Record premium received") : t("distribution.fac.pay", "Record payment")} visible={!!settle}
        style={{ width: "min(560px, 96vw)" }} onHide={() => setSettle(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setSettle(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" loading={busy}
          onClick={async () => { const r = await run(() => service.facSettlement(p.id, { ...settle, settledOn: isoDay(settle.settledOn), reference: settle.reference || null, bankAccount: settle.bankAccount || null })); if (r) setSettle(null); }} /></div>}>
        {settle && (
          <div className="dist-grid">
            <Field label={t("distribution.fac.amount", "Amount")}><InputNumber value={settle.amount} min={0} maxFractionDigits={2} onValueChange={(e) => setSettle({ ...settle, amount: e.value })} /></Field>
            <Field label={t("distribution.fac.date", "Date")}><Calendar value={settle.settledOn} dateFormat="yy-mm-dd" showIcon onChange={(e) => setSettle({ ...settle, settledOn: e.value })} /></Field>
            <Field label={t("distribution.fac.reference", "Reference")}><InputText value={settle.reference} onChange={(e) => setSettle({ ...settle, reference: e.target.value })} /></Field>
            <Field label={t("distribution.fac.bankAccount", "Bank account code")} help={t("distribution.fac.bankHelp", "Empty: the cash account of bank transfers")}>
              <InputText value={settle.bankAccount} onChange={(e) => setSettle({ ...settle, bankAccount: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default FacultativePlacements;
