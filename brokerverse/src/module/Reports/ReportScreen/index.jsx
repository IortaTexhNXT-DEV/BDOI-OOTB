import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import SvgDot from "../../../assets/icons/SvgDot";
import reportsService from "../../../services/reportsService";
import mastersService from "../../../services/mastersService";
import periodEndService from "../../../services/periodEndService";
import { calendarDateFormat, formatDate, toIsoDate } from "../../../utility/dateFormat";
import { formatCurrency, formatNumber } from "../../../utility/currencyConverter";
import FieldError from "../../../components/FieldError";
import "./index.scss";

/**
 * One report screen for every report in the catalogue (GET /reports/:code). The filter form is built from the report
 * definition: Report Criteria (enum), From / To dates, and the look-up filters (agent, insurer, branch, client, product)
 * each enabled for the criteria the report declares (x-enabledWhen) and left out when the report does not use it
 * (x-disabled). Preview shows the first page on screen; Generate writes the file in the chosen format (CSV, XLSX, PDF).
 */

const LOOKUPS = {
  users: () => reportsService.getAgentOptions(),
  insurance_companies: () => reportsService.getInsuranceCompanyOptions(),
  branches: () => reportsService.getBranchOptions(),
  clients: () => reportsService.getClientOptions(),
  products: async () => (await mastersService.options("product")).map((o) => ({ label: o.label, value: o.value })),
  gl_accounts: async () => (await periodEndService.accounts()).map((a) => ({ label: `${a.code} – ${a.name}`, value: a.code })),
  bank_accounts: async () => (await mastersService.options("bank-account")).map((o) => ({ label: o.label, value: o.code || o.value })),
};
const HIDDEN = new Set(["format", "period", "ReportCriteria", "FromDate", "ToDate"]);
const FORMAT_LABELS = { xlsx: "Excel (XLSX)", csv: "CSV", pdf: "PDF" };

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const cellValue = (type, value) => {
  if (value === null || value === undefined || value === "") return "";
  if (type === "money") return formatCurrency(value);
  if (type === "number" || type === "integer") return formatNumber(value);
  if (type === "percent") return `${formatNumber(value, { maximumFractionDigits: 2 })}%`;
  if (type === "date") return formatDate(value);
  if (type === "datetime") return formatDate(value, { withTime: true });
  return String(value);
};
const NUMERIC = new Set(["money", "number", "integer", "percent"]);

const ReportScreen = ({ code, group, groupPath }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [definition, setDefinition] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({ FromDate: startOfMonth(), ToDate: new Date() });
  const [options, setOptions] = useState({});
  const [format, setFormat] = useState("xlsx");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let active = true;
    setDefinition(null);
    setLoadError(null);
    setPreview(null);
    reportsService
      .getDefinition(code)
      .then((def) => {
        if (!active) return;
        setDefinition(def);
        const criteria = def.parameters?.properties?.ReportCriteria;
        setValues((v) => ({ ...v, ReportCriteria: criteria?.default || criteria?.enum?.[0] || "" }));
        const fileFormats = def.formats || ["xlsx"];
        setFormat(fileFormats.includes("xlsx") ? "xlsx" : fileFormats[0]);
        const sources = [...new Set(Object.values(def.parameters?.properties || {}).filter((p) => p["x-options"] && !p["x-disabled"]).map((p) => p["x-options"]))];
        Promise.all(sources.map((src) => (LOOKUPS[src] ? LOOKUPS[src]().catch(() => []) : Promise.resolve([]))))
          .then((lists) => active && setOptions(Object.fromEntries(sources.map((src, i) => [src, lists[i]]))));
      })
      .catch((error) => active && setLoadError(error.message));
    return () => {
      active = false;
    };
  }, [code]);

  const properties = definition?.parameters?.properties || {};
  const criteriaProp = properties.ReportCriteria;
  const filters = useMemo(
    () => Object.entries(properties).filter(([key, p]) => !HIDDEN.has(key) && !p["x-disabled"] && (p["x-options"] || key === "Status")),
    [properties]
  );
  const enabled = (prop) => {
    const when = prop["x-enabledWhen"];
    if (!when) return true;
    return Object.entries(when).every(([field, allowed]) => allowed.includes(values[field]));
  };

  const setField = (key, value) => {
    setValues((v) => {
      const next = { ...v, [key]: value };
      // a filter that the new criteria does not use is cleared, so it is not sent
      if (key === "ReportCriteria") {
        for (const [name, p] of filters) if (p["x-enabledWhen"] && !p["x-enabledWhen"].ReportCriteria?.includes(value)) next[name] = "";
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (criteriaProp && !values.ReportCriteria) found.ReportCriteria = `${criteriaProp.title || "Report criteria"} is required`;
    if (!values.FromDate) found.FromDate = "From date is required";
    if (!values.ToDate) found.ToDate = "To date is required";
    if (values.FromDate && values.ToDate && values.ToDate < values.FromDate) found.ToDate = "To date must be on or after the from date";
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const params = () => {
    const out = { ReportCriteria: values.ReportCriteria || undefined, FromDate: toIsoDate(values.FromDate), ToDate: toIsoDate(values.ToDate) };
    for (const [key, p] of filters) if (enabled(p) && values[key]) out[key] = values[key];
    return out;
  };

  const showError = (error) => toast.current?.show({ severity: "error", summary: t("reports.failedToGenerate"), detail: error.message, life: 5000 });

  const runPreview = async () => {
    if (!validate()) return;
    setBusy("preview");
    try {
      const r = await reportsService.runReport(code, params(), { page: 1, perPage: 50 });
      setPreview({ ...r.data, total: r.total ?? r.data?.rows?.length ?? 0 });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!validate()) return;
    setBusy("generate");
    try {
      const report = await reportsService.generateReport(code, params(), format);
      toast.current?.show({ severity: "success", summary: t("reports.reportGenerated"), detail: `${report.fileName} (${report.rowCount ?? 0} rows)`, life: 4000 });
      if (report.downloadUrl) {
        const link = document.createElement("a");
        link.href = report.downloadUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  const title = definition?.name || "";
  const crumbs = [{ label: group || t("reports.heading"), command: groupPath ? () => navigate(groupPath) : undefined }, { label: title }];

  const formatOptions = (definition?.formats || ["xlsx"]).map((f) => ({ label: FORMAT_LABELS[f] || f.toUpperCase(), value: f }));

  return (
    <div className="report-screen">
      <Toast ref={toast} />
      <div className="report-screen__header">
        <div>
          <h1 className="page-title">{title || t("reports.heading")}</h1>
          <BreadCrumb model={crumbs} home={{ label: t("reports.heading"), command: () => navigate("/reports/catalogue") }} separatorIcon={<SvgDot color={"#000"} />} />
        </div>
      </div>

      {loadError && <Message severity="warn" text={loadError} className="w-full mb-3" />}

      {definition && (
        <Card className="report-screen__card">
          <div className="formgrid grid p-fluid">
            {criteriaProp && (
              <div className="field col-12 md:col-6 lg:col-3">
                <label htmlFor="rpt-criteria">{criteriaProp.title || t("reports.reportCriteria")} *</label>
                <Dropdown
                  inputId="rpt-criteria"
                  value={values.ReportCriteria}
                  options={(criteriaProp.enum || []).map((v) => ({ label: v, value: v }))}
                  onChange={(e) => setField("ReportCriteria", e.value)}
                  placeholder={t("reports.select")}
                />
                <FieldError error={errors.ReportCriteria} />
              </div>
            )}
            <div className="field col-12 md:col-6 lg:col-3">
              <label htmlFor="rpt-from">{t("reports.fromDate")} *</label>
              <Calendar inputId="rpt-from" value={values.FromDate} onChange={(e) => setField("FromDate", e.value)} dateFormat={calendarDateFormat()} showIcon maxDate={values.ToDate || undefined} />
              <FieldError error={errors.FromDate} />
            </div>
            <div className="field col-12 md:col-6 lg:col-3">
              <label htmlFor="rpt-to">{t("reports.toDate")} *</label>
              <Calendar inputId="rpt-to" value={values.ToDate} onChange={(e) => setField("ToDate", e.value)} dateFormat={calendarDateFormat()} showIcon minDate={values.FromDate || undefined} />
              <FieldError error={errors.ToDate} />
            </div>
            {filters.map(([key, p]) => {
              const on = enabled(p);
              return (
                <div key={key} className="field col-12 md:col-6 lg:col-3">
                  <label htmlFor={`rpt-${key}`}>{p.title || key}</label>
                  {p["x-options"] ? (
                    <Dropdown
                      inputId={`rpt-${key}`}
                      value={values[key] || null}
                      options={options[p["x-options"]] || []}
                      onChange={(e) => setField(key, e.value)}
                      placeholder={on ? t("reports.select") : `Used with criteria ${(p["x-enabledWhen"]?.ReportCriteria || []).join(", ")}`}
                      disabled={!on}
                      filter
                      showClear
                    />
                  ) : (
                    <InputText id={`rpt-${key}`} value={values[key] || ""} onChange={(e) => setField(key, e.target.value)} disabled={!on} />
                  )}
                  <FieldError error={errors[key]} />
                </div>
              );
            })}
          </div>

          <div className="report-screen__actions">
            <div className="report-screen__format">
              <span className="report-screen__format-label">File format</span>
              <SelectButton value={format} options={formatOptions} onChange={(e) => e.value && setFormat(e.value)} aria-label="File format" />
            </div>
            <div className="report-screen__buttons">
              <Button label="Preview" icon="pi pi-eye" outlined onClick={runPreview} loading={busy === "preview"} disabled={Boolean(busy)} />
              <Button label={busy === "generate" ? t("reports.generating") : t("reports.generate")} icon="pi pi-download" onClick={generate} loading={busy === "generate"} disabled={Boolean(busy)} />
            </div>
          </div>
        </Card>
      )}

      {preview && (
        <Card className="report-screen__card mt-3" title={`Preview (${formatNumber(preview.total || 0)} rows${preview.total > (preview.rows || []).length ? `, first ${(preview.rows || []).length} shown` : ""})`}>
          <DataTable value={preview.rows || []} scrollable size="small" emptyMessage="No rows for these filters" className="report-screen__table">
            {(preview.columns || []).map((c) => (
              <Column
                key={c.key}
                field={c.key}
                header={c.label}
                body={(row) => cellValue(c.type, row[c.key])}
                className={NUMERIC.has(c.type) ? "bv-num" : undefined}
                headerClassName={NUMERIC.has(c.type) ? "bv-num" : undefined}
              />
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  );
};

export default ReportScreen;
