// Product Configurator screens: Product Templates, Coverage Builder, Rating Engine, Acceptance Rules, Market Mapping,
// Document Manager and Product Analytics. Each screen says how its configuration is used by the business flow
// (backend product-configurator/underwriting.js and documents/productDocuments.js) and shares one page frame, filter
// bar, row actions and history dialog (shared/ConfiguratorPage.js).

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from "primereact/checkbox";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { Chips } from "primereact/chips";
import { ProgressBar } from "primereact/progressbar";
import { Chart } from "primereact/chart";
import FieldError from "../../components/FieldError";
import productConfiguratorService from "../../services/productConfiguratorService";
import mastersService from "../../services/mastersService";
import ProductConfiguratorTab from "./ProductConfiguratorTab/ProductConfiguratorTab";
import { fetchProductTemplateByIdMiddleware } from "./store/productConfiguratorMiddleware";
import { clearProductTemplate } from "./store/productConfiguratorSlice";
import { cleanMotorTariff } from "./ProductConfiguratorTab/MotorTariffEditor";
import { numberLocale } from "../../utility/currencyConverter";
import { calendarDateFormat, toIsoDate, formatDate } from "../../utility/dateFormat";
import { requiredErrors, hasErrors, errorSummary } from "../../utility/requiredFields";
import { statusLabel } from "../../utils/statusSeverity";
import { useChartTheme } from "../../theme/chartTheme";
import {
  ConfiguratorPage, FilterBar, HistoryDialog, RowActions, StatusTag, TemplateCell, ViewDialog, IconAction,
  pagingFor, templateText, productText, useComponentRows, useFilterOptions, toggleComponent, confirmStatusChange,
} from "./shared/ConfiguratorPage";
import {
  RULE_ACTIONS, RULE_TYPES, OPERATORS, actionSeverity, conditionText, outcomeText, refers, authorityText, insurerText, ruleErrors,
  layoutFileError, layoutPlaceholders,
} from "./shared/ruleLogic";

/** Runs a save call and shows the outcome on the screen's toast; resolves to true on success. */
const persist = async (action, toast, { success, successDetail, error, errorDetail }) => {
  try {
    await action();
    toast.current?.show({ severity: "success", summary: success, detail: successDetail });
    return true;
  } catch (err) {
    toast.current?.show({ severity: "error", summary: error, detail: err?.message || errorDetail });
    return false;
  }
};

/** Template picker of a new component (the component belongs to one product template). */
const TemplateField = ({ value, options, onChange, error }) => {
  const { t } = useTranslation();
  return (
    <div className="field">
      <label htmlFor="pc-template">{t("productConfigurator.template")} *</label>
      <Dropdown inputId="pc-template" value={value} options={options} filter placeholder={t("productConfigurator.selectTemplate")} onChange={(e) => onChange(e.value)} />
      <FieldError error={error} />
    </div>
  );
};

const STATUS_FIELD_OPTIONS = ["Active", "Inactive", "Draft"];
const StatusField = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="field">
      <label htmlFor="pc-status">{t("productConfigurator.filters.status")}</label>
      <Dropdown inputId="pc-status" value={value || "Active"} options={STATUS_FIELD_OPTIONS.map((s) => ({ label: statusLabel(s), value: s }))} onChange={(e) => onChange(e.value)} />
    </div>
  );
};

const statusBody = (row) => <StatusTag status={row.status} />;
const templateBody = (row) => <TemplateCell row={row} />;

/** Shared state of a component list screen: filters, rows, dialogs. */
const useComponentScreen = (kind, errorText) => {
  const toast = useRef(null);
  const [filters, setFilters] = useState({});
  const options = useFilterOptions();
  const { rows, loading, reload } = useComponentRows(kind, filters, toast, errorText);
  const [history, setHistory] = useState(null);
  const [viewing, setViewing] = useState(null);
  return { toast, filters, setFilters, options, rows, loading, reload, history, setHistory, viewing, setViewing };
};

// ---------------------------------------------------------------- PC-2 Product Templates

export const ProductTemplateManager = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateErrors, setTemplateErrors] = useState({});
  const [showDialog, setShowDialog] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [history, setHistory] = useState(null);
  const [viewing, setViewing] = useState(null);
  const toast = useRef(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const { template: templateFromStore, loading: templateLoading, error: templateError } = useSelector((state) => state.productConfiguratorReducer || {});
  const [categoryOptions, setCategoryOptions] = useState([]);
  // line of business and product come from the masters (Line of Business master, products), so the codes match
  const [lobOptions, setLobOptions] = useState([]);
  const [productRows, setProductRows] = useState([]);
  const productOptions = productRows.map((p) => ({ label: `${p.productCode} · ${p.productName}`, value: p.id }));
  const statusOptions = [
    { label: t("productTemplateManager.active"), value: "Active" },
    { label: t("productTemplateManager.inactive"), value: "Inactive" },
    { label: t("productTemplateManager.draft"), value: "Draft" },
  ];

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      setTemplates(await productConfiguratorService.getProductTemplates());
    } catch (error) {
      toast.current?.show({ severity: "error", summary: t("productTemplateManager.error"), detail: t("productTemplateManager.failedToLoadTemplates") });
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    mastersService.options("product-category").then((o) => setCategoryOptions(o.map((x) => ({ label: x.label, value: x.value })))).catch(() => setCategoryOptions([]));
    mastersService.options("line-of-business").then((o) => setLobOptions(o.map((x) => ({ label: `${x.code} · ${x.label}`, value: x.code })))).catch(() => setLobOptions([]));
    mastersService.list("product", { status: "Active" }).then(setProductRows).catch(() => setProductRows([]));
    return () => {
      dispatch(clearProductTemplate());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Product Configurator > Create (dashboard "Create New Product") opens the create dialog over the list
  useEffect(() => {
    if (location.pathname.endsWith("/product-configurator/create")) {
      setSelectedTemplate({ status: "Active" });
      setTemplateErrors({});
      setShowDialog(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (id) dispatch(fetchProductTemplateByIdMiddleware({ templateId: id }));
    else {
      dispatch(clearProductTemplate());
      setSelectedTemplate(null);
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (id && templateFromStore) setSelectedTemplate(templateFromStore);
  }, [id, templateFromStore]);

  useEffect(() => {
    if (templateError) toast.current?.show({ severity: "error", summary: t("productTemplateManager.error"), detail: templateError });
  }, [templateError, t]);

  const setLifecycle = async (template) => {
    const retire = template.status === "Active";
    const done = await confirmStatusChange({
      deactivate: retire,
      kindLabel: t("productConfigurator.kinds.template"),
      record: { code: template.templateCode, name: template.name },
      t,
      message: t(retire ? "productConfigurator.status.retireMessage" : "productConfigurator.status.activateMessage"),
      note: retire ? t("productConfigurator.status.retireNote") : null,
      confirmLabel: t(retire ? "productConfigurator.status.retireAction" : "productConfigurator.status.activateTemplateAction"),
      run: () => (retire ? productConfiguratorService.retireProductTemplate(template.id) : productConfiguratorService.reactivateProductTemplate(template.id)),
    });
    if (!done) return;
    toast.current?.show({ severity: "success", summary: t("productTemplateManager.success"), detail: t("productTemplateManager.templateUpdated") });
    loadTemplates();
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    const fieldLabels = {
      templateCode: t("productTemplateManager.templateCode"), name: t("productTemplateManager.productName"), category: t("productTemplateManager.category"),
      lineOfBusiness: t("productTemplateManager.lineOfBusiness"), effectiveDate: t("productTemplateManager.effectiveDate"), status: t("productTemplateManager.status"),
    };
    const missingFields = Object.keys(fieldLabels).filter((field) => {
      const value = selectedTemplate[field];
      if (value instanceof Date) return Number.isNaN(value.getTime());
      if (typeof value === "string") return value.trim() === "";
      return value === undefined || value === null;
    });
    setTemplateErrors(Object.fromEntries(missingFields.map((field) => [field, t("productConfigurator.fieldRequired", { field: fieldLabels[field] })])));
    if (missingFields.length) {
      toast.current?.show({ severity: "warn", summary: t("productTemplateManager.validation"), detail: t("productTemplateManager.pleaseFillIn", { fields: missingFields.map((f) => fieldLabels[f]).join(", ") }) });
      return;
    }
    const { templateCode, name, category, lineOfBusiness, productId, effectiveDate, status, description } = selectedTemplate;
    // local calendar date (toISOString would give the previous day east of UTC)
    const payload = { templateCode, name, category, lineOfBusiness, productId: productId ?? null, effectiveDate: toIsoDate(effectiveDate), status, description: description || "" };
    try {
      if (selectedTemplate?.id) {
        await productConfiguratorService.updateProductTemplate({ ...selectedTemplate, configuration: cleanMotorTariff(selectedTemplate.configuration), ...payload });
      } else {
        await productConfiguratorService.createProductTemplate(payload);
      }
      toast.current?.show({ severity: "success", summary: t("productTemplateManager.success"), detail: selectedTemplate?.id ? t("productTemplateManager.templateUpdated") : t("productTemplateManager.templateSaved") });
      setShowDialog(false);
      if (selectedTemplate?.id) setSelectedTemplate({ ...selectedTemplate, configuration: cleanMotorTariff(selectedTemplate.configuration) });
      else {
        setSelectedTemplate(null);
        dispatch(clearProductTemplate());
      }
      loadTemplates();
    } catch (error) {
      toast.current?.show({ severity: "error", summary: t("productTemplateManager.error"), detail: error?.message || t("productTemplateManager.failedToSaveTemplate") });
    }
  };

  const visible = useMemo(() => {
    const s = String(filters.search || "").trim().toLowerCase();
    return templates.filter((r) => (!filters.status || r.status === filters.status)
      && (!filters.lineOfBusiness || String(r.lineOfBusiness).toUpperCase() === filters.lineOfBusiness)
      && (!s || [r.templateCode, r.name, r.productCode, r.productName, r.category].some((v) => String(v || "").toLowerCase().includes(s))));
  }, [templates, filters]);

  if (id) {
    return (
      <ConfiguratorPage screen="templates" actions={<Button label={t("productTemplateManager.back")} icon="pi pi-arrow-left" className="p-button-text" onClick={() => navigate("/product-configurator/templates")} />}>
        <Toast ref={toast} />
        {selectedTemplate && <ProductConfiguratorTab selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} saveTemplate={saveTemplate} />}
      </ConfiguratorPage>
    );
  }

  return (
    <ConfiguratorPage
      screen="templates"
      usage={t("productConfigurator.usage.templates")}
      actions={<Button label={t("productTemplateManager.createTemplate")} icon="pi pi-plus" onClick={() => { setSelectedTemplate({ status: "Active" }); setTemplateErrors({}); setShowDialog(true); }} />}
    >
      <Toast ref={toast} />
      <FilterBar value={filters} onChange={setFilters} show={["lob", "status"]} options={{ lobs: lobOptions }} />
      <DataTable value={visible} loading={templatesLoading} dataKey="id" {...pagingFor(visible.length)} emptyMessage={t("productConfigurator.empty")} size="small">
        <Column field="templateCode" header={t("productTemplateManager.templateCode")} sortable />
        <Column field="name" header={t("productTemplateManager.productName")} sortable />
        <Column header={t("productTemplateManager.product")} body={(r) => productText(r) || "—"} />
        <Column field="lineOfBusiness" header={t("productTemplateManager.lineOfBusiness")} sortable />
        <Column field="version" header={t("productTemplateManager.version")} sortable />
        <Column field="status" header={t("productTemplateManager.status")} body={statusBody} sortable />
        <Column header={t("productTemplateManager.inUse")} body={(r) => (r.governsFlow ? <Tag value={t("productTemplateManager.inUseYes")} severity="success" title={t("productTemplateManager.inUseHelp")} /> : <span className="pc-muted">—</span>)} />
        <Column
          header={t("productConfigurator.actions.title")}
          body={(r) => (
            <RowActions
              row={r}
              onView={setViewing}
              onEdit={(row) => navigate(`/product-configurator/template/${row.id}`)}
              onToggle={setLifecycle}
              onHistory={(row) => setHistory({ ...row, label: row.templateCode })}
            />
          )}
        />
      </DataTable>
      <HistoryDialog kind="template" row={history} onHide={() => setHistory(null)} />
      <ViewDialog
        header={t("productConfigurator.view.template")}
        title={viewing?.templateCode}
        subtitle={viewing?.name}
        status={viewing?.status}
        visible={Boolean(viewing)}
        onHide={() => setViewing(null)}
        onHistory={() => { setHistory({ ...viewing, label: viewing.templateCode }); setViewing(null); }}
        rows={viewing ? [
          [t("productTemplateManager.product"), productText(viewing)], [t("productTemplateManager.category"), viewing.category], [t("productTemplateManager.lineOfBusiness"), viewing.lineOfBusiness],
          [t("productTemplateManager.version"), viewing.version], [t("productTemplateManager.effectiveDate"), viewing.effectiveDate, { type: "date" }],
          [t("productTemplateManager.expiryDate"), viewing.expiryDate, { type: "date" }], [t("productTemplateManager.inUse"), Boolean(viewing.governsFlow), { type: "boolean" }],
          [t("productTemplateManager.components"), t("productTemplateManager.componentCounts", viewing._count || {})],
          [t("productTemplateManager.insurers"), (viewing.insurers || []).join(", "), { span: "full" }], [t("productTemplateManager.description"), viewing.description, { span: "full" }],
        ] : []}
      />

      <Dialog header={t("productTemplateManager.createProductTemplate")} visible={showDialog} style={{ width: "50rem" }} breakpoints={{ "960px": "95vw" }} onHide={() => { setShowDialog(false); setSelectedTemplate(null); }}>
        <div className="p-fluid">
          <div className="formgrid grid">
            <div className="field col-12 md:col-6">
              <label htmlFor="tpl-code">{t("productTemplateManager.templateCode")} *</label>
              <InputText id="tpl-code" value={selectedTemplate?.templateCode || ""} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, templateCode: e.target.value })} />
              <FieldError error={templateErrors.templateCode} />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="tpl-name">{t("productTemplateManager.productName")} *</label>
              <InputText id="tpl-name" value={selectedTemplate?.name || ""} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })} />
              <FieldError error={templateErrors.name} />
            </div>
            <div className="field col-12">
              <label htmlFor="tpl-desc">{t("productTemplateManager.description")}</label>
              <InputTextarea id="tpl-desc" value={selectedTemplate?.description || ""} rows={2} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, description: e.target.value })} />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="tpl-cat">{t("productTemplateManager.category")} *</label>
              <Dropdown inputId="tpl-cat" value={selectedTemplate?.category || null} options={categoryOptions} placeholder={t("productTemplateManager.selectCategory")} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, category: e.value })} showClear />
              <FieldError error={templateErrors.category} />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="tpl-prod">{t("productTemplateManager.product")}</label>
              <Dropdown
                inputId="tpl-prod"
                value={selectedTemplate?.productId ?? null}
                options={productOptions}
                filter
                showClear
                placeholder={t("productTemplateManager.selectProduct")}
                onChange={(e) => {
                  const product = productRows.find((p) => p.id === e.value);
                  const lob = product && lobOptions.find((o) => o.value === String(product.lineofBusiness || "").toUpperCase());
                  setSelectedTemplate({ ...selectedTemplate, productId: e.value ?? null, ...(lob ? { lineOfBusiness: lob.value } : {}) });
                }}
              />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="tpl-lob">{t("productTemplateManager.lineOfBusiness")} *</label>
              <Dropdown inputId="tpl-lob" value={selectedTemplate?.lineOfBusiness || null} options={lobOptions} filter placeholder={t("productTemplateManager.selectLineOfBusiness")} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, lineOfBusiness: e.value })} />
              <FieldError error={templateErrors.lineOfBusiness} />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="tpl-eff">{t("productTemplateManager.effectiveDate")} *</label>
              <Calendar inputId="tpl-eff" value={selectedTemplate?.effectiveDate ? new Date(selectedTemplate.effectiveDate) : null} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, effectiveDate: e.value })} showIcon dateFormat={calendarDateFormat()} placeholder={t("productTemplateManager.selectEffectiveDate")} />
              <FieldError error={templateErrors.effectiveDate} />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="tpl-status">{t("productTemplateManager.status")} *</label>
              <Dropdown inputId="tpl-status" value={selectedTemplate?.status || "Active"} options={statusOptions} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, status: e.value })} />
              <FieldError error={templateErrors.status} />
            </div>
          </div>
          <div className="flex justify-content-end">
            <Button label={selectedTemplate?.id ? t("productTemplateManager.update") : t("productTemplateManager.create")} icon={selectedTemplate?.id ? "pi pi-save" : "pi pi-plus"} onClick={saveTemplate} disabled={templateLoading} className="w-auto" />
          </div>
        </div>
      </Dialog>
    </ConfiguratorPage>
  );
};

// ---------------------------------------------------------------- PC-3 Coverage Builder

const QUOTE_FIELD_KEYS = ["lossAndDamageCoveragePremium", "actsOfNaturePremium", "roadsideAssistancePremium", "personalAccidentCoverPremium", "bodilyInjuryCoveragePremium", "propertyDamageCoveragePremium", "APPAcoveragePremium", "ctplCoveragePremium"];

export const CoverageBuilder = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const s = useComponentScreen("coverages", t("coverageBuilder.failedToLoad"));
  const [selected, setSelected] = useState(null);
  const [errors, setErrors] = useState({});
  const quoteFieldOptions = QUOTE_FIELD_KEYS.map((k) => ({ label: t(`coverageBuilder.quoteFields.${k}`), value: k }));
  const typeOptions = [{ label: t("coverageBuilder.mandatory"), value: "Mandatory" }, { label: t("coverageBuilder.optional"), value: "Optional" }];

  const open = (row) => { setErrors({}); setSelected(row); };
  const save = async () => {
    const fields = [["coverageCode", t("coverageBuilder.coverageCode")], ["coverageName", t("coverageBuilder.coverageName")], ["type", t("coverageBuilder.type")], ...(selected.id ? [] : [["productId", t("productConfigurator.template")]])];
    const e = requiredErrors(selected, fields);
    setErrors(e);
    if (hasErrors(e)) {
      s.toast.current?.show({ severity: "warn", summary: t("common.validation"), detail: errorSummary(e) });
      return;
    }
    const ok = await persist(() => productConfiguratorService.saveComponent("coverages", selected), s.toast, { success: t("coverageBuilder.success"), successDetail: t("coverageBuilder.saved"), error: t("coverageBuilder.error"), errorDetail: t("coverageBuilder.failedToSave") });
    if (ok) { setSelected(null); s.reload(); }
  };
  const toggle = async (row) => { if (await toggleComponent("coverages", row, s.toast, t)) s.reload(); };
  const quoteFieldText = (k) => (k ? t(`coverageBuilder.quoteFields.${k}`) : t("coverageBuilder.notPriced"));

  return (
    <ConfiguratorPage screen="coverages" usage={t("productConfigurator.usage.coverages")} actions={<Button label={t("coverageBuilder.addCoverage")} icon="pi pi-plus" onClick={() => open({ limits: [], exclusions: [], status: "Active" })} />}>
      <Toast ref={s.toast} />
      <FilterBar value={s.filters} onChange={s.setFilters} show={["template", "lob", "status"]} options={s.options} />
      <DataTable value={s.rows} loading={s.loading} dataKey="id" {...pagingFor(s.rows.length)} emptyMessage={t("productConfigurator.empty")} size="small">
        <Column field="coverageCode" header={t("coverageBuilder.code")} sortable />
        <Column field="coverageName" header={t("coverageBuilder.coverageName")} sortable />
        <Column header={t("productConfigurator.templateProduct")} body={templateBody} />
        <Column header={t("coverageBuilder.type")} body={(r) => <Tag value={r.type === "Mandatory" ? t("coverageBuilder.mandatory") : t("coverageBuilder.optional")} severity={r.type === "Mandatory" ? "warning" : "info"} />} />
        <Column field="deductible" header={t("coverageBuilder.deductible")} sortable body={(r) => formatCurrency(r.deductible ?? 0)} />
        <Column header={t("coverageBuilder.quoteField")} body={(r) => quoteFieldText(r.quoteField)} />
        <Column field="status" header={t("productConfigurator.filters.status")} body={statusBody} />
        <Column header={t("productConfigurator.actions.title")} body={(r) => <RowActions row={r} onView={s.setViewing} onEdit={open} onToggle={toggle} onHistory={(row) => s.setHistory({ ...row, label: row.coverageCode })} />} />
      </DataTable>
      <HistoryDialog kind="coverages" row={s.history} onHide={() => s.setHistory(null)} />
      <ViewDialog header={t("productConfigurator.view.coverage")} title={s.viewing?.coverageCode} subtitle={s.viewing?.coverageName} status={s.viewing?.status}
        visible={Boolean(s.viewing)} onHide={() => s.setViewing(null)}
        onHistory={() => { s.setHistory({ ...s.viewing, label: s.viewing.coverageCode }); s.setViewing(null); }} rows={s.viewing ? [
        [t("productConfigurator.template"), templateText(s.viewing)], [t("productTemplateManager.product"), productText(s.viewing)],
        [t("coverageBuilder.type"), typeOptions.find((o) => o.value === s.viewing.type)?.label || s.viewing.type], [t("coverageBuilder.deductible"), s.viewing.deductible ?? 0, { type: "amount" }],
        [t("coverageBuilder.waitingPeriodDays"), s.viewing.waitingPeriod, { type: "number" }], [t("coverageBuilder.quoteField"), quoteFieldText(s.viewing.quoteField)],
        [t("coverageBuilder.exclusions"), (s.viewing.exclusions || []).join(", "), { span: "full" }], [t("coverageBuilder.description"), s.viewing.description, { span: "full" }],
      ] : []} />

      <Dialog header={t("coverageBuilder.configureCoverage")} visible={Boolean(selected)} style={{ width: "48rem" }} breakpoints={{ "960px": "95vw" }} onHide={() => setSelected(null)}>
        {selected && (
          <div className="p-fluid">
            {!selected.id && <TemplateField value={selected.productId} options={s.options.templates} onChange={(productId) => setSelected({ ...selected, productId })} error={errors.productId} />}
            <div className="formgrid grid">
              <div className="field col-12 md:col-6">
                <label htmlFor="cov-code">{t("coverageBuilder.coverageCode")} *</label>
                <InputText id="cov-code" value={selected.coverageCode || ""} onChange={(e) => setSelected({ ...selected, coverageCode: e.target.value })} />
                <FieldError error={errors.coverageCode} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="cov-name">{t("coverageBuilder.coverageName")} *</label>
                <InputText id="cov-name" value={selected.coverageName || ""} onChange={(e) => setSelected({ ...selected, coverageName: e.target.value })} />
                <FieldError error={errors.coverageName} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="cov-type">{t("coverageBuilder.type")} *</label>
                <Dropdown inputId="cov-type" value={selected.type} options={typeOptions} onChange={(e) => setSelected({ ...selected, type: e.value })} />
                <FieldError error={errors.type} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="cov-qf">{t("coverageBuilder.quoteField")}</label>
                <Dropdown inputId="cov-qf" value={selected.quoteField || null} options={quoteFieldOptions} showClear placeholder={t("coverageBuilder.notPriced")} onChange={(e) => setSelected({ ...selected, quoteField: e.value || null })} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="cov-ded">{t("coverageBuilder.deductibleAmount")}</label>
                <InputNumber inputId="cov-ded" value={selected.deductible ?? null} mode="currency" currency={currencyCode} onChange={(e) => setSelected({ ...selected, deductible: e.value })} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="cov-wait">{t("coverageBuilder.waitingPeriodDays")}</label>
                <InputNumber inputId="cov-wait" value={selected.waitingPeriod ?? null} onChange={(e) => setSelected({ ...selected, waitingPeriod: e.value })} />
              </div>
              <div className="field col-12">
                <label htmlFor="cov-desc">{t("coverageBuilder.description")}</label>
                <InputTextarea id="cov-desc" value={selected.description || ""} rows={2} onChange={(e) => setSelected({ ...selected, description: e.target.value })} />
              </div>
              <div className="field col-12">
                <label htmlFor="cov-excl">{t("coverageBuilder.exclusions")}</label>
                <Chips id="cov-excl" value={selected.exclusions || []} onChange={(e) => setSelected({ ...selected, exclusions: e.value })} />
              </div>
              <div className="field col-12 md:col-6"><StatusField value={selected.status} onChange={(status) => setSelected({ ...selected, status })} /></div>
            </div>
            <div className="flex justify-content-end"><Button label={t("coverageBuilder.saveCoverage")} icon="pi pi-check" onClick={save} className="w-auto" /></div>
          </div>
        )}
      </Dialog>
    </ConfiguratorPage>
  );
};

// ---------------------------------------------------------------- shared: test a risk against a template

/** Test a risk against the acceptance rules and rating factors of a template (POST /underwriting/evaluate). */
const TestRiskDialog = ({ visible, onHide, templates, insurers, fields }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const tpl = templates.find((x) => x.value === form.templateId);
      const risk = Object.fromEntries(Object.entries(form).filter(([k, v]) => !["templateId", "insurerId"].includes(k) && v !== null && v !== undefined && v !== ""));
      setResult(await productConfiguratorService.evaluateRisk({ templateCode: tpl?.code || null, insurerId: form.insurerId || null, risk }));
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };
  const num = (k, label) => (
    <div className="field col-6 md:col-4" key={k}>
      <label htmlFor={`tr-${k}`}>{label}</label>
      <InputNumber inputId={`tr-${k}`} value={form[k] ?? null} onValueChange={(e) => set(k, e.value)} useGrouping={k !== "modelYear"} />
    </div>
  );
  const useField = fields.find((f) => f.value === "vehicleUse");
  return (
    <Dialog header={t("underwritingRules.testRisk")} visible={visible} onHide={onHide} style={{ width: "56rem" }} breakpoints={{ "960px": "95vw" }}>
      <div className="p-fluid formgrid grid">
        <div className="field col-12 md:col-6">
          <label htmlFor="tr-template">{t("productConfigurator.template")} *</label>
          <Dropdown inputId="tr-template" value={form.templateId ?? null} options={templates} filter onChange={(e) => set("templateId", e.value)} placeholder={t("productConfigurator.selectTemplate")} />
        </div>
        <div className="field col-12 md:col-6">
          <label htmlFor="tr-insurer">{t("underwritingRules.insurer")}</label>
          <Dropdown inputId="tr-insurer" value={form.insurerId ?? null} options={insurers} filter showClear onChange={(e) => set("insurerId", e.value)} placeholder={t("underwritingRules.allInsurers")} />
        </div>
        {num("modelYear", t("underwritingRules.risk.modelYear"))}
        <div className="field col-6 md:col-4">
          <label htmlFor="tr-use">{t("underwritingRules.risk.vehicleUse")}</label>
          <Dropdown inputId="tr-use" value={form.vehicleUse ?? null} options={(useField?.options || []).map((o) => ({ label: o, value: o }))} showClear onChange={(e) => set("vehicleUse", e.value)} />
        </div>
        {num("totalSumInsured", t("underwritingRules.risk.sumInsured"))}
        {num("fairMarketValue", t("underwritingRules.risk.fairMarketValue"))}
        {num("driverAge", t("underwritingRules.risk.driverAge"))}
        {num("claimsLast3Years", t("underwritingRules.risk.claims"))}
        {num("memberCount", t("underwritingRules.risk.members"))}
        <div className="field col-6 md:col-4 flex align-items-center gap-2 mt-4">
          <Checkbox inputId="tr-mod" checked={Boolean(form.modified)} onChange={(e) => set("modified", e.checked)} />
          <label htmlFor="tr-mod">{t("underwritingRules.risk.modified")}</label>
        </div>
        <div className="field col-6 md:col-4 flex align-items-center gap-2 mt-4">
          <Checkbox inputId="tr-flood" checked={Boolean(form.floodProne)} onChange={(e) => set("floodProne", e.checked)} />
          <label htmlFor="tr-flood">{t("underwritingRules.risk.floodProne")}</label>
        </div>
      </div>
      <div className="flex justify-content-end mb-3"><Button label={t("underwritingRules.runTest")} icon="pi pi-play" onClick={run} loading={busy} disabled={!form.templateId} /></div>
      {error && <p className="pc-error">{error}</p>}
      {result && (
        <div>
          <p>
            {t("underwritingRules.decision")}: <Tag value={t(`underwritingRules.outcomes.${result.decision}`)} severity={{ accepted: "success", referred: "warning", declined: "danger" }[result.decision]} />{" "}
            <span className="pc-muted">{t(`underwritingRules.decisions.${result.decision}`)}</span>
            {result.loadingPercent > 0 && <span> · {t("underwritingRules.outcome.loading", { percent: result.loadingPercent })}</span>}
          </p>
          <DataTable value={result.results} size="small" dataKey="ruleCode">
            <Column field="ruleCode" header={t("underwritingRules.ruleCode")} />
            <Column field="condition" header={t("ratingEngine.condition")} />
            <Column header={t("underwritingRules.result")} body={(r) => t(`underwritingRules.outcomes.${r.outcome}`)} />
            <Column field="message" header={t("underwritingRules.message")} />
          </DataTable>
          {result.factors?.length > 0 && (
            <p className="mt-2">{t("ratingEngine.appliedFactors")}: {result.factors.map((f) => `${f.factorCode} ${f.band || ""} × ${f.factor}`).join(", ")}</p>
          )}
        </div>
      )}
    </Dialog>
  );
};

/** Options of the rule editors (risk fields, roles...) from the API. */
const useUnderwritingOptions = () => {
  const [o, setO] = useState({ fields: [], roles: [], operators: OPERATORS, actions: RULE_ACTIONS, types: RULE_TYPES });
  useEffect(() => {
    productConfiguratorService.getUnderwritingOptions().then((d) => setO((prev) => ({ ...prev, ...d }))).catch(() => {});
  }, []);
  return o;
};

/** Template options carrying their code (for the evaluate call). */
const templateCodeOptions = (templates) => templates.map((x) => ({ ...x, code: String(x.label).split(" · ")[0] }));

// ---------------------------------------------------------------- PC-4 Rating Engine

export const RatingEngine = () => {
  const { t } = useTranslation();
  const s = useComponentScreen("rating-factors", t("ratingEngine.failedToLoad"));
  const uw = useUnderwritingOptions();
  const [selected, setSelected] = useState(null);
  const [errors, setErrors] = useState({});
  const [expandedRows, setExpandedRows] = useState(null);
  const [testing, setTesting] = useState(false);
  const typeOptions = [{ label: t("ratingEngine.multiplicative"), value: "Multiplicative" }, { label: t("ratingEngine.additive"), value: "Additive" }, { label: t("ratingEngine.discount"), value: "Discount" }];
  const fieldName = (k) => uw.fields.find((f) => f.value === k)?.label || k || t("ratingEngine.noField");

  const open = (row) => { setErrors({}); setSelected({ ...row, rules: (row.rules || []).map((r) => ({ ...r })) }); };
  const setBand = (i, k, v) => setSelected((x) => ({ ...x, rules: x.rules.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const save = async () => {
    const e = requiredErrors(selected, [["factorCode", t("ratingEngine.factorCode")], ["factorName", t("ratingEngine.factorName")], ["type", t("ratingEngine.type")], ["field", t("ratingEngine.ratesOn")], ...(selected.id ? [] : [["productId", t("productConfigurator.template")]])]);
    if (!(selected.rules || []).length) e.rules = t("ratingEngine.bandsRequired");
    setErrors(e);
    if (hasErrors(e)) {
      s.toast.current?.show({ severity: "warn", summary: t("common.validation"), detail: errorSummary(e) });
      return;
    }
    const payload = { ...selected, rules: selected.rules.map((r) => ({ ...r, factor: Number(r.factor) })) };
    const ok = await persist(() => productConfiguratorService.saveComponent("rating-factors", payload), s.toast, { success: t("ratingEngine.success"), successDetail: t("ratingEngine.saved"), error: t("ratingEngine.error"), errorDetail: t("ratingEngine.failedToSave") });
    if (ok) { setSelected(null); s.reload(); }
  };
  const toggle = async (row) => { if (await toggleComponent("rating-factors", row, s.toast, t)) s.reload(); };

  return (
    <ConfiguratorPage
      screen="rating"
      usage={t("productConfigurator.usage.rating")}
      actions={(
        <>
          <Button label={t("underwritingRules.testRisk")} icon="pi pi-calculator" className="p-button-outlined" onClick={() => setTesting(true)} />
          <Button label={t("ratingEngine.addFactor")} icon="pi pi-plus" onClick={() => open({ rules: [{ condition: "", factor: 1 }], status: "Active" })} />
        </>
      )}
    >
      <Toast ref={s.toast} />
      <FilterBar value={s.filters} onChange={s.setFilters} show={["template", "lob", "status"]} options={s.options} />
      <DataTable
        value={s.rows}
        loading={s.loading}
        dataKey="id"
        {...pagingFor(s.rows.length)}
        expandedRows={expandedRows}
        onRowToggle={(e) => setExpandedRows(e.data)}
        rowExpansionTemplate={(d) => (
          <DataTable value={d.rules || []} size="small">
            <Column field="condition" header={t("ratingEngine.band")} />
            <Column field="factor" header={t("ratingEngine.factor")} />
            <Column field="description" header={t("ratingEngine.description")} />
          </DataTable>
        )}
        emptyMessage={t("productConfigurator.empty")}
        size="small"
      >
        <Column expander style={{ width: "3em" }} />
        <Column field="factorCode" header={t("ratingEngine.factorCode")} sortable />
        <Column field="factorName" header={t("ratingEngine.factorName")} sortable />
        <Column header={t("productConfigurator.templateProduct")} body={templateBody} />
        <Column header={t("ratingEngine.ratesOn")} body={(r) => fieldName(r.field)} />
        <Column field="type" header={t("ratingEngine.type")} body={(r) => <Tag value={r.type} severity={r.type === "Discount" ? "success" : "info"} />} />
        <Column header={t("ratingEngine.bands")} body={(r) => r.rules?.length || 0} />
        <Column field="status" header={t("productConfigurator.filters.status")} body={statusBody} />
        <Column header={t("productConfigurator.actions.title")} body={(r) => <RowActions row={r} onView={(row) => setExpandedRows({ ...(expandedRows || {}), [row.id]: true })} onEdit={open} onToggle={toggle} onHistory={(row) => s.setHistory({ ...row, label: row.factorCode })} />} />
      </DataTable>
      <HistoryDialog kind="rating-factors" row={s.history} onHide={() => s.setHistory(null)} />
      <TestRiskDialog visible={testing} onHide={() => setTesting(false)} templates={templateCodeOptions(s.options.templates)} insurers={s.options.insurers} fields={uw.fields} />

      <Dialog header={t("ratingEngine.configureFactor")} visible={Boolean(selected)} style={{ width: "50rem" }} breakpoints={{ "960px": "95vw" }} onHide={() => setSelected(null)}>
        {selected && (
          <div className="p-fluid">
            {!selected.id && <TemplateField value={selected.productId} options={s.options.templates} onChange={(productId) => setSelected({ ...selected, productId })} error={errors.productId} />}
            <div className="formgrid grid">
              <div className="field col-12 md:col-6">
                <label htmlFor="rf-code">{t("ratingEngine.factorCode")} *</label>
                <InputText id="rf-code" value={selected.factorCode || ""} onChange={(e) => setSelected({ ...selected, factorCode: e.target.value })} />
                <FieldError error={errors.factorCode} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="rf-name">{t("ratingEngine.factorName")} *</label>
                <InputText id="rf-name" value={selected.factorName || ""} onChange={(e) => setSelected({ ...selected, factorName: e.target.value })} />
                <FieldError error={errors.factorName} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="rf-field">{t("ratingEngine.ratesOn")} *</label>
                <Dropdown inputId="rf-field" value={selected.field || null} options={uw.fields} onChange={(e) => setSelected({ ...selected, field: e.value })} />
                <FieldError error={errors.field} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="rf-type">{t("ratingEngine.type")} *</label>
                <Dropdown inputId="rf-type" value={selected.type} options={typeOptions} onChange={(e) => setSelected({ ...selected, type: e.value })} />
                <FieldError error={errors.type} />
              </div>
            </div>
            <label className="block mb-2">{t("ratingEngine.bands")} *</label>
            <small className="block mb-2 pc-muted">{t("ratingEngine.bandsHelp")}</small>
            {(selected.rules || []).map((r, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div className="formgrid grid align-items-center" key={i}>
                <div className="field col-4"><InputText aria-label={t("ratingEngine.band")} value={r.condition || ""} placeholder="0-5" onChange={(e) => setBand(i, "condition", e.target.value)} /></div>
                <div className="field col-2"><InputNumber aria-label={t("ratingEngine.factor")} value={r.factor ?? null} minFractionDigits={0} maxFractionDigits={4} onValueChange={(e) => setBand(i, "factor", e.value)} /></div>
                <div className="field col-5"><InputText aria-label={t("ratingEngine.description")} value={r.description || ""} onChange={(e) => setBand(i, "description", e.target.value)} /></div>
                <div className="field col-1"><IconAction icon="pi pi-trash" label={t("ratingEngine.removeBand")} onClick={() => setSelected({ ...selected, rules: selected.rules.filter((_, j) => j !== i) })} /></div>
              </div>
            ))}
            <FieldError error={errors.rules} />
            <Button label={t("ratingEngine.addBand")} icon="pi pi-plus" className="p-button-text w-auto mb-3" onClick={() => setSelected({ ...selected, rules: [...(selected.rules || []), { condition: "", factor: 1 }] })} />
            <div className="formgrid grid"><div className="field col-12 md:col-6"><StatusField value={selected.status} onChange={(status) => setSelected({ ...selected, status })} /></div></div>
            <div className="flex justify-content-end"><Button label={t("ratingEngine.saveFactor")} icon="pi pi-check" onClick={save} className="w-auto" /></div>
          </div>
        )}
      </Dialog>
    </ConfiguratorPage>
  );
};

// ---------------------------------------------------------------- PC-5 Acceptance Rules

export const UnderwritingRules = () => {
  const { t } = useTranslation();
  const s = useComponentScreen("underwriting-rules", t("underwritingRules.failedToLoad"));
  const uw = useUnderwritingOptions();
  const [selected, setSelected] = useState(null);
  const [errors, setErrors] = useState({});
  const [testing, setTesting] = useState(false);
  const typeOptions = RULE_TYPES.map((v) => ({ label: t(`underwritingRules.types.${v}`), value: v }));
  const actionOptions = RULE_ACTIONS.map((v) => ({ label: t(`underwritingRules.actions.${v}`), value: v }));
  const field = uw.fields.find((f) => f.value === selected?.field);

  const open = (row) => { setErrors({}); setSelected(row); };
  const save = async () => {
    const e = ruleErrors(selected, uw.fields, t);
    setErrors(e);
    if (Object.keys(e).length) {
      s.toast.current?.show({ severity: "warn", summary: t("common.validation"), detail: Object.values(e).join(" · ") });
      return;
    }
    const payload = { ...selected, value: field?.type === "number" && selected.value !== "" && selected.value != null ? Number(selected.value) : field?.type === "boolean" ? true : selected.value };
    const ok = await persist(() => productConfiguratorService.saveComponent("underwriting-rules", payload), s.toast, { success: t("underwritingRules.success"), successDetail: t("underwritingRules.saved"), error: t("underwritingRules.error"), errorDetail: t("underwritingRules.failedToSave") });
    if (ok) { setSelected(null); s.reload(); }
  };
  const toggle = async (row) => { if (await toggleComponent("underwriting-rules", row, s.toast, t)) s.reload(); };
  const insurerChoices = [{ label: t("underwritingRules.allInsurers"), value: null }, ...s.options.insurers.map((o) => ({ label: o.label, value: o.value }))];

  return (
    <ConfiguratorPage
      screen="underwriting"
      usage={t("productConfigurator.usage.underwriting")}
      actions={(
        <>
          <Button label={t("underwritingRules.testRisk")} icon="pi pi-calculator" className="p-button-outlined" onClick={() => setTesting(true)} />
          <Button label={t("underwritingRules.addRule")} icon="pi pi-plus" onClick={() => open({ status: "Active", type: "Acceptance", operator: "<=", action: "Refer" })} />
        </>
      )}
    >
      <Toast ref={s.toast} />
      <FilterBar value={s.filters} onChange={s.setFilters} show={["template", "lob", "insurer", "type", "status"]} options={s.options} typeOptions={typeOptions} />
      <DataTable value={s.rows} loading={s.loading} dataKey="id" {...pagingFor(s.rows.length)} emptyMessage={t("productConfigurator.empty")} size="small">
        <Column header={t("underwritingRules.rule")} sortable sortField="ruleCode" body={(r) => <div className="pc-cell-stack"><span>{r.ruleCode}</span><small className="pc-muted">{r.ruleName}</small></div>} />
        <Column header={t("productConfigurator.templateProduct")} body={templateBody} />
        <Column header={t("underwritingRules.insurer")} body={(r) => insurerText(r, t)} />
        <Column header={t("ratingEngine.condition")} body={(r) => conditionText(r, uw.fields)} />
        <Column header={t("underwritingRules.outcomeColumn")} body={(r) => <Tag value={outcomeText(r, t)} severity={actionSeverity(r.action)} />} />
        <Column header={t("underwritingRules.authorityLevel")} body={(r) => authorityText(r, uw.roles, t)} />
        <Column field="status" header={t("productConfigurator.filters.status")} body={statusBody} />
        <Column header={t("productConfigurator.actions.title")} body={(r) => <RowActions row={r} onView={s.setViewing} onEdit={open} onToggle={toggle} onHistory={(row) => s.setHistory({ ...row, label: row.ruleCode })} />} />
      </DataTable>
      <HistoryDialog kind="underwriting-rules" row={s.history} onHide={() => s.setHistory(null)} />
      <TestRiskDialog visible={testing} onHide={() => setTesting(false)} templates={templateCodeOptions(s.options.templates)} insurers={s.options.insurers} fields={uw.fields} />
      <ViewDialog header={t("productConfigurator.view.rule")} title={s.viewing?.ruleCode} subtitle={s.viewing?.ruleName} status={s.viewing?.status}
        visible={Boolean(s.viewing)} onHide={() => s.setViewing(null)}
        onHistory={() => { s.setHistory({ ...s.viewing, label: s.viewing.ruleCode }); s.setViewing(null); }} rows={s.viewing ? [
        [t("productConfigurator.template"), templateText(s.viewing)], [t("productTemplateManager.product"), productText(s.viewing)], [t("underwritingRules.insurer"), insurerText(s.viewing, t)],
        [t("underwritingRules.type"), t(`underwritingRules.types.${s.viewing.type}`, s.viewing.type)], [t("ratingEngine.condition"), conditionText(s.viewing, uw.fields), { span: "full" }],
        [t("underwritingRules.outcomeColumn"), outcomeText(s.viewing, t)], [t("underwritingRules.authorityLevel"), authorityText(s.viewing, uw.roles, t)],
        [t("underwritingRules.message"), s.viewing.message, { span: "full" }],
        s.viewing.action === "Auto-Accept" ? [t("underwritingRules.otherwiseMessage"), s.viewing.otherwiseMessage, { span: "full" }] : null,
        [t("underwritingRules.exceptions"), (s.viewing.exceptions || []).join(", "), { span: "full" }],
      ] : []} />

      <Dialog header={selected?.id ? t("underwritingRules.editRule") : t("underwritingRules.addRule")} visible={Boolean(selected)} style={{ width: "56rem" }} breakpoints={{ "960px": "95vw" }} onHide={() => setSelected(null)}>
        {selected && (
          <div className="p-fluid">
            <div className="formgrid grid">
              {!selected.id && (
                <div className="col-12 md:col-6"><TemplateField value={selected.productId} options={s.options.templates} onChange={(productId) => setSelected({ ...selected, productId })} error={errors.productId} /></div>
              )}
              <div className="field col-12 md:col-6">
                <label htmlFor="ur-insurer">{t("underwritingRules.insurer")}</label>
                <Dropdown inputId="ur-insurer" value={selected.insurerId ?? null} options={insurerChoices} filter onChange={(e) => setSelected({ ...selected, insurerId: e.value, insurerName: e.value ? s.options.insurers.find((o) => o.value === e.value)?.name : null })} />
                <small className="pc-muted">{t("underwritingRules.insurerHelp")}</small>
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="ur-code">{t("underwritingRules.ruleCode")} *</label>
                <InputText id="ur-code" value={selected.ruleCode || ""} onChange={(e) => setSelected({ ...selected, ruleCode: e.target.value })} />
                <FieldError error={errors.ruleCode} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="ur-name">{t("underwritingRules.ruleName")} *</label>
                <InputText id="ur-name" value={selected.ruleName || ""} onChange={(e) => setSelected({ ...selected, ruleName: e.target.value })} />
                <FieldError error={errors.ruleName} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="ur-type">{t("underwritingRules.type")} *</label>
                <Dropdown inputId="ur-type" value={selected.type} options={typeOptions} onChange={(e) => setSelected({ ...selected, type: e.value })} />
                <FieldError error={errors.type} />
              </div>
              <div className="field col-12 md:col-4">
                <label htmlFor="ur-field">{t("underwritingRules.field")} *</label>
                <Dropdown inputId="ur-field" value={selected.field || null} options={uw.fields} onChange={(e) => setSelected({ ...selected, field: e.value, value: null, valueField: null })} />
                <FieldError error={errors.field} />
              </div>
              <div className="field col-12 md:col-3">
                <label htmlFor="ur-op">{t("underwritingRules.operator")} *</label>
                <Dropdown inputId="ur-op" value={selected.operator || null} options={(field?.type === "number" ? uw.operators : ["=", "!="]).map((o) => ({ label: o, value: o }))} onChange={(e) => setSelected({ ...selected, operator: e.value })} disabled={field?.type === "boolean"} />
                <FieldError error={errors.operator} />
              </div>
              <div className="field col-12 md:col-5">
                <label htmlFor="ur-value">{t("underwritingRules.value")}{field?.type !== "boolean" && !selected.valueField ? " *" : ""}</label>
                {field?.type === "boolean" ? (
                  <InputText id="ur-value" value={t("underwritingRules.whenTrue")} disabled />
                ) : field?.options ? (
                  <Dropdown inputId="ur-value" value={selected.value ?? null} options={field.options.map((o) => ({ label: o, value: o }))} editable onChange={(e) => setSelected({ ...selected, value: e.value })} />
                ) : (
                  <InputText id="ur-value" value={selected.value ?? ""} keyfilter={field?.type === "number" ? "num" : undefined} disabled={Boolean(selected.valueField)} onChange={(e) => setSelected({ ...selected, value: e.target.value })} />
                )}
                <FieldError error={errors.value} />
              </div>
              {field?.type === "number" && (
                <>
                  <div className="field col-12 md:col-6">
                    <label htmlFor="ur-vf">{t("underwritingRules.compareWith")}</label>
                    <Dropdown inputId="ur-vf" value={selected.valueField || null} options={uw.fields.filter((f) => f.type === "number" && f.value !== selected.field)} showClear placeholder={t("underwritingRules.fixedValue")} onChange={(e) => setSelected({ ...selected, valueField: e.value || null, value: e.value ? null : selected.value })} />
                  </div>
                  {selected.valueField && (
                    <div className="field col-12 md:col-6">
                      <label htmlFor="ur-vfx">{t("underwritingRules.factor")}</label>
                      <InputNumber inputId="ur-vfx" value={selected.valueFactor ?? 1} minFractionDigits={0} maxFractionDigits={4} onValueChange={(e) => setSelected({ ...selected, valueFactor: e.value })} />
                    </div>
                  )}
                </>
              )}
              <div className="field col-12 md:col-6">
                <label htmlFor="ur-action">{t("underwritingRules.action")} *</label>
                <Dropdown inputId="ur-action" value={selected.action} options={actionOptions} onChange={(e) => setSelected({ ...selected, action: e.value })} />
                <small className="pc-muted">{t(`underwritingRules.actionHelp.${selected.action || "Refer"}`)}</small>
                <FieldError error={errors.action} />
              </div>
              {selected.action === "Auto-Accept" && (
                <div className="field col-12 md:col-6">
                  <label htmlFor="ur-other">{t("underwritingRules.otherwise")}</label>
                  <Dropdown inputId="ur-other" value={selected.otherwiseAction || "Refer"} options={[{ label: t("underwritingRules.actions.Refer"), value: "Refer" }, { label: t("underwritingRules.actions.Decline"), value: "Decline" }]} onChange={(e) => setSelected({ ...selected, otherwiseAction: e.value })} />
                </div>
              )}
              {selected.action === "Apply Loading" && (
                <div className="field col-12 md:col-6">
                  <label htmlFor="ur-load">{t("underwritingRules.loadingPercent")} *</label>
                  <InputNumber inputId="ur-load" value={selected.loadingPercent ?? null} suffix="%" minFractionDigits={0} maxFractionDigits={2} onValueChange={(e) => setSelected({ ...selected, loadingPercent: e.value })} />
                  <FieldError error={errors.loadingPercent} />
                </div>
              )}
              {refers(selected) && (
                <div className="field col-12 md:col-6">
                  <label htmlFor="ur-role">{t("underwritingRules.authorityLevel")} *</label>
                  <Dropdown inputId="ur-role" value={selected.authorityRole || null} options={uw.roles} onChange={(e) => setSelected({ ...selected, authorityRole: e.value })} placeholder={t("underwritingRules.selectRole")} />
                  <small className="pc-muted">{t("underwritingRules.authorityHelp")}</small>
                  <FieldError error={errors.authorityRole} />
                </div>
              )}
              <div className="field col-12">
                <label htmlFor="ur-msg">{t("underwritingRules.message")}</label>
                <InputText id="ur-msg" value={selected.message || ""} onChange={(e) => setSelected({ ...selected, message: e.target.value })} />
              </div>
              {selected.action === "Auto-Accept" && (
                <div className="field col-12">
                  <label htmlFor="ur-omsg">{t("underwritingRules.otherwiseMessage")}</label>
                  <InputText id="ur-omsg" value={selected.otherwiseMessage || ""} onChange={(e) => setSelected({ ...selected, otherwiseMessage: e.target.value })} />
                </div>
              )}
              <div className="field col-12 md:col-6">
                <label htmlFor="ur-exc">{t("underwritingRules.exceptions")}</label>
                <Chips id="ur-exc" value={selected.exceptions || []} onChange={(e) => setSelected({ ...selected, exceptions: e.value })} />
              </div>
              <div className="field col-12 md:col-6"><StatusField value={selected.status} onChange={(status) => setSelected({ ...selected, status })} /></div>
            </div>
            <p className="pc-muted">{t("underwritingRules.preview")}: {conditionText(selected, uw.fields) || "—"} → {outcomeText(selected, t)}</p>
            <div className="flex justify-content-end"><Button label={t("underwritingRules.saveRule")} icon="pi pi-check" onClick={save} className="w-auto" /></div>
          </div>
        )}
      </Dialog>
    </ConfiguratorPage>
  );
};

// ---------------------------------------------------------------- PC-7 Market Mapping

export const MarketMapping = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const s = useComponentScreen("market-mappings", t("marketMapping.failedToLoad"));
  const [selected, setSelected] = useState(null);
  const [errors, setErrors] = useState({});
  const open = (row) => { setErrors({}); setSelected(row); };
  const save = async () => {
    const e = requiredErrors(selected, [["insurerName", t("marketMapping.insurer")], ["productCode", t("marketMapping.insurerCode")], ...(selected.id ? [] : [["productId", t("productConfigurator.template")]])]);
    setErrors(e);
    if (hasErrors(e)) {
      s.toast.current?.show({ severity: "warn", summary: t("common.validation"), detail: errorSummary(e) });
      return;
    }
    const payload = { ...selected, validFrom: selected.validFrom ? toIsoDate(selected.validFrom) : null, validTo: selected.validTo ? toIsoDate(selected.validTo) : null };
    const ok = await persist(() => productConfiguratorService.saveComponent("market-mappings", payload), s.toast, { success: t("common.success"), successDetail: selected.insurerName, error: t("marketMapping.error"), errorDetail: t("marketMapping.failedToSave") });
    if (ok) { setSelected(null); s.reload(); }
  };
  const toggle = async (row) => { if (await toggleComponent("market-mappings", row, s.toast, t)) s.reload(); };
  const numberField = (field, label, props = {}) => (
    <div className="field col-12 md:col-6">
      <label htmlFor={`mm-${field}`}>{label}</label>
      <InputNumber inputId={`mm-${field}`} value={selected?.[field] ?? null} onValueChange={(e) => setSelected({ ...selected, [field]: e.value })} {...props} />
    </div>
  );
  const insurerFilterRows = s.filters.insurerId ? s.rows.filter((r) => r.insurerName === s.options.insurers.find((o) => o.value === s.filters.insurerId)?.name) : s.rows;

  return (
    <ConfiguratorPage screen="marketMapping" usage={t("productConfigurator.usage.marketMapping")} actions={<Button label={t("marketMapping.mapProduct")} icon="pi pi-plus" onClick={() => open({ status: "Active" })} />}>
      <Toast ref={s.toast} />
      <FilterBar value={s.filters} onChange={s.setFilters} show={["template", "lob", "insurer", "status"]} options={s.options} />
      <DataTable value={insurerFilterRows} loading={s.loading} dataKey="id" {...pagingFor(insurerFilterRows.length)} emptyMessage={t("productConfigurator.empty")} size="small">
        <Column header={t("productConfigurator.templateProduct")} body={templateBody} />
        <Column field="insurerName" header={t("marketMapping.insurer")} sortable />
        <Column field="productCode" header={t("marketMapping.insurerCode")} />
        <Column field="commissionRate" header={t("marketMapping.agreedCommission")} body={(r) => (r.commissionRate == null ? "—" : `${r.commissionRate}%`)} />
        <Column field="targetPremium" header={t("marketMapping.target")} body={(r) => (r.targetPremium ? formatCurrency(r.targetPremium) : "—")} />
        <Column header={t("marketMapping.ytdPerformance")} body={(r) => (
          <div>
            <span>{formatCurrency(r.ytdPremium ?? 0)}</span>
            {r.targetAchievedPercent != null && (
              <>
                <div className="bv-meter">
                  <ProgressBar value={Math.min(100, r.targetAchievedPercent)} showValue={false} aria-label={t("marketMapping.ofTargetAria", { percent: r.targetAchievedPercent })} />
                  <span className="bv-meter__value">{t("marketMapping.ofTargetValue", { percent: r.targetAchievedPercent.toLocaleString(numberLocale(), { maximumFractionDigits: 1 }) })}</span>
                </div>
              </>
            )}
          </div>
        )} />
        <Column field="status" header={t("productConfigurator.filters.status")} body={statusBody} />
        <Column header={t("productConfigurator.actions.title")} body={(r) => <RowActions row={r} onView={s.setViewing} onEdit={open} onToggle={toggle} onHistory={(row) => s.setHistory({ ...row, label: row.insurerName })} />} />
      </DataTable>
      <HistoryDialog kind="market-mappings" row={s.history} onHide={() => s.setHistory(null)} />
      <ViewDialog header={t("productConfigurator.view.mapping")} title={s.viewing?.insurerName} subtitle={s.viewing ? templateText(s.viewing) : null} status={s.viewing?.status}
        visible={Boolean(s.viewing)} onHide={() => s.setViewing(null)}
        onHistory={() => { s.setHistory({ ...s.viewing, label: s.viewing.insurerName }); s.setViewing(null); }} rows={s.viewing ? [
        [t("productTemplateManager.product"), productText(s.viewing)], [t("marketMapping.insurerCode"), s.viewing.productCode],
        [t("marketMapping.agreedCommission"), s.viewing.commissionRate == null ? null : `${s.viewing.commissionRate}%`],
        [t("marketMapping.overridePercent"), s.viewing.overrideRate == null ? null : `${s.viewing.overrideRate}%`],
        [t("marketMapping.profitShare"), s.viewing.profitShare == null ? null : `${s.viewing.profitShare}%`],
        [t("marketMapping.target"), s.viewing.targetPremium || null, { type: "amount" }],
        [t("marketMapping.ytdPerformance"), `${formatCurrency(s.viewing.ytdPremium ?? 0)} (${s.viewing.ytdPolicies ?? 0} ${t("marketMapping.policies")})`],
        [t("marketMapping.valid"), `${formatDate(s.viewing.validFrom)} – ${formatDate(s.viewing.validTo)}`],
        [t("marketMapping.specialTerms"), s.viewing.specialTerms, { span: "full" }],
      ] : []} />

      <Dialog header={selected?.id ? t("marketMapping.editMapping") : t("marketMapping.mapProduct")} visible={Boolean(selected)} style={{ width: "48rem" }} breakpoints={{ "960px": "95vw" }} onHide={() => setSelected(null)}>
        {selected && (
          <div className="p-fluid">
            {!selected.id && <TemplateField value={selected.productId} options={s.options.templates} onChange={(productId) => setSelected({ ...selected, productId })} error={errors.productId} />}
            <div className="formgrid grid">
              <div className="field col-12 md:col-6">
                <label htmlFor="mm-insurer">{t("marketMapping.insurer")} *</label>
                <Dropdown inputId="mm-insurer" value={selected.insurerName || null} options={s.options.insurers.map((o) => ({ label: o.label, value: o.name }))} filter onChange={(e) => setSelected({ ...selected, insurerName: e.value })} />
                <FieldError error={errors.insurerName} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="mm-code">{t("marketMapping.insurerCode")} *</label>
                <InputText id="mm-code" value={selected.productCode || ""} onChange={(e) => setSelected({ ...selected, productCode: e.target.value })} />
                <FieldError error={errors.productCode} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="mm-from">{t("marketMapping.validFrom")}</label>
                <Calendar inputId="mm-from" value={selected.validFrom ? new Date(selected.validFrom) : null} onChange={(e) => setSelected({ ...selected, validFrom: e.value })} showIcon dateFormat={calendarDateFormat()} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="mm-to">{t("marketMapping.validTo")}</label>
                <Calendar inputId="mm-to" value={selected.validTo ? new Date(selected.validTo) : null} onChange={(e) => setSelected({ ...selected, validTo: e.value })} showIcon dateFormat={calendarDateFormat()} />
              </div>
              {numberField("commissionRate", t("marketMapping.agreedCommission"), { suffix: "%", maxFractionDigits: 2 })}
              {numberField("overrideRate", t("marketMapping.overridePercent"), { suffix: "%", maxFractionDigits: 2 })}
              {numberField("profitShare", t("marketMapping.profitShare"), { suffix: "%", maxFractionDigits: 2 })}
              {numberField("targetPremium", t("marketMapping.target"), { maxFractionDigits: 2 })}
              <div className="field col-12">
                <label htmlFor="mm-terms">{t("marketMapping.specialTerms")}</label>
                <InputText id="mm-terms" value={selected.specialTerms || ""} onChange={(e) => setSelected({ ...selected, specialTerms: e.target.value })} />
              </div>
              <div className="field col-12 md:col-6"><StatusField value={selected.status} onChange={(status) => setSelected({ ...selected, status })} /></div>
            </div>
            <small className="block mb-3 pc-muted">{t("marketMapping.commissionNote")}</small>
            <div className="flex justify-content-end"><Button label={t("common.save")} icon="pi pi-check" onClick={save} className="w-auto" /></div>
          </div>
        )}
      </Dialog>
    </ConfiguratorPage>
  );
};

// ---------------------------------------------------------------- PC-8 Document Manager

const PRINT_AS = ["policy-schedule", "ctpl-certificate", "quotation-slip", "member-enrollment"];

export const DocumentManager = () => {
  const { t } = useTranslation();
  const s = useComponentScreen("documents", t("documentManager.failedToLoad"));
  const [selected, setSelected] = useState(null);
  const [errors, setErrors] = useState({});
  const [merge, setMerge] = useState({ fields: [], blocks: [], extensions: [".txt", ".md"], defaults: {} });
  const [showFields, setShowFields] = useState(false);
  const printAsOptions = PRINT_AS.map((v) => ({ label: t(`documentManager.printAsOptions.${v}`), value: v }));
  useEffect(() => {
    productConfiguratorService.getMergeFields().then(setMerge).catch(() => {});
  }, []);

  const open = (row) => { setErrors({}); setSelected({ ...row }); };
  const readLayout = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const error = layoutFileError(file, text, merge.fields, merge.blocks, t);
      setErrors((e) => ({ ...e, layout: error }));
      if (!error) setSelected((x) => ({ ...x, layout: text, layoutFileName: file.name, layoutChanged: true }));
    };
    reader.readAsText(file);
  };
  const save = async () => {
    const e = requiredErrors(selected, [["documentCode", t("documentManager.documentCode")], ["documentName", t("documentManager.documentName")], ["type", t("documentManager.type")], ["printAs", t("documentManager.printAs")], ...(selected.id ? [] : [["productId", t("productConfigurator.template")]])]);
    if (errors.layout) e.layout = errors.layout;
    setErrors(e);
    if (hasErrors(e)) {
      s.toast.current?.show({ severity: "warn", summary: t("common.validation"), detail: errorSummary(e) });
      return;
    }
    const { layoutChanged, removeLayout, hasLayout, ...rest } = selected;
    const payload = { ...rest, format: "PDF" };
    if (removeLayout) { payload.layout = null; payload.layoutFileName = null; } else if (!layoutChanged) { delete payload.layout; delete payload.layoutFileName; }
    const ok = await persist(() => productConfiguratorService.saveComponent("documents", payload), s.toast, { success: t("common.success"), successDetail: selected.documentName, error: t("documentManager.error"), errorDetail: t("documentManager.failedToSave") });
    if (ok) { setSelected(null); s.reload(); }
  };
  const toggle = async (row) => { if (await toggleComponent("documents", row, s.toast, t)) s.reload(); };
  const guarded = (fn) => async (row) => {
    try { await fn(row); } catch (e) { s.toast.current?.show({ severity: "error", summary: t("documentManager.error"), detail: e.message }); }
  };
  const preview = guarded((row) => productConfiguratorService.previewDocument(row.id));
  const download = guarded((row) => productConfiguratorService.downloadLayout(row.id, row.layoutFileName || `${row.documentCode}-layout.txt`));
  const used = selected?.layoutChanged ? layoutPlaceholders(selected.layout, merge.fields, merge.blocks).used : (selected?.variables || []);

  return (
    <ConfiguratorPage
      screen="documents"
      usage={t("productConfigurator.usage.documents")}
      actions={(
        <>
          <Button label={t("documentManager.mergeFields")} icon="pi pi-list" className="p-button-outlined" onClick={() => setShowFields(true)} />
          <Button label={t("documentManager.addTemplate")} icon="pi pi-plus" onClick={() => open({ status: "Active", type: "Policy Document", stage: "Policy Issuance", mandatory: true })} />
        </>
      )}
    >
      <Toast ref={s.toast} />
      <FilterBar value={s.filters} onChange={s.setFilters} show={["template", "lob", "status"]} options={s.options} />
      <DataTable value={s.rows} loading={s.loading} dataKey="id" {...pagingFor(s.rows.length)} emptyMessage={t("productConfigurator.empty")} size="small">
        <Column header={t("documentManager.document")} sortable sortField="documentCode" body={(r) => <div className="pc-cell-stack"><span>{r.documentCode}</span><small className="pc-muted">{r.documentName}</small></div>} />
        <Column header={t("productConfigurator.templateProduct")} body={templateBody} />
        <Column header={t("documentManager.printAs")} body={(r) => (r.printAs ? t(`documentManager.printAsOptions.${r.printAs}`) : <span className="pc-muted">{t("documentManager.notPrinted")}</span>)} />
        <Column field="stage" header={t("documentManager.stage")} />
        <Column header={t("documentManager.layout")} body={(r) => (r.hasLayout ? <Tag value={t("documentManager.uploaded", { file: r.layoutFileName || "" })} severity="info" /> : <span className="pc-muted">{t("documentManager.standardLayout")}</span>)} />
        <Column field="status" header={t("productConfigurator.filters.status")} body={statusBody} />
        <Column
          header={t("productConfigurator.actions.title")}
          body={(r) => (
            <RowActions
              row={r}
              onView={preview}
              onEdit={open}
              onToggle={toggle}
              onHistory={(row) => s.setHistory({ ...row, label: row.documentCode })}
              extra={<IconAction icon="pi pi-download" label={t("documentManager.download")} onClick={() => download(r)} />}
            />
          )}
        />
      </DataTable>
      <HistoryDialog kind="documents" row={s.history} onHide={() => s.setHistory(null)} />

      <Dialog header={t("documentManager.mergeFields")} visible={showFields} onHide={() => setShowFields(false)} style={{ width: "48rem" }} breakpoints={{ "960px": "95vw" }}>
        <p>{t("documentManager.formatHelp", { extensions: (merge.extensions || []).join(", ") })}</p>
        <pre className="pc-layout-text">{"= Title {{PolicyNumber}}\n# Section heading\nLabel: {{InsuredName}}\nAny other line is printed as a paragraph.\n{{#Premium}}"}</pre>
        <DataTable value={[...merge.fields.map((f) => ({ ...f, code: `{{${f.name}}}` })), ...merge.blocks.map((b) => ({ ...b, code: `{{#${b.name}}}` }))]} size="small" dataKey="code" {...pagingFor(merge.fields.length + merge.blocks.length, 15)} rows={15}>
          <Column field="code" header={t("documentManager.placeholder")} />
          <Column field="label" header={t("documentManager.meaning")} />
        </DataTable>
      </Dialog>

      <Dialog header={selected?.id ? t("documentManager.editTemplate") : t("documentManager.addTemplate")} visible={Boolean(selected)} style={{ width: "50rem" }} breakpoints={{ "960px": "95vw" }} onHide={() => setSelected(null)}>
        {selected && (
          <div className="p-fluid">
            {!selected.id && <TemplateField value={selected.productId} options={s.options.templates} onChange={(productId) => setSelected({ ...selected, productId })} error={errors.productId} />}
            <div className="formgrid grid">
              <div className="field col-12 md:col-6">
                <label htmlFor="dm-code">{t("documentManager.documentCode")} *</label>
                <InputText id="dm-code" value={selected.documentCode || ""} onChange={(e) => setSelected({ ...selected, documentCode: e.target.value })} />
                <FieldError error={errors.documentCode} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="dm-name">{t("documentManager.documentName")} *</label>
                <InputText id="dm-name" value={selected.documentName || ""} onChange={(e) => setSelected({ ...selected, documentName: e.target.value })} />
                <FieldError error={errors.documentName} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="dm-print">{t("documentManager.printAs")} *</label>
                <Dropdown inputId="dm-print" value={selected.printAs || null} options={printAsOptions} onChange={(e) => setSelected({ ...selected, printAs: e.value })} />
                <FieldError error={errors.printAs} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="dm-type">{t("documentManager.type")} *</label>
                <InputText id="dm-type" value={selected.type || ""} onChange={(e) => setSelected({ ...selected, type: e.target.value })} />
                <FieldError error={errors.type} />
              </div>
              <div className="field col-12 md:col-6">
                <label htmlFor="dm-stage">{t("documentManager.stage")}</label>
                <Dropdown inputId="dm-stage" value={selected.stage || null} options={["Quotation", "Policy Issuance"].map((v) => ({ label: t(`documentManager.stages.${v}`), value: v }))} onChange={(e) => setSelected({ ...selected, stage: e.value })} />
              </div>
              <div className="field col-12 md:col-6"><StatusField value={selected.status} onChange={(status) => setSelected({ ...selected, status })} /></div>
              <div className="field col-12 flex align-items-center gap-2">
                <Checkbox inputId="dm-req" checked={Boolean(selected.mandatory)} onChange={(e) => setSelected({ ...selected, mandatory: e.checked })} />
                <label htmlFor="dm-req">{t("documentManager.required")}</label>
              </div>
              <div className="field col-12">
                <label htmlFor="dm-file">{t("documentManager.uploadLayout")}</label>
                <input id="dm-file" type="file" accept={(merge.extensions || [".txt", ".md"]).join(",")} onChange={(e) => readLayout(e.target.files?.[0])} />
                <small className="block mt-1 pc-muted">{t("documentManager.uploadHelp", { extensions: (merge.extensions || []).join(", ") })}</small>
                <FieldError error={errors.layout} />
                {(selected.layoutChanged || selected.hasLayout) && !selected.removeLayout && (
                  <div className="mt-2 flex align-items-center gap-2">
                    <Tag value={t("documentManager.uploaded", { file: selected.layoutFileName || "" })} severity="info" />
                    <Button type="button" label={t("documentManager.useStandard")} className="p-button-text w-auto" onClick={() => setSelected({ ...selected, removeLayout: true, layoutChanged: false })} />
                  </div>
                )}
                {used.length > 0 && <small className="block mt-1">{t("documentManager.fieldsUsed", { fields: used.join(", ") })}</small>}
              </div>
            </div>
            <div className="flex justify-content-end"><Button label={t("common.save")} icon="pi pi-check" onClick={save} className="w-auto" /></div>
          </div>
        )}
      </Dialog>
    </ConfiguratorPage>
  );
};

// ---------------------------------------------------------------- PC-9 Product Analytics

export const ProductAnalytics = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const chart = useChartTheme();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useRef(null);

  useEffect(() => {
    productConfiguratorService
      .getProductAnalytics()
      .then(setAnalytics)
      .catch((error) => toast.current?.show({ severity: "error", summary: t("productAnalytics.error"), detail: error?.message || t("productAnalytics.failedToLoad") }))
      .finally(() => setLoading(false));
  }, [t]);

  const top = analytics?.topProducts || [];
  const trend = analytics?.performanceTrend || [];
  const hasData = top.length > 0;
  const performanceChart = { labels: trend.map((tr) => tr.month), datasets: [{ label: t("productAnalytics.premiumPhpMillions"), data: trend.map((tr) => tr.premium / 1000000), backgroundColor: chart.alpha(chart.primary, 0.15), borderColor: chart.primary, tension: 0 }] };
  const categories = Object.entries(analytics?.categoryBreakdown || {});
  const categoryChart = { labels: categories.map(([k]) => k), datasets: [{ data: categories.map(([, c]) => c.premium / 1000000), backgroundColor: chart.series(categories.length), borderColor: chart.surface }] };

  return (
    <ConfiguratorPage screen="analytics" usage={t("productConfigurator.usage.analytics")}>
      <Toast ref={toast} />
      <div className="pc-kpis">
        <div className="pc-kpi"><span>{t("productAnalytics.totalPremium")}</span><strong>{formatCurrency(analytics?.totals?.premium ?? 0)}</strong></div>
        <div className="pc-kpi"><span>{t("productAnalytics.policies")}</span><strong>{(analytics?.totals?.policies ?? 0).toLocaleString(numberLocale())}</strong></div>
        <div className="pc-kpi"><span>{t("productAnalytics.products")}</span><strong>{top.length}</strong></div>
      </div>
      {!loading && !hasData ? (
        <div className="pc-empty">{t("productAnalytics.noData")}</div>
      ) : (
        <>
          <div className="grid">
            <div className="col-12 lg:col-8">
              <h3 className="mt-0">{t("productAnalytics.premiumTrend")}</h3>
              <Chart type="line" data={performanceChart} options={chart.options({ scales: { x: {}, y: {} } })} aria-label={t("productAnalytics.premiumTrend")} />
            </div>
            <div className="col-12 lg:col-4">
              <h3 className="mt-0">{t("productAnalytics.categoryDistribution")}</h3>
              <Chart type="doughnut" data={categoryChart} options={chart.options({})} aria-label={t("productAnalytics.categoryDistribution")} />
            </div>
          </div>
          <h3>{t("productAnalytics.topProductsPerformance")}</h3>
          <DataTable value={top} loading={loading} dataKey="productId" {...pagingFor(top.length)} size="small">
            <Column field="productName" header={t("productAnalytics.product")} />
            <Column field="totalPolicies" header={t("productAnalytics.policies")} sortable body={(r) => r.totalPolicies.toLocaleString(numberLocale())} />
            <Column field="totalPremium" header={t("productAnalytics.premium")} sortable body={(r) => formatCurrency(r.totalPremium)} />
            <Column field="avgPremium" header={t("productAnalytics.avgPremium")} sortable body={(r) => formatCurrency(r.avgPremium)} />
            <Column field="lossRatio" header={t("productAnalytics.lossRatio")} sortable body={(r) => `${r.lossRatio}%`} />
            <Column field="profitMargin" header={t("productAnalytics.profitMargin")} sortable body={(r) => <Tag value={`${r.profitMargin}%`} severity={r.profitMargin >= 0 ? "success" : "danger"} />} />
            <Column field="growth" header={t("productAnalytics.growth")} sortable body={(r) => `${r.growth > 0 ? "+" : ""}${r.growth}%`} />
          </DataTable>
        </>
      )}
    </ConfiguratorPage>
  );
};
