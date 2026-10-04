import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import complianceService, { errorMessage } from "../../services/complianceService";
import { FormDialog, History, PageHeader, StateTag, Stats, asOptions, showDateTime } from "./icCommon";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./ic.scss";

const EMPTY = { incidentType: "personal-data-breach", title: "", description: "", discoveredAt: null, occurredAt: null, reportedBy: "", nature: [], dataCategories: [],
  subjectsAffected: null, recordsAffected: null, systemsAffected: "", cause: "", containment: "", remediation: "", dpoUserId: null, documents: [] };

/** Hours left before the NPC deadline as a tag (red when passed or within a day). */
const Clock = ({ row }) => {
  const { t } = useTranslation();
  if (row.npcNotifiedAt) return <Tag value={row.notifiedLate ? t("compliance.br.notifiedLate") : t("compliance.br.notifiedOnTime")} severity={row.notifiedLate ? "warning" : "success"} />;
  if (row.hoursLeft === null || row.hoursLeft === undefined) return <span className="access__muted">{t("compliance.br.noClock")}</span>;
  if (row.hoursLeft < 0) return <Tag value={t("compliance.br.overdueBy", { h: -row.hoursLeft })} severity="danger" />;
  return <Tag value={t("compliance.br.hoursLeft", { h: row.hoursLeft })} severity={row.hoursLeft <= 24 ? "danger" : "warning"} />;
};

/**
 * Compliance > Data Privacy > Breach Register: security incidents and personal data breaches, their assessment against
 * the NPC criteria, the 72-hour notification to the National Privacy Commission, the notification of the data subjects
 * and the annual security incident report.
 */
const BreachRegister = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [options, setOptions] = useState({ incidentTypes: [], natures: [], dataCategories: [], team: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ quick: null, search: "" });
  const [form, setForm] = useState(null);
  const [step, setStep] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.failed")) });

  const load = useCallback(async () => {
    setLoading(true);
    const q = { search: filters.search };
    if (filters.quick === "pending") q.pendingNpc = "true";
    if (filters.quick === "open") q.status = "open,assessed,notified";
    try {
      const r = await complianceService.breaches(q);
      setRows(r.items);
      setSummary(r.summary || {});
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { complianceService.breachOptions().then(setOptions).catch(() => {}); }, []);

  const clean = (o, drop = []) => Object.fromEntries(Object.entries(o).filter(([k, v]) => !drop.includes(k) && v !== "" && v !== null && v !== undefined));
  const save = async () => {
    setSaving(true);
    try {
      const body = clean(form, ["id", "actions", "incidentTypeLocked"]);
      const r = form.id ? await complianceService.updateBreach(form.id, clean(body, ["incidentType", "discoveredAt"])) : await complianceService.createBreach(body);
      toast.current?.show({ severity: "success", summary: r.message });
      setForm(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const runStep = async () => {
    setSaving(true);
    try {
      const r = await complianceService.breachAction(step.row.id, step.action, clean(step.form));
      toast.current?.show({ severity: "success", summary: r.message });
      setStep(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const openEdit = (r) => setForm({ id: r.id, incidentType: r.incidentType, title: r.title, description: r.description || "", occurredAt: r.occurredAt, reportedBy: r.reportedBy || "",
    nature: r.nature, dataCategories: r.dataCategories, subjectsAffected: r.subjectsAffected, recordsAffected: r.recordsAffected, systemsAffected: r.systemsAffected || "", cause: r.cause || "",
    containment: r.containment || "", remediation: r.remediation || "", dpoUserId: r.dpoUserId, documents: r.documents || [], actions: r.actions });

  const yesNo = (name, label) => ({ name, label, type: "switch" });
  const stepFields = {
    assess: [
      yesNo("sensitiveData", t("compliance.br.sensitiveData")), yesNo("identityFraudRisk", t("compliance.br.identityFraudRisk")),
      yesNo("unauthorisedAcquisition", t("compliance.br.unauthorisedAcquisition")), yesNo("realRiskOfHarm", t("compliance.br.realRiskOfHarm")),
      { name: "notifiable", label: t("compliance.br.decision"), type: "dropdown", options: [{ value: true, label: t("compliance.br.notifiable") }, { value: false, label: t("compliance.br.notNotifiable") }],
        help: t("compliance.br.decisionHelp") },
      { name: "overrideReason", label: t("compliance.br.overrideReason"), type: "textarea" },
      { name: "notes", label: t("compliance.br.assessmentNotes"), type: "textarea", wide: true },
    ],
    "notify-npc": [
      { name: "notifiedAt", label: t("compliance.br.notifiedAt"), type: "datetime" }, { name: "reference", label: t("compliance.br.npcReference"), required: true },
      { name: "method", label: t("compliance.br.method") }, { name: "delayReason", label: t("compliance.br.delayReason"), type: "textarea", wide: true },
    ],
    "notify-subjects": [
      { name: "notifiedAt", label: t("compliance.br.notifiedAt"), type: "datetime" }, { name: "count", label: t("compliance.br.subjectsNotified"), type: "number" },
      { name: "method", label: t("compliance.br.method") }, { name: "notNotifiedReason", label: t("compliance.br.notNotifiedReason"), type: "textarea", wide: true },
    ],
    close: [{ name: "notes", label: t("compliance.br.closureNotes"), type: "textarea", wide: true, required: true }],
  };
  const stepValid = step && (step.action === "notify-npc" ? step.form.reference : step.action === "close" ? step.form.notes : true);

  const fields = form ? [
    { name: "incidentType", label: t("compliance.br.type"), type: "dropdown", required: true, disabled: !!form.id, options: asOptions(options.incidentTypes, t, "compliance.br.types") },
    { name: "discoveredAt", label: t("compliance.br.discoveredAt"), type: "datetime", hidden: !!form.id, help: t("compliance.br.discoveredHelp") },
    { name: "title", label: t("compliance.br.titleField"), required: true, wide: true },
    { name: "description", label: t("compliance.br.description"), type: "textarea", wide: true },
    { name: "occurredAt", label: t("compliance.br.occurredAt"), type: "datetime" },
    { name: "reportedBy", label: t("compliance.br.reportedBy") },
    { name: "nature", label: t("compliance.br.nature"), type: "multiselect", options: asOptions(options.natures, t, "compliance.br.natures") },
    { name: "dataCategories", label: t("compliance.br.dataCategories"), type: "multiselect", options: asOptions(options.dataCategories) },
    { name: "subjectsAffected", label: t("compliance.br.subjectsAffected"), type: "number" },
    { name: "recordsAffected", label: t("compliance.br.recordsAffected"), type: "number" },
    { name: "systemsAffected", label: t("compliance.br.systems") },
    { name: "dpoUserId", label: t("compliance.br.dpo"), type: "dropdown", options: options.team.map((u) => ({ value: u.id, label: u.name })) },
    { name: "cause", label: t("compliance.br.cause"), type: "textarea" },
    { name: "containment", label: t("compliance.br.containment"), type: "textarea" },
    { name: "remediation", label: t("compliance.br.remediation"), type: "textarea", wide: true },
    { name: "documents", label: t("compliance.documents"), type: "documents", wide: true },
  ] : [];

  const actions = (r) => (r.status === "closed" ? null : (
    <div className="compliance__row-actions">
      <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("compliance.edit")} tooltip={t("compliance.edit")} onClick={() => openEdit(r)} />
      <Button label={t("compliance.br.assess")} text size="small" onClick={() => setStep({ row: r, action: "assess", form: { sensitiveData: r.sensitiveData, identityFraudRisk: r.identityFraudRisk,
        unauthorisedAcquisition: r.unauthorisedAcquisition, realRiskOfHarm: r.realRiskOfHarm, notifiable: null, overrideReason: "", notes: r.assessmentNotes || "" } })} />
      {r.assessedAt && r.notifiable && !r.npcNotifiedAt ? <Button label={t("compliance.br.notifyNpc")} text size="small" severity="danger" onClick={() => setStep({ row: r, action: "notify-npc", form: { notifiedAt: new Date().toISOString(), reference: "", method: "", delayReason: "" } })} /> : null}
      {r.incidentType === "personal-data-breach" ? <Button label={t("compliance.br.notifySubjects")} text size="small" onClick={() => setStep({ row: r, action: "notify-subjects", form: { notifiedAt: new Date().toISOString(), count: r.subjectsAffected, method: "", notNotifiedReason: "" } })} /> : null}
      <Button label={t("compliance.br.close")} text size="small" onClick={() => setStep({ row: r, action: "close", form: { notes: "" } })} />
    </div>
  ));

  return (
    <div className="admin__page access__page compliance__page">
      <Toast ref={toast} />
      <PageHeader section={t("compliance.npc")} title={t("compliance.br.title")} intro={t("compliance.br.intro")}
        actions={(
          <>
            <InputNumber value={year} onValueChange={(e) => e.value && setYear(e.value)} useGrouping={false} min={2000} max={2100} showButtons aria-label={t("compliance.br.year")} />
            <Button icon="pi pi-file-excel" label={t("compliance.br.annualReport")} outlined onClick={() => complianceService.exportBreachAnnualReport(year).catch(fail)} />
            <Button icon="pi pi-plus" label={t("compliance.br.log")} onClick={() => setForm({ ...EMPTY, discoveredAt: new Date().toISOString() })} />
          </>
        )} />
      <Stats loading={loading} selected={filters.quick} onSelect={(quick) => setFilters((f) => ({ ...f, quick }))} items={[
        { key: "open", label: t("compliance.br.statOpen"), value: summary.open },
        { key: "pending", label: t("compliance.br.statPending"), value: summary.pendingNpc },
        { key: "overdue", label: t("compliance.br.statOverdue"), value: summary.npcOverdue },
      ]} />
      <div className="admin__filters">
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("compliance.search")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
      </div>
      <DataTable value={filters.quick === "overdue" ? rows.filter((r) => r.npcOverdue) : rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("compliance.br.none")}>
        <Column header={t("compliance.br.reference")} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.breachNumber}</span>
            <span className="access__muted">{t(`compliance.br.types.${r.incidentType}`)}</span>
          </div>
        )} />
        <Column field="title" header={t("compliance.br.titleField")} />
        <Column header={t("compliance.br.discoveredAt")} body={(r) => showDateTime(r.discoveredAt)} />
        <Column header={t("compliance.br.notifiableCol")} body={(r) => (r.assessedAt ? (r.notifiable ? t("compliance.br.notifiable") : t("compliance.br.notNotifiable")) : t("compliance.br.notAssessed"))} />
        <Column header={t("compliance.br.npcDeadline")} body={(r) => (r.incidentType === "personal-data-breach" ? showDateTime(r.npcDueAt) : "")} />
        <Column header={t("compliance.br.clock")} body={(r) => <Clock row={r} />} />
        <Column field="subjectsAffected" header={t("compliance.br.subjectsAffected")} />
        <Column header={t("compliance.colState")} body={(r) => <StateTag value={r.status} />} />
        <Column header="" body={actions} />
      </DataTable>

      <FormDialog header={form?.id ? t("compliance.br.edit") : t("compliance.br.log")} visible={!!form} fields={fields} form={form} setForm={setForm} onHide={() => setForm(null)}
        onSubmit={save} saving={saving} valid={!!form && form.title.trim().length >= 3} width="60rem">
        {form?.id ? <History actions={form.actions} /> : null}
      </FormDialog>
      <FormDialog header={step ? `${t(`compliance.br.step.${step.action}`)}: ${step.row.breachNumber}` : ""} visible={!!step} fields={step ? stepFields[step.action] : []}
        form={step?.form} setForm={(fn) => setStep((s) => ({ ...s, form: typeof fn === "function" ? fn(s.form) : fn }))} onHide={() => setStep(null)}
        onSubmit={runStep} saving={saving} valid={!!stepValid} submitLabel={step ? t(`compliance.br.step.${step.action}`) : ""} />
    </div>
  );
};

export default BreachRegister;
