import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Sidebar } from "primereact/sidebar";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import LoadingBar from "../../../components/LoadingBar";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import ConfirmDialog from "../../../components/ConfirmDialog/ConfirmDialog";
import ReasonDialog from "../../../components/ReasonDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { hasPermission } from "../../../utils/canOpen";
import remittanceService from "../../../services/remittanceService";
import authService from "../../../services/authService";
import { REMITTANCE_ROUTES, downloadCsv, formatDateTime, isoDate, money, useUrlState } from "../shared";
import "../remittance.scss";

const SEVERITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["Open", "In Progress", "Escalated", "Resolved"];
const RESOLUTION_TYPES = ["manual-adjustment", "write-off", "credit-note", "debit-note", "reverse"];
const SEVERITY_TONE = { Critical: "danger", High: "warning", Medium: "info", Low: "secondary" };
const STATUS_TONE = { Open: "warning", "In Progress": "info", Escalated: "danger", Resolved: "success" };
const OPEN = ["Open", "In Progress", "Escalated"];

/** Due date from the exception SLA ("24 hours", "2 days") counted from creation; null without an SLA. */
export const dueBy = (row) => {
  const match = /(\d+)\s*(hour|day)/i.exec(String(row?.sla || ""));
  if (!match || !row.createdAt) return null;
  const hours = Number(match[1]) * (/day/i.test(match[2]) ? 24 : 1);
  return new Date(new Date(row.createdAt).getTime() + hours * 3600000).toISOString();
};

/** What the signed-in user may do with an exception, first View. */
export const exceptionActions = (row, canWrite) => [
  { code: "view", allowed: true },
  { code: "start", allowed: canWrite && row.status === "Open" },
  { code: "escalate", allowed: canWrite && ["Open", "In Progress"].includes(row.status) },
  { code: "resolve", allowed: canWrite && OPEN.includes(row.status) },
].filter((a) => a.allowed);

const emptyResolution = { type: null, amount: null, note: "" };

/**
 * Accounts > Remittance > Exceptions (/finance/remittance/exceptions): the remittance exceptions with four neutral KPI
 * cards, the filters and a row menu (View, Start, Escalate…, Resolve…). View opens a 640px side panel. Escalate asks for a
 * reason of the Reason Codes master (context exception_escalate); Resolve for the resolution type, the amount and a
 * note. A read-only user sees "View only" and the View item only.
 */
const RemittanceExceptions = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const canWrite = hasPermission("write:remittance");
  const currentUser = authService.getUser()?.username || localStorage.getItem("USERNAME") || "";
  const [state, update] = useUrlState({});
  const [escalating, setEscalating] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [resolution, setResolution] = useState(emptyResolution);
  const [tried, setTried] = useState(false);
  const loader = useCallback(() => remittanceService.listExceptions({ perPage: 500 }), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const exceptions = useMemo(() => data || [], [data]);

  const filters = { type: state.type || "", severity: state.severity || "", status: state.status || "" };
  const visible = exceptions.filter((e) => (!filters.type || e.type === filters.type) && (!filters.severity || e.severity === filters.severity)
    && (!filters.status || e.status === filters.status));
  const selected = exceptions.find((e) => String(e.id) === String(state.exception) || e.exceptionId === state.exception) || null;

  const today = isoDate(new Date());
  const unresolved = exceptions.filter((e) => e.status !== "Resolved");
  const count = (status) => exceptions.filter((e) => e.status === status).length;
  const card = (key, value, note, status) => ({ key, label: t(`remittance.exceptions.kpis.${key}`), value: data ? value : null, note,
    active: filters.status === status, onClick: status ? () => update({ status: filters.status === status ? null : status }) : undefined });
  const cards = [
    card("unresolved", unresolved.length, money(unresolved.reduce((s, e) => s + Number(e.amount || 0), 0))),
    card("inProgress", count("In Progress"), " ", "In Progress"),
    card("escalated", count("Escalated"), " ", "Escalated"),
    card("resolvedToday", exceptions.filter((e) => e.status === "Resolved" && String(e.resolvedAt || "").startsWith(today)).length, " ", "Resolved"),
  ];

  const done = async (message) => {
    toast.current?.show({ severity: "success", summary: message, life: 3000 });
    await reload();
  };
  const start = async (row) => {
    try {
      await remittanceService.assignException(row.id, currentUser);
      await done(t("remittance.exceptions.started", { reference: row.exceptionId }));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message, life: 6000 });
    }
  };

  const exportRows = () => downloadCsv(`remittance_exceptions_${today}.csv`, visible, [
    { field: "exceptionId", header: "ID" }, { field: "severity", header: "Severity" }, { field: "type", header: "Type" }, { field: "remittanceNo", header: "Reference No" },
    { field: "amount", header: "Amount" }, { field: "age", header: "Age (days)" }, { field: "assignedTo", header: "Assigned To" }, { field: "status", header: "Status" },
    { field: "description", header: "Description" },
  ]);
  const overflow = [{ code: "export", label: t("remittance.exceptions.export"), allowed: true }];

  const headerActions = (
    <div className="rm-header-actions">
      {canWrite ? null : <StatusChip label={t("remittance.common.viewOnly")} severity="secondary" />}
      <RowActions label={t("remittance.common.moreActions")} actions={overflow} onAction={exportRows} />
    </div>
  );

  const onAction = (row) => (action) => {
    if (action.code === "view") update({ exception: row.exceptionId });
    if (action.code === "start") start(row);
    if (action.code === "escalate") setEscalating(row);
    if (action.code === "resolve") {
      setResolution(emptyResolution);
      setTried(false);
      setResolving(row);
    }
  };
  const actionLabel = (a) => t(`remittance.exceptions.actions.${a.code}`);

  const resolutionText = () => [t(`remittance.exceptions.resolutionTypes.${resolution.type}`), resolution.amount ? money(resolution.amount) : null, resolution.note.trim()]
    .filter(Boolean).join(" · ");
  const resolutionProblem = !resolution.type || !resolution.note.trim();

  const option = (values, all, prefix) => [{ label: t(all), value: "" }, ...values.map((v) => ({ label: prefix ? t(`${prefix}.${v}`, { defaultValue: v }) : v, value: v }))];
  const types = [...new Set(exceptions.map((e) => e.type).filter(Boolean))];

  const facts = (x) => [
    { label: t("remittance.exceptions.fields.type"), value: x.type },
    { label: t("remittance.exceptions.fields.severity"), value: <StatusChip label={x.severity} severity={SEVERITY_TONE[x.severity]} /> },
    { label: t("remittance.exceptions.fields.reference"), value: x.remittanceNo },
    { label: t("remittance.exceptions.fields.assignedTo"), value: x.assignedTo },
    { label: t("remittance.exceptions.fields.created"), value: x.createdAt, type: "datetime" },
    { label: t("remittance.exceptions.fields.dueBy"), value: dueBy(x), type: "datetime" },
    { label: t("remittance.exceptions.fields.expected"), value: money(x.amount) },
    { label: t("remittance.exceptions.fields.actual"), value: x.difference === null || x.difference === undefined ? null : money(Number(x.amount) - Number(x.difference)) },
    { label: t("remittance.exceptions.fields.difference"), value: x.difference === null || x.difference === undefined ? null : money(x.difference) },
    { label: t("remittance.exceptions.fields.age"), value: t("remittance.exceptions.days", { count: x.age || 0 }) },
    { label: t("remittance.exceptions.fields.description"), value: x.description, span: "full" },
    { label: t("remittance.exceptions.fields.escalation"), value: x.escalationReason, span: "full", hidden: !x.escalationReason },
    { label: t("remittance.exceptions.fields.resolution"), value: x.resolution, span: "full", hidden: !x.resolution },
  ];

  const panelActions = selected ? exceptionActions(selected, canWrite).filter((a) => a.code !== "view") : [];

  return (
    <div className="rm-page">
      <Toast ref={toast} />
      <PageHeader title={t("remittance.exceptions.title")} home={t("remittance.common.accounts")} section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
        trail={[t("remittance.exceptions.title")]} help={t("remittance.exceptions.help")} actions={headerActions} />
      <StatCards items={cards} />

      <div className="rm-filters">
        <Dropdown value={filters.type} options={option(types, "remittance.exceptions.filters.allTypes")} onChange={(e) => update({ type: e.value })} aria-label={t("remittance.exceptions.filters.type")} />
        <Dropdown value={filters.severity} options={option(SEVERITIES, "remittance.exceptions.filters.allSeverities")} onChange={(e) => update({ severity: e.value })}
          aria-label={t("remittance.exceptions.filters.severity")} />
        <Dropdown value={filters.status} options={option(STATUSES, "remittance.exceptions.filters.allStatuses")} onChange={(e) => update({ status: e.value })}
          aria-label={t("remittance.exceptions.filters.status")} />
      </div>

      {error ? (
        <div className="rm-inline-error" role="alert">
          <span>{t("remittance.exceptions.loadError")}</span>
          <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
        </div>
      ) : (
        <div className="rm-card bv-loading-host">
          <LoadingBar active={refreshing} />
          <DataTable value={visible} dataKey="id" size="small" scrollable className="rm-table" loading={loading && !data}
            emptyMessage={<div className="rm-empty">{t("remittance.exceptions.empty")}</div>}>
            <Column header={t("remittance.exceptions.fields.id")} frozen style={{ minWidth: "9rem" }}
              body={(x) => <Button type="button" link className="rm-ref rm-link" label={x.exceptionId} onClick={() => update({ exception: x.exceptionId })} />} />
            <Column header={t("remittance.exceptions.fields.severity")} body={(x) => <StatusChip label={x.severity} severity={SEVERITY_TONE[x.severity]} />} />
            <Column header={t("remittance.exceptions.fields.type")} body={(x) => x.type || "-"} />
            <Column header={t("remittance.exceptions.fields.reference")} body={(x) => (x.remittanceId ? <Link to={REMITTANCE_ROUTES.record(x.remittanceId)} className="rm-ref">{x.remittanceNo}</Link> : x.remittanceNo || "-")} />
            <Column header={t("remittance.exceptions.fields.amount")} align="right" body={(x) => <span className="rm-num">{money(x.amount)}</span>} />
            <Column header={t("remittance.exceptions.fields.age")} align="right" body={(x) => <span className="rm-num">{t("remittance.exceptions.days", { count: x.age || 0 })}</span>} />
            <Column header={t("remittance.exceptions.fields.assignedTo")} body={(x) => x.assignedTo || "-"} />
            <Column header={t("remittance.exceptions.fields.status")} style={{ minWidth: "8rem" }} body={(x) => <StatusChip label={x.status} severity={STATUS_TONE[x.status]} />} />
            <Column header={<span className="p-sr-only">{t("remittance.exceptions.fields.actions")}</span>} align="center" style={{ width: "3.5rem" }}
              body={(x) => <RowActions label={t("remittance.exceptions.actionsFor", { reference: x.exceptionId })} actions={exceptionActions(x, canWrite)} labelOf={actionLabel} onAction={onAction(x)} />} />
          </DataTable>
        </div>
      )}

      <Sidebar visible={!!selected} position="right" onHide={() => update({ exception: null })} blockScroll className="rm-review rm-payment" aria-label={t("remittance.exceptions.panel")}
        header={<span className="rm-review__title">{t("remittance.exceptions.panel")}</span>}>
        {selected ? (
          <>
            <div className="rm-review__body">
              <DetailHeader title={selected.exceptionId} status={{ code: selected.status, label: selected.status, severity: STATUS_TONE[selected.status] }} subtitle={selected.type} />
              <DetailSection title={t("remittance.exceptions.details")}><KeyValueGrid columns={2} items={facts(selected)} /></DetailSection>
              <p className="rm-review__line">{formatDateTime(selected.lastModified) ? t("remittance.exceptions.lastChange", { at: formatDateTime(selected.lastModified), by: selected.modifiedBy || "-" }) : null}</p>
            </div>
            {panelActions.length ? (
              <div className="rm-review__footer rm-payment__footer">
                {panelActions.map((a) => (
                  <Button key={a.code} type="button" label={actionLabel(a)} outlined={a.code !== "resolve"} onClick={() => onAction(selected)(a)} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </Sidebar>

      <ReasonDialog visible={!!escalating} onHide={(r) => { const row = escalating; setEscalating(null); if (r?.confirmed) done(t("remittance.exceptions.escalated", { reference: row.exceptionId })); }}
        context="exception_escalate" severity="warning" title={t("remittance.exceptions.escalateTitle", { reference: escalating?.exceptionId || "" })}
        facts={escalating ? [{ label: t("remittance.exceptions.fields.type"), value: escalating.type }, { label: t("remittance.exceptions.fields.amount"), value: escalating.amount, type: "amount" }] : []}
        confirmLabel={t("remittance.exceptions.actions.escalate")} onConfirm={(reason) => remittanceService.escalateException(escalating.id, reason)} />

      <ConfirmDialog visible={!!resolving} title={t("remittance.exceptions.resolveTitle", { reference: resolving?.exceptionId || "" })}
        facts={resolving ? [{ label: t("remittance.exceptions.fields.type"), value: resolving.type }, { label: t("remittance.exceptions.fields.amount"), value: resolving.amount, type: "amount" }] : []}
        confirmLabel={t("remittance.exceptions.actions.resolve")} beforeConfirm={() => { setTried(true); return !resolutionProblem; }}
        onConfirm={() => remittanceService.resolveException(resolving.id, resolutionText())}
        onHide={(r) => { const row = resolving; setResolving(null); if (r?.confirmed) done(t("remittance.exceptions.resolved", { reference: row.exceptionId })); }}>
        <div className="rm-form">
          <div className="rm-field">
            <label htmlFor="rm-resolution-type">{t("remittance.exceptions.resolutionType")}</label>
            <Dropdown inputId="rm-resolution-type" value={resolution.type} options={RESOLUTION_TYPES.map((v) => ({ label: t(`remittance.exceptions.resolutionTypes.${v}`), value: v }))}
              onChange={(e) => setResolution((r) => ({ ...r, type: e.value }))} placeholder={t("remittance.exceptions.chooseType")} className={tried && !resolution.type ? "p-invalid" : ""} />
          </div>
          <div className="rm-field">
            <label htmlFor="rm-resolution-amount">{t("remittance.exceptions.resolutionAmount")}</label>
            <InputNumber inputId="rm-resolution-amount" value={resolution.amount} onValueChange={(e) => setResolution((r) => ({ ...r, amount: e.value }))} mode="decimal"
              minFractionDigits={2} maxFractionDigits={2} />
          </div>
          <div className="rm-field">
            <label htmlFor="rm-resolution-note">{t("remittance.exceptions.resolutionNote")}</label>
            <InputTextarea id="rm-resolution-note" value={resolution.note} rows={3} maxLength={500} onChange={(e) => setResolution((r) => ({ ...r, note: e.target.value }))}
              className={tried && !resolution.note.trim() ? "p-invalid" : ""} />
          </div>
          {tried && resolutionProblem ? <small className="rm-form__error" role="alert">{t("remittance.exceptions.resolutionMissing")}</small> : null}
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default RemittanceExceptions;
