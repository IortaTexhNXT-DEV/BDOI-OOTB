import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/creditControlService";
import { promptText } from "../../utility/dialogs";
import { CcTag, PageHeader, bucketLabels, date, isoOf, money, showError, showSuccess } from "./common";

const toDate = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);
const sum = (rows) => Math.round(rows.reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100;

/**
 * Accounts > Credit Control > Instalment Plans: the payment schedule of a broker-billed premium bill (generated from the
 * terms, then editable), what was paid on each instalment, and the ageing of outstanding instalments across plans.
 */
const InstalmentPlans = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [policyRef, setPolicyRef] = useState("");
  const [data, setData] = useState(null);
  const [terms, setTerms] = useState(null);
  const [draft, setDraft] = useState(null); // edited instalments [{ dueDate, amount }]
  const [ageing, setAgeing] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(true);

  const loadAgeing = useCallback(async () => {
    try {
      setAgeing(await service.instalmentAgeing({ overdueOnly: overdueOnly ? "true" : undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, [overdueOnly]);
  useEffect(() => { loadAgeing(); }, [loadAgeing]);

  const load = async (ref = policyRef) => {
    if (!ref.trim()) return;
    try {
      const d = await service.plans(ref.trim());
      setData(d);
      const active = d.plans.find((p) => p.status === "active" && p.receivableId === d.proposal.receivableId);
      setTerms({ receivableId: d.proposal.receivableId, frequency: active?.frequency && d.frequencies[active.frequency] ? active.frequency : d.proposal.frequency,
        count: active?.instalmentCount || d.proposal.count, firstDueDate: toDate(active?.firstDueDate || d.proposal.firstDueDate), downPayment: active?.downPayment || 0 });
      setDraft((active?.instalments || d.proposal.instalments).map((i) => ({ dueDate: toDate(i.dueDate), amount: i.amount })));
    } catch (e) {
      setData(null);
      showError(toast, e);
    }
  };

  const generate = async () => {
    try {
      const rows = await service.previewPlan(data.policyId, { receivableId: terms.receivableId, frequency: terms.frequency, count: terms.count, firstDueDate: isoOf(terms.firstDueDate), downPayment: terms.downPayment || 0 });
      setDraft(rows.map((i) => ({ dueDate: toDate(i.dueDate), amount: i.amount })));
    } catch (e) {
      showError(toast, e);
    }
  };
  const save = async () => {
    try {
      await service.savePlan(data.policyId, { receivableId: terms.receivableId, frequency: terms.frequency, downPayment: terms.downPayment || 0,
        instalments: draft.map((i) => ({ dueDate: isoOf(i.dueDate), amount: Number(i.amount) })) });
      showSuccess(toast, t("creditControl.planSaved"));
      await load(data.policyId);
      loadAgeing();
    } catch (e) {
      showError(toast, e);
    }
  };
  const cancelPlan = async (plan) => {
    const reason = await promptText(t("creditControl.cancelPlanReason"));
    if (reason === null) return;
    try {
      await service.cancelPlan(plan.id, reason);
      showSuccess(toast, t("creditControl.planCancelled"));
      await load(data.policyId);
      loadAgeing();
    } catch (e) {
      showError(toast, e);
    }
  };

  const bill = data?.bills.find((b) => b.id === terms?.receivableId);
  const setLine = (i, patch) => setDraft((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const labels = bucketLabels(ageing?.bucketDays, t);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("creditControl.instalmentPlans")} trail={[t("creditControl.instalmentPlans")]} />
      <div className="pe-card mb-3">
        <div className="flex gap-2 mb-3">
          <InputText value={policyRef} onChange={(e) => setPolicyRef(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={t("creditControl.policyNumber")} className="w-20rem" />
          <Button icon="pi pi-search" label={t("creditControl.open")} onClick={() => load()} />
        </div>
        {data && terms && (
          <>
            <div className="mb-2"><b>{data.policyNumber}</b> · {data.clientName} · {t("creditControl.inception")} {date(data.inceptionDate)}</div>
            <div className="grid">
              <div className="col-12 md:col-3"><label>{t("creditControl.bill")}</label>
                <Dropdown value={terms.receivableId} options={data.bills.map((b) => ({ label: `${b.billNumber} · ${money(b.amount)} (${t("creditControl.balance")} ${money(b.balance)})`, value: b.id }))}
                  onChange={(e) => setTerms({ ...terms, receivableId: e.value })} className="w-full" /></div>
              <div className="col-6 md:col-2"><label>{t("creditControl.frequency")}</label>
                <Dropdown value={terms.frequency} options={Object.keys(data.frequencies).map((f) => ({ label: t(`creditControl.freq.${f}`, { defaultValue: f }), value: f }))}
                  onChange={(e) => setTerms({ ...terms, frequency: e.value })} className="w-full" /></div>
              <div className="col-6 md:col-2"><label>{t("creditControl.count")}</label>
                <InputNumber value={terms.count} min={1} max={data.maxInstalments} showButtons onValueChange={(e) => setTerms({ ...terms, count: e.value })} className="w-full" /></div>
              <div className="col-6 md:col-2"><label>{t("creditControl.firstDueDate")}</label>
                <Calendar value={terms.firstDueDate} onChange={(e) => setTerms({ ...terms, firstDueDate: e.value })} showIcon className="w-full" /></div>
              <div className="col-6 md:col-2"><label>{t("creditControl.downPayment")}</label>
                <InputNumber value={terms.downPayment} mode="decimal" minFractionDigits={2} min={0} onValueChange={(e) => setTerms({ ...terms, downPayment: e.value })} className="w-full" /></div>
              <div className="col-12 md:col-1 flex align-items-end"><Button icon="pi pi-refresh" tooltip={t("creditControl.generate")} onClick={generate} aria-label={t("creditControl.generate")} /></div>
            </div>
            <DataTable value={draft.map((d, i) => ({ ...d, seq: i + 1 }))} dataKey="seq" size="small" className="mt-2"
              footer={t("creditControl.scheduleTotal", { total: money(sum(draft)), bill: money(bill?.amount) })}>
              <Column field="seq" header="#" />
              <Column header={t("creditControl.dueDate")} body={(r) => <Calendar value={r.dueDate} onChange={(e) => setLine(r.seq - 1, { dueDate: e.value })} showIcon />} />
              <Column header={t("creditControl.amount")} body={(r) => <InputNumber value={r.amount} mode="decimal" minFractionDigits={2} maxFractionDigits={2} onValueChange={(e) => setLine(r.seq - 1, { amount: e.value })} />} />
              <Column body={(r) => <Button icon="pi pi-trash" text size="small" disabled={draft.length < 2} onClick={() => setDraft((d) => d.filter((_, k) => k !== r.seq - 1))} aria-label="Delete" tooltip="Delete" tooltipOptions={{ position: "top" }} />} />
            </DataTable>
            <div className="flex gap-2 mt-2">
              <Button icon="pi pi-plus" label={t("creditControl.addInstalment")} outlined onClick={() => setDraft((d) => [...d, { dueDate: d.at(-1)?.dueDate || null, amount: 0 }])} />
              <Button icon="pi pi-save" label={t("creditControl.savePlan")} onClick={save} disabled={!bill || Math.abs(sum(draft) - Number(bill.amount)) > 0.005} />
            </div>
            {data.plans.map((p) => (
              <div key={p.id} className="mt-4">
                <div className="flex align-items-center gap-2 mb-1">
                  <b>{p.billNumber}</b><CcTag status={p.status} /><span className="pe-muted">{t(`creditControl.freq.${p.frequency}`, { defaultValue: p.frequency })} · {p.instalmentCount}</span>
                  {p.status === "active" && <Button label={t("creditControl.cancelPlan")} text size="small" onClick={() => cancelPlan(p)} />}
                </div>
                <DataTable value={p.instalments} dataKey="seq" size="small" stripedRows>
                  <Column field="seq" header="#" />
                  <Column header={t("creditControl.dueDate")} body={(r) => date(r.dueDate)} />
                  <Column header={t("creditControl.amount")} body={(r) => money(r.amount)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("creditControl.paid")} body={(r) => money(r.paid)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("creditControl.outstanding")} body={(r) => money(r.outstanding)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("creditControl.daysPastDue")} field="daysPastDue" className="bv-num" headerClassName="bv-num" />
                  <Column header={t("creditControl.statusLabel")} body={(r) => <CcTag status={r.status} />} />
                </DataTable>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="pe-card">
        <div className="flex align-items-center justify-content-between mb-2">
          <h3 className="m-0">{t("creditControl.instalmentAgeing")}</h3>
          <span className="flex align-items-center gap-2"><Checkbox inputId="cc-overdue" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.checked)} /><label htmlFor="cc-overdue">{t("creditControl.overdueOnly")}</label></span>
        </div>
        {ageing && (
          <div className="flex flex-wrap gap-4 mb-2">
            {["current", "b1", "b2", "b3", "b4"].map((k) => <span key={k}>{labels[k]}: <b>{money(ageing.summary[k])}</b></span>)}
            <span>{t("creditControl.total")}: <b>{money(ageing.summary.outstanding)}</b></span>
          </div>
        )}
        <DataTable value={(ageing?.rows || []).map((r) => ({ ...r, key: `${r.planId}-${r.seq}` }))} dataKey="key" size="small" stripedRows paginator rows={20} emptyMessage={t("creditControl.none")}
          onRowClick={(e) => { setPolicyRef(e.data.policyNumber); load(e.data.policyNumber); }} rowHover>
          <Column field="policyNumber" header={t("creditControl.policyNumber")} />
          <Column field="clientName" header={t("creditControl.client")} />
          <Column header="#" body={(r) => `${r.seq}/${r.instalmentCount}`} />
          <Column header={t("creditControl.dueDate")} body={(r) => date(r.dueDate)} />
          <Column header={t("creditControl.outstanding")} body={(r) => money(r.outstanding)} className="bv-num" headerClassName="bv-num" />
          <Column field="daysPastDue" header={t("creditControl.daysPastDue")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("creditControl.bucket")} body={(r) => labels[r.bucket]} />
        </DataTable>
      </div>
    </div>
  );
};

export default InstalmentPlans;
