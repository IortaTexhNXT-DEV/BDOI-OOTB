import React, { useCallback, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Toast } from "primereact/toast";
import DateField from "../../../components/DateField";
import DetailSection from "../../../components/DetailSection";
import FieldError from "../../../components/FieldError";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadingBar from "../../../components/LoadingBar";
import StatusChip from "../../../components/StatusChip";
import { useStableLoad } from "../../../hooks/useStableLoad";
import incentiveService from "../../../services/incentiveService";
import { readableError } from "../../../utility/apiError";
import { formatInstant } from "../../../utility/dateFormat";
import { showSuccess } from "../../Remittance/shared";
import { IncentiveHeader, monthOptions } from "../common";

/** The field of a template parameter (as the Incentive Report Templates master names it) and its API key. */
export const parameterField = (name) => {
  const n = String(name || "").trim().toLowerCase();
  if (n === "period") return "period";
  if (n === "program") return "program";
  if (n === "agent") return "agent";
  if (n === "branch") return "branch";
  if (n.includes("range")) return "range";
  if (n.includes("minimum")) return "minAchievement";
  if (n === "top n") return "topN";
  return null;
};

/** The chosen values as the API reads them: period, program, agent, branch, from / to, minAchievement, topN. */
export const reportParameters = (values) => Object.fromEntries(Object.entries({
  period: values.period, program: values.program, agent: values.agent, branch: values.branch, from: values.from, to: values.to,
  minAchievement: values.minAchievement, topN: values.topN,
}).filter(([, v]) => v !== null && v !== undefined && v !== ""));

const GenerateDialog = ({ template, templates, onHide, onDone, lists }) => {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState(template?.id ?? null);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const chosen = templates.find((x) => x.id === templateId) || null;
  const fields = (chosen?.parameters || []).map((p) => ({ name: p, field: parameterField(p) })).filter((p) => p.field);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await incentiveService.generateReport({ templateId: chosen.id, parameters: reportParameters(values), format: "CSV" });
      onDone(result);
    } catch (e) {
      setError(readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setBusy(false);
    }
  };

  const control = ({ name, field }) => {
    const id = `inc-rpt-${field}`;
    const dropdown = (options) => (
      <Dropdown inputId={id} value={values[field] ?? null} options={options} onChange={(e) => set(field, e.value)} showClear filter={options.length > 8}
        placeholder={t("incentive.rpt.all")} className="w-full" />
    );
    let input;
    if (field === "period") input = dropdown(lists.months);
    else if (field === "program") input = dropdown(lists.programs);
    else if (field === "agent") input = dropdown(lists.agents);
    else if (field === "branch") input = dropdown(lists.branches);
    else if (field === "range") {
      return (
        <div key={field} className="inc-form__pair">
          <div>
            <label htmlFor={`${id}-from`} className="inc-form__label">{t("incentive.rpt.from")}</label>
            <DateField id={`${id}-from`} name="from" value={values.from || ""} max={values.to || undefined} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="inc-form__label">{t("incentive.rpt.to")}</label>
            <DateField id={`${id}-to`} name="to" value={values.to || ""} min={values.from || undefined} onChange={(e) => set("to", e.target.value)} />
          </div>
        </div>
      );
    } else {
      input = (
        <InputNumber inputId={id} value={values[field] ?? null} onValueChange={(e) => set(field, e.value)} min={field === "topN" ? 1 : 0} max={field === "topN" ? 500 : 1000}
          suffix={field === "minAchievement" ? "%" : undefined} className="w-full" />
      );
    }
    return (
      <div key={field}>
        <label htmlFor={id} className="inc-form__label">{t(`incentive.rpt.params.${field}`, name)}</label>
        {input}
      </div>
    );
  };

  const footer = (
    <>
      <Button type="button" label={t("common.cancel")} outlined onClick={onHide} disabled={busy} />
      <Button type="button" label={t("incentive.rpt.generate")} onClick={generate} loading={busy} disabled={!chosen} />
    </>
  );
  return (
    <Dialog visible onHide={onHide} header={t("incentive.rpt.generateTitle")} footer={footer} modal draggable={false} resizable={false}
      className="bv-centered" style={{ width: "44rem" }} breakpoints={{ "640px": "100vw" }}>
      <div className="inc-form">
        <label htmlFor="inc-rpt-template" className="inc-form__label">{t("incentive.rpt.report")} *</label>
        <Dropdown inputId="inc-rpt-template" value={templateId} options={templates.map((x) => ({ label: x.name, value: x.id }))}
          onChange={(e) => { setTemplateId(e.value); setValues({}); }} className="w-full" />
        {chosen ? (
          <KeyValueGrid columns={3} items={[
            { label: t("incentive.rpt.category"), value: chosen.category },
            { label: t("incentive.rpt.description"), value: chosen.description, span: 2 },
            { label: t("incentive.rpt.format"), value: "CSV" },
          ]} />
        ) : null}
        <div className="inc-form inc-form--two">{fields.map(control)}</div>
        {error ? <FieldError error={error} /> : null}
      </div>
    </Dialog>
  );
};

GenerateDialog.propTypes = {
  template: PropTypes.object,
  templates: PropTypes.arrayOf(PropTypes.object).isRequired,
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
  lists: PropTypes.shape({ months: PropTypes.array, programs: PropTypes.array, agents: PropTypes.array, branches: PropTypes.array }).isRequired,
};
GenerateDialog.defaultProps = { template: null };

const Reports = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [generating, setGenerating] = useState(null);

  const setupLoader = useCallback(async () => {
    const [templates, programs, agents, branches] = await Promise.all([incentiveService.reportTemplates(), incentiveService.listPrograms(), incentiveService.agents(),
      incentiveService.branches()]);
    return { templates, programs, agents, branches };
  }, []);
  const setup = useStableLoad(setupLoader, { initialData: { templates: [], programs: [], agents: [], branches: [] } });
  const historyLoader = useCallback(() => incentiveService.listReports(), []);
  const history = useStableLoad(historyLoader, { initialData: [] });

  const lists = useMemo(() => ({
    months: monthOptions(24).map(({ label, value }) => ({ label, value })),
    programs: setup.data.programs.map((p) => ({ label: `${p.programName} (${p.programCode})`, value: p.programCode })),
    agents: setup.data.agents.map((a) => ({ label: `${a.name} (${a.code})`, value: a.id })),
    branches: setup.data.branches.map((b) => ({ label: b.name, value: b.code })),
  }), [setup.data]);

  const download = (url) => window.open(url, "_blank", "noopener");

  return (
    <div className="inc-page">
      <Toast ref={toast} />
      <IncentiveHeader title={t("incentive.incentiveReports")} help={t("incentive.help.reports")}
        actions={<Button type="button" label={t("incentive.rpt.generateReport")} icon="pi pi-plus" onClick={() => setGenerating({})} disabled={!setup.data.templates.length} />} />
      {setup.error ? <FieldError error={setup.error} /> : null}

      <DetailSection title={t("incentive.rpt.templates")} flush>
        <DataTable value={setup.data.templates} dataKey="id" loading={setup.loading} size="small" className="inc-table" emptyMessage={t("incentive.rpt.noTemplates")}>
          <Column header={t("incentive.rpt.report")} field="name" />
          <Column header={t("incentive.rpt.category")} field="category" />
          <Column header={t("incentive.rpt.description")} field="description" />
          <Column header={t("incentive.rpt.parameters")} body={(x) => (x.parameters || []).join(", ")} />
          <Column header={t("incentive.batch.actions")} body={(x) => (
            <Button type="button" label={t("incentive.rpt.generate")} outlined size="small" onClick={() => setGenerating({ template: x })} />
          )} />
        </DataTable>
      </DetailSection>

      <DetailSection title={t("incentive.rpt.history")} className="bv-loading-host" flush>
        <LoadingBar active={history.refreshing} />
        <DataTable value={history.data} dataKey="reportId" loading={history.loading} paginator rows={20} size="small" className="inc-table" emptyMessage={t("incentive.rpt.noReports")}>
          <Column header={t("incentive.rpt.report")} field="reportType" />
          <Column header={t("incentive.rpt.generatedOn")} body={(r) => formatInstant(r.generatedDate)} />
          <Column header={t("incentive.rpt.generatedBy")} body={(r) => r.generatedBy || "-"} />
          <Column header={t("incentive.rpt.rows")} field="rowCount" className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.rpt.format")} body={() => "CSV"} />
          <Column header={t("incentive.batch.status")} body={(r) => <StatusChip label={r.status === "done" ? t("incentive.rpt.completed") : r.status} />} />
          <Column header={t("incentive.batch.actions")} body={(r) => (
            <Button type="button" icon="pi pi-download" text rounded aria-label={t("incentive.rpt.download")} tooltip={t("incentive.rpt.download")}
              disabled={!r.fileUrl} onClick={() => download(r.fileUrl)} />
          )} />
        </DataTable>
      </DetailSection>

      {generating ? (
        <GenerateDialog template={generating.template || setup.data.templates[0] || null} templates={setup.data.templates} lists={lists} onHide={() => setGenerating(null)}
          onDone={(result) => {
            setGenerating(null);
            history.reload();
            showSuccess(toast, t("incentive.rpt.ready", { report: result.reportType, count: result.rowCount }), t("incentive.rpt.readyTitle"));
            download(result.fileUrl);
          }} />
      ) : null}
    </div>
  );
};

export default Reports;
