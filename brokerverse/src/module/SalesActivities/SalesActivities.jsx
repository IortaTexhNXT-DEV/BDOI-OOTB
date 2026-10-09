import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import salesActivityService from "../../services/salesActivityService";
import { CHANNEL_ICON } from "../../components/SalesActivities/ActivityPanel";
import { PageHeader, dateTime, date, isoOf, numericColumn, showError } from "../OpsAccounting/common";
import { calendarDateFormat } from "../../utility/dateFormat";

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const TASK_SEVERITY = { open: "warning", done: "success", cancelled: "secondary" };

/**
 * Operations > Sales & Marketing > Sales Activities: every call, meeting, e-mail and visit the account executives
 * logged on prospects, quotations and clients (filters, export), and the activity report by account executive and
 * period: activities by channel, prospects, clients and quotations worked, positive outcomes, next steps and how their
 * My Work follow-ups stand.
 */
const SalesActivities = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date());
  const [filters, setFilters] = useState({ activityType: null, outcome: null, channel: null, accountExecutive: null, search: "" });
  const [options, setOptions] = useState({ types: [], outcomes: [], channels: [] });
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const period = useMemo(() => ({ from: isoOf(from), to: isoOf(to) }), [from, to]);
  const params = useMemo(() => ({ ...period, ...filters, search: filters.search || undefined }), [period, filters]);

  useEffect(() => { salesActivityService.options().then(setOptions).catch((e) => showError(toast, e)); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, rep] = await Promise.all([salesActivityService.list(params), salesActivityService.report({ ...period, accountExecutive: filters.accountExecutive || undefined })]);
      setRows(list);
      setReport(rep);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [params, period, filters.accountExecutive]);
  useEffect(() => { load(); }, [load]);

  const executives = (report?.rows || []).map((r) => ({ label: r.accountExecutiveName, value: r.accountExecutive }));
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const totals = report?.totals || {};

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("salesActivities.screen")} group={t("salesActivities.group")} section={t("salesActivities.section")} subtitle={t("salesActivities.intro")}>
        <Calendar value={from} onChange={(e) => e.value && setFrom(e.value)} showIcon dateFormat={calendarDateFormat()} aria-label={t("salesActivities.from")} />
        <Calendar value={to} onChange={(e) => e.value && setTo(e.value)} showIcon dateFormat={calendarDateFormat()} aria-label={t("salesActivities.to")} />
        <Button icon="pi pi-download" outlined label={t("salesActivities.export")}
          onClick={() => (tab === 0 ? salesActivityService.downloadList(params) : salesActivityService.downloadReport(period)).catch((e) => showError(toast, e))} />
      </PageHeader>
      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("salesActivities.kpi.activities")}</div><div className="pe-kpi-value">{totals.activities ?? 0}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("salesActivities.kpi.executives")}</div><div className="pe-kpi-value">{totals.accountExecutives ?? 0}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("salesActivities.kpi.positive")}</div><div className="pe-kpi-value">{totals.positive ?? 0}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("salesActivities.kpi.followUpsOpen")}</div><div className="pe-kpi-value">{totals.followUpsOpen ?? 0}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("salesActivities.kpi.followUpsOverdue")}</div><div className="pe-kpi-value">{totals.followUpsOverdue ?? 0}</div></div>
      </div>
      <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
        <TabPanel header={t("salesActivities.tabActivities")}>
          <div className="flex flex-wrap gap-2 mb-2">
            <Dropdown value={filters.accountExecutive} options={executives} onChange={(e) => set("accountExecutive", e.value)} showClear placeholder={t("salesActivities.allExecutives")} className="w-14rem" />
            <Dropdown value={filters.activityType} options={options.types.map((x) => ({ label: x.name, value: x.code }))} onChange={(e) => set("activityType", e.value)} showClear
              placeholder={t("salesActivities.allTypes")} className="w-14rem" />
            <Dropdown value={filters.outcome} options={options.outcomes.map((x) => ({ label: x.name, value: x.code }))} onChange={(e) => set("outcome", e.value)} showClear
              placeholder={t("salesActivities.allOutcomes")} className="w-16rem" />
            <InputText value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder={t("salesActivities.search")} className="w-16rem" />
          </div>
          <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={25} rowHover emptyMessage={t("salesActivities.none")}
            onRowClick={(e) => navigate(e.data.link)}>
            <Column header={t("salesActivities.when")} body={(r) => dateTime(r.activityAt)} sortable sortField="activityAt" />
            <Column header={t("salesActivities.type")} body={(r) => <span><i className={`${CHANNEL_ICON[r.channel] || CHANNEL_ICON.other} mr-2`} />{r.activityTypeName}</span>} />
            <Column field="subject" header={t("salesActivities.subject")} />
            <Column header={t("salesActivities.record")} body={(r) => `${r.recordNumber || ""}${r.partyName ? ` · ${r.partyName}` : ""}`} />
            <Column field="accountExecutiveName" header={t("salesActivities.accountExecutive")} />
            <Column header={t("salesActivities.outcome")} body={(r) => (r.outcomeName ? <Tag value={r.outcomeName} /> : "")} />
            <Column header={t("salesActivities.nextStep")} body={(r) => (r.nextStep ? `${r.nextStep}${r.nextStepDate ? ` · ${date(r.nextStepDate)}` : ""}` : "")} />
            <Column header={t("salesActivities.followUp")} body={(r) => (r.taskStatus ? <Tag severity={TASK_SEVERITY[r.taskStatus]} value={t(`salesActivities.task.${r.taskStatus}`)} /> : "")} />
          </DataTable>
        </TabPanel>
        <TabPanel header={t("salesActivities.tabReport")}>
          <DataTable value={report?.rows || []} dataKey="accountExecutive" loading={loading} size="small" stripedRows emptyMessage={t("salesActivities.none")}>
            <Column field="accountExecutiveName" header={t("salesActivities.accountExecutive")} />
            <Column field="total" header={t("salesActivities.kpi.activities")} {...numericColumn} />
            <Column field="call" header={t("salesActivities.channel.call")} {...numericColumn} />
            <Column field="meeting" header={t("salesActivities.channel.meeting")} {...numericColumn} />
            <Column field="email" header={t("salesActivities.channel.email")} {...numericColumn} />
            <Column field="visit" header={t("salesActivities.channel.visit")} {...numericColumn} />
            <Column field="prospects" header={t("salesActivities.prospects")} {...numericColumn} />
            <Column field="clients" header={t("salesActivities.clients")} {...numericColumn} />
            <Column field="quotations" header={t("salesActivities.quotations")} {...numericColumn} />
            <Column field="positive" header={t("salesActivities.kpi.positive")} {...numericColumn} />
            <Column field="nextSteps" header={t("salesActivities.nextSteps")} {...numericColumn} />
            <Column field="followUpsDone" header={t("salesActivities.task.done")} {...numericColumn} />
            <Column field="followUpsOpen" header={t("salesActivities.task.open")} {...numericColumn} />
            <Column field="followUpsOverdue" header={t("salesActivities.overdue")} {...numericColumn} />
          </DataTable>
          <div className="grid mt-3">
            <div className="col-12 md:col-6">
              <h3>{t("salesActivities.byType")}</h3>
              <DataTable value={report?.byType || []} dataKey="activityType" size="small" stripedRows emptyMessage={t("salesActivities.none")}>
                <Column field="activityTypeName" header={t("salesActivities.type")} />
                <Column field="total" header={t("salesActivities.kpi.activities")} {...numericColumn} />
              </DataTable>
            </div>
            <div className="col-12 md:col-6">
              <h3>{t("salesActivities.byOutcome")}</h3>
              <DataTable value={report?.byOutcome || []} dataKey="outcome" size="small" stripedRows emptyMessage={t("salesActivities.none")}>
                <Column field="outcomeName" header={t("salesActivities.outcome")} />
                <Column field="total" header={t("salesActivities.kpi.activities")} {...numericColumn} />
              </DataTable>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>
  );
};

export default SalesActivities;
