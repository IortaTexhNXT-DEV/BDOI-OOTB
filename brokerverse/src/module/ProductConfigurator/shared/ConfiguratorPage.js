/**
 * Building blocks shared by every Product Configurator screen, so that they look and behave the same: the page header
 * (title and "Product Configurator • <screen>" breadcrumb), the "how this is used" note, the filter bar, the row
 * actions (view / edit / activate-deactivate / history as brand-blue icon buttons with tooltips), status tags in the
 * app's status colours, template / product cells (codes with names), paging only when there is more than one page,
 * and the change-history dialog.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import { statusSeverity, statusLabel } from "../../../utils/statusSeverity";
import { PAGE_SIZE, clientPaging } from "../../../hooks/useServerList";
import productConfiguratorService from "../../../services/productConfiguratorService";
import mastersService from "../../../services/mastersService";
import { formatDate } from "../../../utility/dateFormat";
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

/** Activate / deactivate a component (status only), with the outcome on the toast. */
export const toggleComponent = async (kind, row, toast, t) => {
  const status = row.status === "Active" ? "Inactive" : "Active";
  try {
    await productConfiguratorService.updateComponent(kind, row.id, { status });
    toast.current?.show({ severity: "success", summary: t("common.success"), detail: t(status === "Active" ? "productConfigurator.activated" : "productConfigurator.deactivated") });
    return true;
  } catch (error) {
    toast.current?.show({ severity: "error", summary: t("productConfigurator.error"), detail: error?.message });
    return false;
  }
};

const valueText = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(valueText).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** Change history of a component (or a template when kind is "template"). */
export const HistoryDialog = ({ kind, row, onHide }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!row) return;
    setLoading(true);
    setError(null);
    const call = kind === "template" ? productConfiguratorService.getTemplateHistory(row.id)
      : kind === "risk-mapping" ? productConfiguratorService.getRiskMappingHistory(row.id) : productConfiguratorService.getComponentHistory(kind, row.id);
    call.then((data) => setRows(data || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [kind, row]);
  const flat = rows.flatMap((h) => (h.changes?.length ? h.changes.map((c, i) => ({ ...h, key: `${h.id}-${i}`, field: c.field, from: c.from, to: c.to })) : [{ ...h, key: `${h.id}` }]));
  return (
    <Dialog header={t("productConfigurator.history.title", { name: row?.label || "" })} visible={Boolean(row)} onHide={onHide} style={{ width: "52rem" }} breakpoints={{ "960px": "95vw" }}>
      {error && <p className="pc-error">{error}</p>}
      <DataTable value={flat} loading={loading} dataKey="key" emptyMessage={t("productConfigurator.history.empty")} size="small" {...pagingFor(flat.length, 10)} rows={10}>
        <Column header={t("productConfigurator.history.when")} body={(h) => formatDate(h.at, { withTime: true })} />
        <Column field="user" header={t("productConfigurator.history.user")} />
        <Column header={t("productConfigurator.history.action")} body={(h) => statusLabel(h.action)} />
        <Column field="field" header={t("productConfigurator.history.field")} />
        <Column header={t("productConfigurator.history.from")} body={(h) => valueText(h.from)} />
        <Column header={t("productConfigurator.history.to")} body={(h) => valueText(h.to)} />
      </DataTable>
    </Dialog>
  );
};
HistoryDialog.propTypes = { kind: PropTypes.string.isRequired, row: PropTypes.object, onHide: PropTypes.func.isRequired };

/** Read-only view of a record: label / value pairs. */
export const ViewDialog = ({ header, rows, visible, onHide }) => (
  <Dialog header={header} visible={visible} onHide={onHide} style={{ width: "40rem" }} breakpoints={{ "960px": "95vw" }}>
    <dl className="pc-view">
      {rows.filter(Boolean).map(([label, value]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </React.Fragment>
      ))}
    </dl>
  </Dialog>
);
ViewDialog.propTypes = { header: PropTypes.node, rows: PropTypes.array.isRequired, visible: PropTypes.bool, onHide: PropTypes.func.isRequired };
