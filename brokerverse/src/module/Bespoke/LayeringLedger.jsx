import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { RadioButton } from "primereact/radiobutton";
import { SelectButton } from "primereact/selectbutton";
import { Calendar } from "primereact/calendar";
import { TabView, TabPanel } from "primereact/tabview";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import bespokeService from "../../services/bespokeService";
import placementService from "../../services/placementService";
import { BespokeTag, PageHeader, amount, formatDate, percent } from "./shared";
import { layerProblems, layerShareTotal, nextLayer } from "./layerMath";
import { isoDate } from "../Placement/dates";
import "../Placement/index.scss";
import "./index.scss";

/** Layers editor: one card per layer with its participants. */
const LayersEditor = ({ value, onChange, insurers, disabled }) => {
  const { t } = useTranslation();
  const setLayer = (i, patch) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setPart = (i, k, patch) => setLayer(i, { participants: value[i].participants.map((p, j) => (j === k ? { ...p, ...patch } : patch.isLead ? { ...p, isLead: false } : p)) });
  const options = insurers.map((x) => ({ label: x.name, value: x.id }));
  return (
    <div>
      {value.map((l, i) => {
        const total = layerShareTotal(l);
        return (
          <div key={i} className="layer-card">
            <div className="grid align-items-end">
              <div className="col-12 md:col-3">
                <label htmlFor={`ly-name-${i}`}>{t("bespoke.layers.layer", { no: i + 1 })}</label>
                <InputText id={`ly-name-${i}`} value={l.name || ""} onChange={(e) => setLayer(i, { name: e.target.value })} className="w-full" disabled={disabled} />
              </div>
              <div className="col-12 md:col-3">
                <label htmlFor={`ly-att-${i}`}>{t("bespoke.layers.attachment")}</label>
                <InputNumber inputId={`ly-att-${i}`} value={l.attachmentPoint} onValueChange={(e) => setLayer(i, { attachmentPoint: e.value })} className="w-full" disabled={disabled} />
              </div>
              <div className="col-12 md:col-3">
                <label htmlFor={`ly-lim-${i}`}>{t("bespoke.layers.limit")}</label>
                <InputNumber inputId={`ly-lim-${i}`} value={l.limit} onValueChange={(e) => setLayer(i, { limit: e.value })} className="w-full" disabled={disabled} />
              </div>
              <div className="col-10 md:col-2">
                <label htmlFor={`ly-prem-${i}`}>{t("bespoke.layers.premium")}</label>
                <InputNumber inputId={`ly-prem-${i}`} value={l.premium} onValueChange={(e) => setLayer(i, { premium: e.value })} minFractionDigits={2} maxFractionDigits={2} className="w-full" disabled={disabled} />
              </div>
              <div className="col-2 md:col-1">
                {!disabled && <Button icon="pi pi-trash" text rounded severity="secondary" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t("bespoke.actions.remove")} />}
              </div>
            </div>
            <table className="participant-table">
              <thead>
                <tr>
                  <th>{t("bespoke.room.insurer")}</th><th className="num">{t("bespoke.layers.share")}</th><th className="center">{t("bespoke.layers.lead")}</th>
                  <th className="num">{t("bespoke.layers.commissionRate")}</th><th className="num">{t("bespoke.layers.premiumShare")}</th><th className="num">{t("bespoke.layers.taxes")}</th>
                  <th className="num">{t("bespoke.layers.commission")}</th><th className="num">{t("bespoke.layers.netDue")}</th><th />
                </tr>
              </thead>
              <tbody>
                {l.participants.map((p, k) => (
                  <tr key={k} className={p.isLead ? "lead-row" : ""}>
                    <td style={{ minWidth: "14rem" }}><Dropdown value={p.insuranceCompanyId} options={options} onChange={(e) => setPart(i, k, { insuranceCompanyId: e.value })} filter className="w-full" disabled={disabled} aria-label={t("bespoke.room.insurer")} /></td>
                    <td className="num" style={{ width: "8rem" }}><InputNumber value={p.sharePercent} onValueChange={(e) => setPart(i, k, { sharePercent: e.value })} suffix="%" maxFractionDigits={4} inputClassName="w-full text-right" disabled={disabled} aria-label={t("bespoke.layers.share")} /></td>
                    <td className="center"><RadioButton checked={!!p.isLead} onChange={() => setPart(i, k, { isLead: true })} disabled={disabled} aria-label={t("bespoke.layers.lead")} /></td>
                    <td className="num" style={{ width: "7rem" }}><InputNumber value={p.commissionRate === null || p.commissionRate === undefined ? null : Math.round(p.commissionRate * 10000) / 100} onValueChange={(e) => setPart(i, k, { commissionRate: e.value === null ? null : e.value / 100 })}
                      suffix="%" maxFractionDigits={2} inputClassName="w-full text-right" disabled={disabled} placeholder={t("bespoke.layers.defaultRate")} aria-label={t("bespoke.layers.commissionRate")} /></td>
                    <td className="num">{amount(p.premium)}</td><td className="num">{amount(p.taxes)}</td><td className="num">{amount(p.commissionAmount)}</td><td className="num">{amount(p.netDue)}</td>
                    <td>{!disabled && <Button icon="pi pi-times" text rounded severity="secondary" onClick={() => setLayer(i, { participants: l.participants.filter((_, j) => j !== k) })} aria-label={t("bespoke.actions.remove")} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-content-between align-items-center">
              {!disabled && <Button label={t("bespoke.layers.addParticipant")} icon="pi pi-plus" text size="small"
                onClick={() => setLayer(i, { participants: [...l.participants, { insuranceCompanyId: null, sharePercent: Math.max(0, Math.round((100 - total) * 10000) / 10000), isLead: false, commissionRate: null }] })} />}
              <span className={Math.abs(total - 100) < 0.0001 ? "ok" : "problem"}>{t("bespoke.layers.shareTotal", { total })}</span>
            </div>
          </div>
        );
      })}
      {!disabled && <Button label={t("bespoke.layers.addLayer")} icon="pi pi-plus" outlined onClick={() => onChange([...value, nextLayer(value)])} />}
    </div>
  );
};

const RemittanceTab = ({ type, id, onError }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [rec, setRec] = useState(null);
  const load = useCallback(() => bespokeService.layerRemittance(type, id).then(setData).catch(onError), [type, id, onError]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;
  return (
    <div className="placement-card">
      {!data.issued && <p className="muted">{t("bespoke.layers.notIssued")}</p>}
      <DataTable value={data.insurers} dataKey="insuranceCompanyId" size="small" stripedRows>
        <Column field="insuranceCompanyName" header={t("bespoke.room.insurer")} />
        <Column header={t("bespoke.layers.share")} body={(r) => percent(r.sharePercent)} className="num" />
        <Column header={t("bespoke.layers.gross")} body={(r) => amount(r.premiumTotal)} className="num" />
        <Column header={t("bespoke.layers.commission")} body={(r) => amount(r.commissionAmount)} className="num" />
        <Column header={t("bespoke.layers.netDue")} body={(r) => amount(r.netDue)} className="num" />
        <Column header={t("bespoke.layers.remitted")} body={(r) => amount(r.remitted)} className="num" />
        <Column header={t("bespoke.layers.outstanding")} body={(r) => amount(r.outstanding)} className="num" />
        <Column header={t("bespoke.layers.lastReconciliation")} body={(r) => (r.lastReconciliation ? <><BespokeTag status={r.lastReconciliation.status} /> {amount(r.lastReconciliation.difference)}</> : "-")} />
        <Column body={(r) => <Button label={t("bespoke.layers.reconcile")} size="small" text onClick={() => setRec({ insuranceCompanyId: r.insuranceCompanyId, name: r.insuranceCompanyName, layerNo: null, statementRef: "", statementAmount: null, note: "" })} />} />
      </DataTable>
      <div className="section-title">{t("bespoke.layers.perLayer")}</div>
      <DataTable value={data.rows} size="small" stripedRows>
        <Column field="insuranceCompanyName" header={t("bespoke.room.insurer")} />
        <Column header={t("bespoke.layers.layerCol")} body={(r) => `${r.layerNo} ${r.layerName}`} />
        <Column header={t("bespoke.layers.netDue")} body={(r) => amount(r.netDue)} className="num" />
        <Column header={t("bespoke.layers.remitted")} body={(r) => amount(r.remitted)} className="num" />
        <Column header={t("bespoke.layers.outstanding")} body={(r) => amount(r.outstanding)} className="num" />
      </DataTable>
      {data.reconciliations.length > 0 && (
        <>
          <div className="section-title">{t("bespoke.layers.reconciliations")}</div>
          <DataTable value={data.reconciliations} size="small" dataKey="id">
            <Column header={t("bespoke.room.insurer")} body={(r) => data.insurers.find((i) => i.insuranceCompanyId === r.insuranceCompanyId)?.insuranceCompanyName} />
            <Column header={t("bespoke.layers.layerCol")} body={(r) => r.layerNo || t("bespoke.layers.allLayers")} />
            <Column field="statementRef" header={t("bespoke.layers.statementRef")} />
            <Column header={t("bespoke.layers.statementAmount")} body={(r) => amount(r.statementAmount)} className="num" />
            <Column header={t("bespoke.layers.remitted")} body={(r) => amount(r.remittedAmount)} className="num" />
            <Column header={t("bespoke.layers.difference")} body={(r) => amount(r.difference)} className="num" />
            <Column header={t("bespoke.fields.status")} body={(r) => <BespokeTag status={r.status} />} />
            <Column header={t("bespoke.fields.updated")} body={(r) => `${r.reconciledBy || ""} ${formatDate(r.reconciledAt)}`} />
          </DataTable>
        </>
      )}
      <Dialog header={`${t("bespoke.layers.reconcile")} ${rec?.name || ""}`} visible={!!rec} style={{ width: "min(560px, 96vw)" }} onHide={() => setRec(null)} className="placement-dialog"
        footer={<Button label={t("bespoke.layers.reconcile")} icon="pi pi-check" disabled={rec?.statementAmount === null} onClick={async () => {
          try { await bespokeService.reconcileParticipant(type, id, rec); setRec(null); load(); } catch (e) { onError(e); }
        }} />}>
        {rec && (
          <div className="grid">
            <div className="col-12 md:col-6">
              <label htmlFor="rc-ref">{t("bespoke.layers.statementRef")}</label>
              <InputText id="rc-ref" value={rec.statementRef} onChange={(e) => setRec({ ...rec, statementRef: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="rc-amt">{t("bespoke.layers.statementAmount")}</label>
              <InputNumber inputId="rc-amt" value={rec.statementAmount} onValueChange={(e) => setRec({ ...rec, statementAmount: e.value })} minFractionDigits={2} maxFractionDigits={2} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="rc-layer">{t("bespoke.layers.layerCol")}</label>
              <Dropdown inputId="rc-layer" value={rec.layerNo} options={[{ label: t("bespoke.layers.allLayers"), value: null }, ...[...new Set(data.rows.filter((r) => r.insuranceCompanyId === rec.insuranceCompanyId).map((r) => r.layerNo))].map((n) => ({ label: String(n), value: n }))]}
                onChange={(e) => setRec({ ...rec, layerNo: e.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="rc-note">{t("bespoke.fields.changeNote")}</label>
              <InputText id="rc-note" value={rec.note} onChange={(e) => setRec({ ...rec, note: e.target.value })} className="w-full" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

/** Claim split per layer and participant, with reserve / payment / recovery entry. */
export const ClaimSplitPanel = ({ onError }) => {
  const { t } = useTranslation();
  const [claimRef, setClaimRef] = useState("");
  const [split, setSplit] = useState(null);
  const [entry, setEntry] = useState({ kind: "reserve", amount: null, date: null, reference: "", insuranceCompanyId: null, layerNo: null });
  const load = async (ref = claimRef) => { try { setSplit(await bespokeService.claimSplit(ref.trim())); } catch (e) { onError(e); } };
  const save = async () => {
    try {
      const body = { amount: entry.amount, date: isoDate(entry.date), reference: entry.reference || undefined };
      const s = entry.kind === "recovery"
        ? await bespokeService.claimRecovery(split.claim.id, { ...body, insuranceCompanyId: entry.insuranceCompanyId, layerNo: entry.layerNo || undefined })
        : await bespokeService.claimMovement(split.claim.id, { ...body, kind: entry.kind });
      setSplit(s);
      setEntry({ ...entry, amount: null, reference: "" });
    } catch (e) {
      onError(e);
    }
  };
  return (
    <div className="placement-card">
      <div className="flex gap-2 align-items-center">
        <InputText value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder={t("bespoke.layers.claimNumber")} onKeyDown={(e) => e.key === "Enter" && load()} />
        <Button label={t("bespoke.layers.openClaim")} icon="pi pi-search" onClick={() => load()} disabled={!claimRef.trim()} />
      </div>
      {split && (
        <>
          <p className="muted">{split.claim.claimNumber} | {split.claim.policyNumber} | {split.claim.insured} | {formatDate(split.claim.lossDate)} | {t(`bespoke.layers.source_${split.source}`)}</p>
          <div className="kpi-row">
            {["reserve", "paid", "incurred", "recovered"].map((k) => <div key={k} className="kpi-card"><span className="kpi-value">{amount(split.totals[k])}</span><span className="kpi-label">{t(`bespoke.layers.${k}`)}</span></div>)}
          </div>
          {split.layers.map((l) => (
            <div key={l.layerNo} className="layer-card">
              <strong>{l.layerNo}. {l.name}</strong> <span className="muted small">{amount(l.attachmentPoint)} + {amount(l.limit)} | {t("bespoke.layers.incurred")} {amount(l.incurred)} | {t("bespoke.layers.paid")} {amount(l.paid)}</span>
              <DataTable value={l.participants} size="small" dataKey="insuranceCompanyId">
                <Column field="insuranceCompanyName" header={t("bespoke.room.insurer")} />
                <Column header={t("bespoke.layers.share")} body={(p) => percent(p.sharePercent)} className="num" />
                <Column header={t("bespoke.layers.reserve")} body={(p) => amount(p.reserve)} className="num" />
                <Column header={t("bespoke.layers.paid")} body={(p) => amount(p.paid)} className="num" />
                <Column header={t("bespoke.layers.recovered")} body={(p) => amount(p.recovered)} className="num" />
                <Column header={t("bespoke.layers.outstanding")} body={(p) => amount(p.outstandingRecovery)} className="num" />
              </DataTable>
            </div>
          ))}
          <div className="section-title">{t("bespoke.layers.newMovement")}</div>
          <div className="grid align-items-end">
            <div className="col-12 md:col-4">
              <SelectButton value={entry.kind} options={["reserve", "payment", "recovery"].map((k) => ({ label: t(`bespoke.layers.kind_${k}`), value: k }))} onChange={(e) => e.value && setEntry({ ...entry, kind: e.value })} />
            </div>
            <div className="col-6 md:col-2"><InputNumber value={entry.amount} onValueChange={(e) => setEntry({ ...entry, amount: e.value })} minFractionDigits={2} maxFractionDigits={2} placeholder={t("bespoke.layers.amount")} className="w-full" /></div>
            <div className="col-6 md:col-2"><Calendar value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.value })} dateFormat="yy-mm-dd" placeholder={t("bespoke.layers.date")} className="w-full" /></div>
            {entry.kind === "recovery" && (
              <div className="col-12 md:col-2">
                <Dropdown value={entry.insuranceCompanyId} options={split.insurers.map((i) => ({ label: i.insuranceCompanyName, value: i.insuranceCompanyId }))} onChange={(e) => setEntry({ ...entry, insuranceCompanyId: e.value })} placeholder={t("bespoke.room.insurer")} className="w-full" />
              </div>
            )}
            <div className="col-6 md:col-1"><InputText value={entry.reference} onChange={(e) => setEntry({ ...entry, reference: e.target.value })} placeholder={t("bespoke.layers.reference")} className="w-full" /></div>
            <div className="col-6 md:col-1"><Button label={t("bespoke.actions.save")} onClick={save} disabled={entry.amount === null || (entry.kind === "recovery" && !entry.insuranceCompanyId)} /></div>
          </div>
          <DataTable value={split.movements} size="small" dataKey="id">
            <Column header={t("bespoke.layers.date")} body={(m) => formatDate(m.date)} />
            <Column header={t("bespoke.layers.kind")} body={(m) => t(`bespoke.layers.kind_${m.kind}`)} />
            <Column header={t("bespoke.layers.amount")} body={(m) => amount(m.amount)} className="num" />
            <Column field="insurer" header={t("bespoke.room.insurer")} />
            <Column field="reference" header={t("bespoke.layers.reference")} />
            <Column field="createdBy" header={t("bespoke.fields.changedBy")} />
          </DataTable>
        </>
      )}
    </div>
  );
};

const RecoveriesReport = ({ onError }) => {
  const { t } = useTranslation();
  const [insurerId, setInsurerId] = useState(null);
  const [insurers, setInsurers] = useState([]);
  const [data, setData] = useState(null);
  useEffect(() => { placementService.options().then((o) => setInsurers(o.insurers || [])).catch(() => {}); }, []);
  const load = useCallback(() => bespokeService.outstandingRecoveries({ insurerId: insurerId || undefined }).then(setData).catch(onError), [insurerId, onError]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="placement-card">
      <div className="flex gap-2 align-items-center mb-2">
        <Dropdown value={insurerId} options={[{ label: t("bespoke.layers.allInsurers"), value: null }, ...insurers.map((i) => ({ label: i.name, value: i.id }))]} onChange={(e) => setInsurerId(e.value)} filter />
        <Button label={t("bespoke.layers.download")} icon="pi pi-download" outlined onClick={() => bespokeService.downloadRecoveries({ insurerId: insurerId || undefined }).catch(onError)} />
      </div>
      {data && (
        <>
          <DataTable value={data.totals} size="small" dataKey="insuranceCompanyId">
            <Column field="insurer" header={t("bespoke.room.insurer")} />
            <Column field="claims" header={t("bespoke.layers.claims")} className="num" />
            <Column header={t("bespoke.layers.paid")} body={(r) => amount(r.paid)} className="num" />
            <Column header={t("bespoke.layers.recovered")} body={(r) => amount(r.recovered)} className="num" />
            <Column header={t("bespoke.layers.outstanding")} body={(r) => amount(r.outstanding)} className="num" />
          </DataTable>
          <div className="section-title">{t("bespoke.layers.byClaim")}</div>
          <DataTable value={data.rows} size="small" paginator rows={20}>
            <Column field="insurer" header={t("bespoke.room.insurer")} />
            <Column field="claimNumber" header={t("bespoke.layers.claimNumber")} />
            <Column field="policyNumber" header={t("bespoke.layers.policy")} />
            <Column header={t("bespoke.layers.layerCol")} body={(r) => `${r.layerNo} ${r.layerName}`} />
            <Column header={t("bespoke.layers.paid")} body={(r) => amount(r.paid)} className="num" />
            <Column header={t("bespoke.layers.recovered")} body={(r) => amount(r.recovered)} className="num" />
            <Column header={t("bespoke.layers.outstanding")} body={(r) => amount(r.outstanding)} className="num" />
            <Column field="daysSinceLastPayment" header={t("bespoke.layers.days")} className="num" />
          </DataTable>
        </>
      )}
    </div>
  );
};

/** Operations > Placement > Layering & Co-insurance. */
const LayeringLedger = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { type, id } = useParams();
  const toast = useRef(null);
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState({ type: "placement", ref: "" });
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [saving, setSaving] = useState(false);
  const fail = useCallback((e) => toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 6000 }), [t]);

  useEffect(() => { placementService.options().then((o) => setInsurers(o.insurers || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (type) return undefined;
    const h = setTimeout(() => bespokeService.listLayered({ search: search || undefined }).then(setList).catch(fail), 250);
    return () => clearTimeout(h);
  }, [type, search, fail]);
  const load = useCallback(async () => {
    if (!type) return;
    try {
      const d = await bespokeService.getLayers(type, id);
      setData(d);
      setDraft(d.layers.map((l) => ({ ...l, participants: l.participants.map((p) => ({ ...p })) })));
    } catch (e) {
      fail(e);
    }
  }, [type, id, fail]);
  useEffect(() => { load(); }, [load]);
  const problems = useMemo(() => (data ? layerProblems(draft, { netPremium: data.entity.premium }) : []), [draft, data]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await bespokeService.saveLayers(type, data.entity.id, draft.map((l) => ({ name: l.name, limit: l.limit, attachmentPoint: l.attachmentPoint, premium: l.premium,
        participants: l.participants.map((p) => ({ insuranceCompanyId: p.insuranceCompanyId, sharePercent: p.sharePercent, isLead: !!p.isLead, commissionRate: p.commissionRate })) })));
      toast.current?.show({ severity: "success", summary: t("bespoke.layers.saved"), detail: (r.warnings || []).join(" "), life: 5000 });
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  if (!type) {
    return (
      <div className="placement-page bespoke-page">
        <Toast ref={toast} />
        <PageHeader title={t("bespoke.layers.title")} subtitle={t("bespoke.layers.subtitle")} />
        <TabView>
          <TabPanel header={t("bespoke.layers.risksTab")}>
            <div className="placement-card">
              <div className="toolbar">
                <span className="p-input-icon-left search"><i className="pi pi-search" /><InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("bespoke.layers.search")} /></span>
                <Dropdown value={open.type} options={[{ label: t("bespoke.layers.placement"), value: "placement" }, { label: t("bespoke.layers.policy"), value: "policy" }]} onChange={(e) => setOpen({ ...open, type: e.value })} />
                <InputText value={open.ref} onChange={(e) => setOpen({ ...open, ref: e.target.value })} placeholder={t("bespoke.layers.numberHint")} />
                <Button label={t("bespoke.layers.open")} icon="pi pi-arrow-right" disabled={!open.ref.trim()} onClick={() => navigate(`/placement/bespoke/layering/${open.type}/${encodeURIComponent(open.ref.trim())}`)} />
              </div>
              <DataTable value={list} size="small" stripedRows className="placement-grid" emptyMessage={t("bespoke.layers.empty")} onRowClick={(e) => navigate(`/placement/bespoke/layering/${e.data.entityType}/${e.data.entityId}`)} rowClassName={() => "clickable"}>
                <Column field="number" header={t("bespoke.fields.number")} body={(r) => <span className="doc-number">{r.number}</span>} />
                <Column field="insured" header={t("bespoke.fields.insured")} />
                <Column header={t("bespoke.layers.kind")} body={(r) => t(`bespoke.layers.${r.entityType}`)} />
                <Column field="layers" header={t("bespoke.layers.layers")} className="num" />
                <Column field="insurers" header={t("bespoke.room.insurers")} className="num" />
                <Column header={t("bespoke.layers.topLimit")} body={(r) => amount(r.topLimit)} className="num" />
                <Column header={t("bespoke.layers.premium")} body={(r) => amount(r.premium)} className="num" />
              </DataTable>
            </div>
          </TabPanel>
          <TabPanel header={t("bespoke.layers.claimsTab")}><ClaimSplitPanel onError={fail} /></TabPanel>
          <TabPanel header={t("bespoke.layers.recoveriesTab")}><RecoveriesReport onError={fail} /></TabPanel>
        </TabView>
      </div>
    );
  }
  if (!data) return <div className="placement-page"><Toast ref={toast} /></div>;
  const e = data.entity;
  return (
    <div className="placement-page bespoke-page">
      <Toast ref={toast} />
      <PageHeader title={`${e.number} ${e.insured || ""}`} subtitle={`${t(`bespoke.layers.${e.type}`)} | ${e.currency} ${amount(e.sumInsured)} | ${t("bespoke.layers.netPremium")} ${amount(e.premium)} | ${t(`bespoke.layers.source_${data.source}`)}`}
        onBack={() => navigate("/placement/bespoke/layering")}>
        <BespokeTag status={e.status} />
        {e.editable && <Button label={t("bespoke.actions.save")} icon="pi pi-save" loading={saving} disabled={problems.length > 0} onClick={save} />}
      </PageHeader>
      <TabView>
        <TabPanel header={t("bespoke.layers.layersTab")}>
          <div className="placement-card">
            {!e.editable && <p className="muted">{t("bespoke.layers.readOnly")}</p>}
            <LayersEditor value={draft} onChange={setDraft} insurers={insurers} disabled={!e.editable} />
            {problems.map((p) => <div key={p} className="problem">{p}</div>)}
          </div>
          <div className="placement-card">
            <div className="section-title mt-0">{t("bespoke.layers.consolidated")}</div>
            <DataTable value={data.participants} size="small" dataKey="insuranceCompanyId">
              <Column field="insuranceCompanyName" header={t("bespoke.room.insurer")} />
              <Column header={t("bespoke.layers.blendedShare")} body={(r) => percent(r.sharePercent)} className="num" />
              <Column header={t("bespoke.layers.layers")} body={(r) => r.layers.map((l) => `${l.layerNo}: ${percent(l.sharePercent)}${l.isLead ? " *" : ""}`).join(", ")} />
              <Column header={t("bespoke.layers.premiumShare")} body={(r) => amount(r.premium)} className="num" />
              <Column header={t("bespoke.layers.taxes")} body={(r) => amount(r.taxes)} className="num" />
              <Column header={t("bespoke.layers.commission")} body={(r) => amount(r.commissionAmount)} className="num" />
              <Column header={t("bespoke.layers.netDue")} body={(r) => amount(r.netDue)} className="num" />
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header={t("bespoke.layers.remittanceTab")}><RemittanceTab type={type} id={data.entity.id} onError={fail} /></TabPanel>
      </TabView>
    </div>
  );
};

export default LayeringLedger;
