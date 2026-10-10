/**
 * Building blocks shared by every Product Configurator screen, so that they look and behave the same: the page header
 * (title and "Product Configurator • <screen>" breadcrumb), the "how this is used" note, the filter bar, the row
 * actions (view / edit / activate-deactivate / history as brand-blue icon buttons with tooltips), status tags in the
 * app's status colours, template / product cells (codes with names), paging only when there is more than one page,
 * the confirmation of activating or deactivating a record, the record view and the change-history dialog.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import { statusSeverity, statusLabel } from "../../../utils/statusSeverity";
import { PAGE_SIZE, clientPaging } from "../../../hooks/useServerList";
import productConfiguratorService from "../../../services/productConfiguratorService";
import mastersService from "../../../services/mastersService";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailDialog from "../../../components/DetailDialog";
import DetailHeader from "../../../components/DetailHeader";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { ActivityLog, fromConfigurationHistory } from "../../../components/ActivityLog";
import "./configurator.scss";

/** Paginator props only when the rows fill more than one page. */
export const pagingFor = (count, pageSize = PAGE_SIZE) => (count > pageSize ? clientPaging : { paginator: false });

/** "MOT-003-2025 · Motor Insurance Basic Plan" */
export const templateText = (row) => [row?.templateCode, row?.templateName].filter(Boolean).join(" · ");
/** "MOTOR · Motor Vehicle Insurance": the product master of a component's template (lists) or of a template. */
export const productText = (row) => (row && "productMasterCode" in row
  ? [row.productMasterCode, row.productMasterName]
  : [row?.productCode, row?.productName]).filter(Boolean).join(" · ");

/** Template (code and name) with its product (code and name) underneath; global rows apply to every product. */
export const TemplateCell = ({ row }) => {
  const { t } = useTranslation();
  if (!row?.templateCode) return <span>{t("productConfigurator.allProducts")}</span>;
  return (
    <div className="pc-cell-stack">
      <span>{templateText(row)}</span>
      {productText(row) && <small className="pc-muted">{productText(row)}</small>}
      {row.templateInUse === false && (
        <Tag className="pc-not-applied" value={t("productConfigurator.notApplied")} severity="secondary" title={t("productConfigurator.notAppliedHelp")} />
      )}
    </div>
  );
};
TemplateCell.propTypes = { row: PropTypes.object };

/** Status tag in the colours of every other list (utils/statusSeverity). */
export const StatusTag = ({ status }) => (status ? <Tag value={statusLabel(status)} severity={statusSeverity(status)} /> : null);
StatusTag.propTypes = { status: PropTypes.string };

/** Brand-blue icon button with a tooltip and an accessible name. */
export const IconAction = ({ icon, label, onClick, disabled = false, testId }) => (
  <Button
    type="button"
    icon={icon}
    className="p-button-text p-button-rounded pc-icon-action"
    tooltip={label}
    tooltipOptions={{ position: "top" }}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
  />
);
IconAction.propTypes = { icon: PropTypes.string.isRequired, label: PropTypes.string.isRequired, onClick: PropTypes.func, disabled: PropTypes.bool, testId: PropTypes.string };

/** The row actions of every configurator list: view, edit, activate / deactivate, history (each optional). */
export const RowActions = ({ row, onView, onEdit, onToggle, onHistory, extra = null }) => {
  const { t } = useTranslation();
  const active = row?.status === "Active";
  return (
    <div className="pc-row-actions">
      {onView && <IconAction icon="pi pi-eye" label={t("productConfigurator.actions.view")} onClick={() => onView(row)} />}
      {onEdit && <IconAction icon="pi pi-pencil" label={t("productConfigurator.actions.edit")} onClick={() => onEdit(row)} />}
      {extra}
      {onToggle && (
        <IconAction
          icon={active ? "pi pi-ban" : "pi pi-check-circle"}
          label={active ? t("productConfigurator.actions.deactivate") : t("productConfigurator.actions.activate")}
          onClick={() => onToggle(row)}
        />
      )}
      {onHistory && <IconAction icon="pi pi-history" label={t("productConfigurator.actions.history")} onClick={() => onHistory(row)} />}
    </div>
  );
};
RowActions.propTypes = { row: PropTypes.object, onView: PropTypes.func, onEdit: PropTypes.func, onToggle: PropTypes.func, onHistory: PropTypes.func, extra: PropTypes.node };

/**
 * Page frame: title, breadcrumb "Product Configurator • <screen>", actions on the right, the note on how the screen's
 * configuration is used by the business flow, then the content card.
 */
export const ConfiguratorPage = ({ screen, actions = null, usage = null, children, className = "" }) => {
  const { t } = useTranslation();
  const title = t(`productConfigurator.screens.${screen}`);
  return (
    <div className={`pc-page ${className}`}>
      <div className="pc-page__head">
        <div>
          <h1 className="pc-page__title">{title}</h1>
          <BreadCrumb
            model={[{ label: title }]}
            home={{ label: t("productConfigurator.title") }}
            separatorIcon={<SvgDot color="#000" />}
            className="pc-page__crumbs"
            aria-label={t("productConfigurator.breadcrumb")}
          />
        </div>
        {actions && <div className="pc-page__actions">{actions}</div>}
      </div>
      {usage && (
        <div className="pc-usage" role="note">
          <i className="pi pi-info-circle" aria-hidden="true" />
          <span>{usage}</span>
        </div>
      )}
      <Card className="pc-page__card">{children}</Card>
    </div>
  );
};
ConfiguratorPage.propTypes = { screen: PropTypes.string.isRequired, actions: PropTypes.node, usage: PropTypes.node, children: PropTypes.node, className: PropTypes.string };

/** Dropdown options for the filters: templates (code · name), lines of business and insurers. */
export const useFilterOptions = () => {
  const [options, setOptions] = useState({ templates: [], lobs: [], insurers: [] });
  useEffect(() => {
    let alive = true;
    Promise.all([
      productConfiguratorService.getProductTemplates().catch(() => []),
      mastersService.options("line-of-business").catch(() => []),
      mastersService.options("insurance-company").catch(() => []),
    ]).then(([templates, lobs, insurers]) => {
      if (!alive) return;
      setOptions({
        templates: (templates || [])
          .filter((row) => row.status !== "Retired")
          .map((row) => ({ label: `${row.templateCode} · ${row.name}${row.productCode ? ` (${row.productCode})` : ""}`, value: row.id, lob: row.lineOfBusiness })),
        lobs: (lobs || []).map((o) => ({ label: `${o.code} · ${o.label}`, value: o.code })),
        insurers: (insurers || []).map((o) => ({ label: o.label, value: o.id, name: o.label })),
      });
    });
    return () => {
      alive = false;
    };
  }, []);
  return options;
};

export const STATUS_OPTIONS = ["Active", "Inactive", "Draft"];

/**
 * Filter bar: search box and the dropdown filters named in `show` (template, lob, insurer, status, type).
 * `value` holds { search, templateId, lineOfBusiness, insurerId, status, type }.
 */
export const FilterBar = ({ value, onChange, show = [], options, typeOptions = [], searchPlaceholder }) => {
  const { t } = useTranslation();
  const set = (k) => (e) => onChange({ ...value, [k]: e.value ?? e.target?.value ?? null });
  return (
    <div className="pc-filters" role="search">
      <span className="p-input-icon-left pc-filters__search">
        <i className="pi pi-search" aria-hidden="true" />
        <InputText
          value={value.search || ""}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder={searchPlaceholder || t("productConfigurator.filters.search")}
          aria-label={t("productConfigurator.filters.search")}
        />
      </span>
      {show.includes("template") && (
        <Dropdown value={value.templateId ?? null} options={options.templates} onChange={set("templateId")} filter showClear
          placeholder={t("productConfigurator.filters.template")} aria-label={t("productConfigurator.filters.template")} className="pc-filters__field" />
      )}
      {show.includes("lob") && (
        <Dropdown value={value.lineOfBusiness ?? null} options={options.lobs} onChange={set("lineOfBusiness")} filter showClear
          placeholder={t("productConfigurator.filters.lineOfBusiness")} aria-label={t("productConfigurator.filters.lineOfBusiness")} className="pc-filters__field" />
      )}
      {show.includes("insurer") && (
        <Dropdown value={value.insurerId ?? null} options={options.insurers} onChange={set("insurerId")} filter showClear
          placeholder={t("productConfigurator.filters.insurer")} aria-label={t("productConfigurator.filters.insurer")} className="pc-filters__field" />
      )}
      {show.includes("type") && (
        <Dropdown value={value.type ?? null} options={typeOptions} onChange={set("type")} showClear
          placeholder={t("productConfigurator.filters.type")} aria-label={t("productConfigurator.filters.type")} className="pc-filters__field" />
      )}
      {show.includes("status") && (
        <Dropdown value={value.status ?? null} options={STATUS_OPTIONS.map((s) => ({ label: statusLabel(s), value: s }))} onChange={set("status")} showClear
          placeholder={t("productConfigurator.filters.status")} aria-label={t("productConfigurator.filters.status")} className="pc-filters__field" />
      )}
    </div>
  );
};
FilterBar.propTypes = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired, show: PropTypes.arrayOf(PropTypes.string), options: PropTypes.object, typeOptions: PropTypes.array, searchPlaceholder: PropTypes.string };

/** API query of the filters (empty ones left out). */
export const filterParams = (f) => {
  const out = {};
  if (f.search && f.search.trim()) out.search = f.search.trim();
  if (f.templateId) out.templateId = f.templateId;
  if (f.lineOfBusiness) out.lineOfBusiness = f.lineOfBusiness;
  if (f.insurerId) out.insurerId = f.insurerId;
  if (f.status) out.status = f.status;
  if (f.type) out.type = f.type;
  return out;
};

/** Components of one kind, filtered by the server; a typed search waits for a pause in typing. */
export const useComponentRows = (kind, filters, toast, errorText) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const key = JSON.stringify(filterParams(filters));
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const data = await productConfiguratorService.listComponents(kind, JSON.parse(key));
      if (mine === seq.current) setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      if (mine === seq.current) toast.current?.show({ severity: "error", summary: errorText, detail: error?.message });
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [kind, key, toast, errorText]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);
  return { rows, loading, reload: load };
};

/**
 * Ask before activating or deactivating a configuration record (deactivating changes what new quotations get);
 * `record` names it: { code, name } shown as facts. Resolves true when confirmed and `run` succeeded (an error stays
 * in the dialog).
 */
export const confirmStatusChange = ({ deactivate, kindLabel, record, t, run, confirmLabel, message, note }) =>
  openConfirm({
    title: t(deactivate ? "productConfigurator.status.deactivateTitle" : "productConfigurator.status.activateTitle", { kind: kindLabel }),
    severity: deactivate ? "warning" : "neutral",
    message: message || t(deactivate ? "productConfigurator.status.deactivateMessage" : "productConfigurator.status.activateMessage"),
    facts: [
      { label: t("productConfigurator.status.recordType"), value: kindLabel },
      { label: t("productConfigurator.status.code"), value: record.code, hidden: !record.code },
      { label: t("productConfigurator.status.name"), value: record.name, hidden: !record.name },
      { label: t("productConfigurator.template"), value: record.template, hidden: !record.template },
    ],
    note: note === undefined ? (deactivate ? t("productConfigurator.status.deactivateNote") : null) : note,
    confirmLabel: confirmLabel || t(deactivate ? "productConfigurator.actions.deactivate" : "productConfigurator.actions.activate"),
    onConfirm: run,
  });

const COMPONENT_IDENTITY = {
  coverages: (r) => ({ code: r.coverageCode, name: r.coverageName }),
  "rating-factors": (r) => ({ code: r.factorCode, name: r.factorName || r.name }),
  "underwriting-rules": (r) => ({ code: r.ruleCode, name: r.ruleName }),
  "market-mappings": (r) => ({ code: r.productCode, name: r.insurerName }),
  documents: (r) => ({ code: r.documentCode || r.code, name: r.documentName || r.name }),
};

/** Activate / deactivate a component (status only) once confirmed, with the outcome on the toast. */
export const toggleComponent = async (kind, row, toast, t) => {
  const status = row.status === "Active" ? "Inactive" : "Active";
  const identity = (COMPONENT_IDENTITY[kind] || ((r) => ({ code: r.code, name: r.name })))(row);
  const done = await confirmStatusChange({
    deactivate: status === "Inactive",
    kindLabel: t(`productConfigurator.kinds.${kind}`),
    record: { ...identity, template: templateText(row) },
    t,
    run: () => productConfiguratorService.updateComponent(kind, row.id, { status }),
  });
  if (!done) return false;
  toast.current?.show({ severity: "success", summary: t("common.success"), detail: t(status === "Active" ? "productConfigurator.activated" : "productConfigurator.deactivated") });
  return true;
};

/** Change history of a component (or a template when kind is "template"): who changed what, newest first. */
export const HistoryDialog = ({ kind, row, onHide }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    if (!row) return;
    setLoading(true);
    setError(null);
    const call = kind === "template" ? productConfiguratorService.getTemplateHistory(row.id)
      : kind === "risk-mapping" ? productConfiguratorService.getRiskMappingHistory(row.id) : productConfiguratorService.getComponentHistory(kind, row.id);
    call.then((data) => setRows(data || [])).catch((e) => setError(e.message || true)).finally(() => setLoading(false));
  }, [kind, row]);
  useEffect(() => {
    load();
  }, [load]);
  if (!row) return null;
  return (
    <DetailDialog visible onHide={onHide} header={t("productConfigurator.history.title", { name: row.label || "" })} size="md">
      <ActivityLog entries={fromConfigurationHistory(rows)} loading={loading} error={error} onRetry={load} emptyText={t("productConfigurator.history.empty")} />
    </DetailDialog>
  );
};
HistoryDialog.propTypes = { kind: PropTypes.string.isRequired, row: PropTypes.object, onHide: PropTypes.func.isRequired };

/**
 * Read-only view of a record: its code and name with the status chip, then the facts as label above value. `rows` are
 * [label, value, { span, type }] (span "full" for long texts); `onHistory` adds a History button to the footer.
 */
export const ViewDialog = ({ header, title, subtitle, status, rows, visible, onHide, onHistory }) => {
  const { t } = useTranslation();
  if (!visible) return null;
  const items = rows.filter(Boolean).map(([label, value, options]) => ({ label, value, ...(options || {}) }));
  const footer = (
    <>
      {onHistory ? <Button type="button" label={t("productConfigurator.actions.history")} icon="pi pi-history" text onClick={onHistory} /> : null}
      <Button type="button" label={t("productConfigurator.close")} outlined onClick={() => onHide()} />
    </>
  );
  return (
    <DetailDialog visible onHide={onHide} header={header} size="md" footer={footer}>
      {title ? <DetailHeader title={title} subtitle={subtitle} status={status ? { code: String(status).toLowerCase(), label: statusLabel(status) } : null} /> : null}
      <KeyValueGrid columns={2} items={items} />
    </DetailDialog>
  );
};
ViewDialog.propTypes = {
  header: PropTypes.node,
  /** the record's code (or name) above the facts, with its status chip */
  title: PropTypes.node,
  subtitle: PropTypes.node,
  status: PropTypes.string,
  rows: PropTypes.array.isRequired,
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  onHistory: PropTypes.func,
};
