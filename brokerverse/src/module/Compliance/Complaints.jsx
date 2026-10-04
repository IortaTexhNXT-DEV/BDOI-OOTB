import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { Toast } from "primereact/toast";
import complianceService, { errorMessage } from "../../services/complianceService";
import { FormDialog, History, PageHeader, StateTag, Stats, asOptions, fromIsoDay, isoDay, showDate } from "./icCommon";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./ic.scss";

const OPEN = ["received", "acknowledged", "in-progress", "escalated"];
const EMPTY = { receivedAt: null, channel: null, complainantName: "", complainantContact: "", complainantType: "client", policyId: "", claimId: "", category: null,
  complexity: "simple", subject: "", description: "", amountDisputed: null, assignedTo: null, documents: [] };

/**
 * Compliance > Insurance Commission > Complaints: complaints of clients and claimants under RA 11765 with their
 * acknowledgement and resolution deadlines (settings), assignment, escalation, response letters, ageing and the report
 * for the regulator.
 */
const Complaints = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const letterMenu = useRef(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [options, setOptions] = useState({ channels: [], categories: [], complainantTypes: [], outcomes: [], assignees: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ quick: "open", category: null, search: "" });
  const [form, setForm] = useState(null);
  const [step, setStep] = useState(null);
  const [letterFor, setLetterFor] = useState(null);
  const [report, setReport] = useState({ from: `${new Date().getFullYear()}-01-01`, to: isoDay(new Date()) });
  const [saving, setSaving] = useState(false);
  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.failed")) });

  const load = useCallback(async () => {
    setLoading(true);
    const q = { category: filters.category, search: filters.search };
    if (filters.quick === "open") q.status = OPEN.join(",");
    if (filters.quick === "overdue") q.overdue = "true";
    if (filters.quick === "escalated") q.status = "escalated";
    try {
      const r = await complianceService.complaints(q);
      setRows(r.items);
      setSummary(r.summary || {});
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { complianceService.complaintOptions().then(setOptions).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    const { id } = form;
    const body = Object.fromEntries(Object.entries(form).filter(([k, v]) => k !== "id" && k !== "actions" && v !== "" && v !== undefined && v !== null));
    try {
      const r = id ? await complianceService.updateComplaint(id, body) : await complianceService.createComplaint(body);
      toast.current?.show({ severity: "success", summary: r.message });
      setForm(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const runStep = async (row, action, body = {}) => {
    setSaving(true);
    try {
      const r = await complianceService.complaintAction(row.id, action, body);
      toast.current?.show({ severity: "success", summary: r.message });
      setStep(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const openEdit = (r) => setForm({ id: r.id, channel: r.channel, complainantName: r.complainantName, complainantContact: r.complainantContact || "", complainantType: r.complainantType,
    category: r.category, complexity: r.complexity, subject: r.subject, description: r.description || "", amountDisputed: r.amountDisputed, assignedTo: r.assignedTo, documents: r.documents || [], actions: r.actions });

  const stepFields = {
    escalate: [{ name: "reason", label: t("compliance.cmp.reason"), type: "textarea", wide: true, required: true }],
    reopen: [{ name: "reason", label: t("compliance.cmp.reason"), type: "textarea", wide: true, required: true }],
    resolve: [
      { name: "outcome", label: t("compliance.cmp.outcome"), type: "dropdown", required: true, options: asOptions(options.outcomes, t, "compliance.cmp.outcomes") },
      { name: "redressAmount", label: t("compliance.cmp.redress"), type: "money" },
      { name: "resolution", label: t("compliance.cmp.resolution"), type: "textarea", wide: true, required: true, rows: 5 },
    ],
    refer: [{ name: "regulatorReference", label: t("compliance.cmp.regulatorReference"), required: true }, { name: "referredOn", label: t("compliance.cmp.referredOn"), type: "date" }],
  };
  const stepValid = step && (step.action === "resolve" ? step.form.outcome && step.form.resolution : step.action === "refer" ? step.form.regulatorReference : step.form.reason);

  const actions = (r) => {
    const open = OPEN.includes(r.status);
    return (
      <div className="compliance__row-actions">
        {open ? <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("compliance.edit")} tooltip={t("compliance.edit")} onClick={() => openEdit(r)} /> : null}
        {r.status === "received" ? <Button label={t("compliance.cmp.acknowledge")} text size="small" onClick={() => runStep(r, "acknowledge")} /> : null}
        {open ? <Button label={t("compliance.cmp.resolve")} text size="small" onClick={() => setStep({ row: r, action: "resolve", form: { outcome: null, resolution: "", redressAmount: null } })} /> : null}
        {open && r.status !== "escalated" ? <Button label={t("compliance.cmp.escalate")} text size="small" severity="danger" onClick={() => setStep({ row: r, action: "escalate", form: { reason: "" } })} /> : null}
        {r.status === "resolved" ? <Button label={t("compliance.cmp.close")} text size="small" onClick={() => runStep(r, "close")} /> : null}
        {["resolved", "closed"].includes(r.status) ? <Button label={t("compliance.cmp.reopen")} text size="small" onClick={() => setStep({ row: r, action: "reopen", form: { reason: "" } })} /> : null}
        {!r.referredToRegulator ? <Button label={t("compliance.cmp.refer")} text size="small" onClick={() => setStep({ row: r, action: "refer", form: { regulatorReference: "", referredOn: null } })} /> : null}
        <Button icon="pi pi-print" text rounded size="small" aria-label={t("compliance.cmp.letters")} tooltip={t("compliance.cmp.letters")} onClick={(e) => { setLetterFor(r); letterMenu.current?.toggle(e); }} />
      </div>
    );
  };
  const letterItems = [
    { label: t("compliance.cmp.ackLetter"), icon: "pi pi-file-pdf", command: () => letterFor && complianceService.complaintLetter(letterFor.id, "acknowledgement").catch(fail) },
    { label: t("compliance.cmp.resolutionLetter"), icon: "pi pi-file-pdf", command: () => letterFor && complianceService.complaintLetter(letterFor.id, "resolution").catch(fail) },
  ];

  const fields = form ? [
    { name: "receivedAt", label: t("compliance.cmp.receivedOn"), type: "date", hidden: !!form.id },
    { name: "channel", label: t("compliance.cmp.channel"), type: "dropdown", required: true, options: asOptions(options.channels) },
    { name: "complainantName", label: t("compliance.cmp.complainant"), required: true },
    { name: "complainantContact", label: t("compliance.cmp.contact") },
    { name: "complainantType", label: t("compliance.cmp.complainantType"), type: "dropdown", options: asOptions(options.complainantTypes, t, "compliance.cmp.types") },
    { name: "policyId", label: t("compliance.cmp.policy"), hidden: !!form.id, help: t("compliance.cmp.policyHelp") },
    { name: "claimId", label: t("compliance.cmp.claim"), hidden: !!form.id },
    { name: "category", label: t("compliance.cmp.category"), type: "dropdown", required: true, options: asOptions(options.categories) },
    { name: "complexity", label: t("compliance.cmp.complexity"), type: "dropdown", required: true, options: asOptions(["simple", "complex"], t, "compliance.cmp.complexities") },
    { name: "amountDisputed", label: t("compliance.cmp.amountDisputed"), type: "money" },
    { name: "assignedTo", label: t("compliance.cmp.assignedTo"), type: "dropdown", options: options.assignees.map((u) => ({ value: u.id, label: u.name })) },
    { name: "subject", label: t("compliance.cmp.subject"), required: true, wide: true },
    { name: "description", label: t("compliance.cmp.description"), type: "textarea", wide: true, rows: 4 },
    { name: "documents", label: t("compliance.documents"), type: "documents", wide: true },
  ] : [];
  const formValid = form && form.channel && form.category && form.complainantName.trim().length >= 2 && form.subject.trim().length >= 3;

  return (
    <div className="admin__page access__page compliance__page">
      <Toast ref={toast} />
      <Menu model={letterItems} popup ref={letterMenu} />
      <PageHeader section={t("compliance.ic")} title={t("compliance.cmp.title")} intro={t("compliance.cmp.intro")}
        actions={<Button icon="pi pi-plus" label={t("compliance.cmp.log")} onClick={() => setForm({ ...EMPTY })} />} />
      <Stats loading={loading} selected={filters.quick} onSelect={(quick) => setFilters((f) => ({ ...f, quick: quick || "all" }))} items={[
        { key: "open", label: t("compliance.cmp.statOpen"), value: summary.open },
        { key: "overdue", label: t("compliance.cmp.statOverdue"), value: (summary.ackOverdue || 0) + (summary.resolutionOverdue || 0) },
        { key: "escalated", label: t("compliance.state.escalated"), value: summary.escalated },
      ]} />
      <div className="admin__filters">
        <Dropdown value={filters.category} options={asOptions(options.categories)} showClear placeholder={t("compliance.cmp.category")} onChange={(e) => setFilters((f) => ({ ...f, category: e.value || null }))} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("compliance.search")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
        <span className="access__muted">{t("compliance.cmp.report")}</span>
        <Calendar value={fromIsoDay(report.from)} dateFormat="dd/mm/yy" aria-label={t("compliance.from")} onChange={(e) => e.value && setReport((p) => ({ ...p, from: isoDay(e.value) }))} />
        <Calendar value={fromIsoDay(report.to)} dateFormat="dd/mm/yy" aria-label={t("compliance.to")} onChange={(e) => e.value && setReport((p) => ({ ...p, to: isoDay(e.value) }))} />
        <Button icon="pi pi-file-excel" label={t("compliance.cmp.regulatorReport")} outlined onClick={() => complianceService.exportRegulatorReport(report).catch(fail)} />
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("compliance.cmp.none")}>
        <Column header={t("compliance.cmp.reference")} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.complaintNumber}</span>
            <span className="access__muted">{`${showDate(r.receivedOn)} · ${r.channel}`}</span>
          </div>
        )} />
        <Column header={t("compliance.cmp.complainant")} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.complainantName}</span>
            <span className="access__muted">{[r.policyNumber, r.claimNumber].filter(Boolean).join(" · ")}</span>
          </div>
        )} />
        <Column header={t("compliance.cmp.subject")} body={(r) => (
          <div className="access__user">
            <span>{r.subject}</span>
            <span className="access__muted">{`${r.category} · ${t(`compliance.cmp.complexities.${r.complexity}`)}`}</span>
          </div>
        )} />
        <Column header={t("compliance.colState")} body={(r) => <StateTag value={r.status} />} />
        <Column header={t("compliance.cmp.ackBy")} body={(r) => <span className={r.ackOverdue ? "p-error" : ""}>{r.acknowledgedAt ? t("compliance.cmp.done") : showDate(r.ackDueOn)}</span>} />
        <Column header={t("compliance.cmp.resolveBy")} body={(r) => <span className={r.resolutionOverdue ? "p-error" : ""}>{showDate(r.resolutionDueOn)}</span>} />
        <Column field="ageDays" header={t("compliance.cmp.age")} sortable />
        <Column field="assignedToName" header={t("compliance.cmp.assignedTo")} />
        <Column header="" body={actions} />
      </DataTable>

      <FormDialog header={form?.id ? t("compliance.cmp.edit") : t("compliance.cmp.log")} visible={!!form} fields={fields} form={form} setForm={setForm} onHide={() => setForm(null)}
        onSubmit={save} saving={saving} valid={!!formValid} width="60rem">
        {form?.id ? <History actions={form.actions} /> : null}
      </FormDialog>
      <FormDialog header={step ? `${t(`compliance.cmp.${step.action}`)}: ${step.row.complaintNumber}` : ""} visible={!!step} fields={step ? stepFields[step.action] : []}
        form={step?.form} setForm={(fn) => setStep((s) => ({ ...s, form: typeof fn === "function" ? fn(s.form) : fn }))} onHide={() => setStep(null)}
        onSubmit={() => runStep(step.row, step.action, Object.fromEntries(Object.entries(step.form).filter(([, v]) => v !== "" && v !== null)))} saving={saving} valid={!!stepValid}
        submitLabel={step ? t(`compliance.cmp.${step.action}`) : ""} />
    </div>
  );
};

export default Complaints;
