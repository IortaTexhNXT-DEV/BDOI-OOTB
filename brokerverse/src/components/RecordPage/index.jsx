import React, { useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { Sidebar } from "primereact/sidebar";
import { Tag } from "primereact/tag";
import SvgDot from "../../assets/icons/SvgDot";
import { statusLabel, statusSeverity } from "../../utils/statusSeverity";
import "./index.scss";

/**
 * Building blocks of the operations screens (claims, client view, renewals, audit trail): one page header, a strip of
 * key facts, section cards, row actions and empty states, so every screen of a record reads the same way.
 */

/** Status chip in the shared colour scheme (utils/statusSeverity); `label` overrides the text shown. */
export const StatusChip = ({ status, label, severity, className }) => {
  if (!status && !label) return null;
  return <Tag className={`bv-chip ${className}`} value={label || statusLabel(status)} severity={severity || statusSeverity(status)} />;
};
StatusChip.propTypes = { status: PropTypes.string, label: PropTypes.node, severity: PropTypes.string, className: PropTypes.string };
StatusChip.defaultProps = { status: "", label: null, severity: null, className: "" };

/**
 * Page title with the breadcrumb (crumbs: [{ label, onClick }], the last one is the current page), an optional line
 * under the title (record code, status chips, contact) and the page actions on the right.
 */
export const PageHeader = ({ title, crumbs, meta, actions }) => {
  const [home, ...rest] = crumbs;
  const item = (c) => ({ label: c.label, ...(c.onClick ? { command: c.onClick, className: "bv-crumb-link" } : {}) });
  return (
    <header className="bv-page-header">
      <div className="bv-page-header__main">
        <h1 className="bv-page-header__title">{title}</h1>
        {home ? <BreadCrumb className="bv-page-header__crumbs" home={item(home)} model={rest.map(item)} separatorIcon={<SvgDot color="#000" />} /> : null}
        {meta ? <div className="bv-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="bv-page-header__actions">{actions}</div> : null}
    </header>
  );
};
PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  crumbs: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.node, onClick: PropTypes.func })),
  meta: PropTypes.node,
  actions: PropTypes.node,
};
PageHeader.defaultProps = { crumbs: [], meta: null, actions: null };

/** Key facts of a record in one row: label above value; an empty value shows a dash. */
export const KeyFacts = ({ items, className }) => (
  <dl className={`bv-key-facts ${className}`}>
    {items.filter(Boolean).map((f) => (
      <div key={f.key || f.label} className="bv-key-facts__item">
        <dt>{f.label}</dt>
        <dd>{f.value === null || f.value === undefined || f.value === "" ? "—" : f.value}</dd>
      </div>
    ))}
  </dl>
);
KeyFacts.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.node, value: PropTypes.node })).isRequired,
  className: PropTypes.string,
};
KeyFacts.defaultProps = { className: "" };

/** A card with a section heading, actions on the heading line and the content below. */
export const SectionCard = ({ title, hint, actions, children, className, flush }) => (
  <section className={`bv-section-card ${flush ? "bv-section-card--flush" : ""} ${className}`}>
    {title || actions ? (
      <div className="bv-section-card__head">
        <h2 className="bv-section-card__title">
          {title}
          {hint ? <span className="bv-section-card__hint">{hint}</span> : null}
        </h2>
        {actions ? <div className="bv-section-card__actions">{actions}</div> : null}
      </div>
    ) : null}
    <div className="bv-section-card__body">{children}</div>
  </section>
);
SectionCard.propTypes = {
  title: PropTypes.node, hint: PropTypes.node, actions: PropTypes.node, children: PropTypes.node, className: PropTypes.string, flush: PropTypes.bool,
};
SectionCard.defaultProps = { title: null, hint: null, actions: null, children: null, className: "", flush: false };

/**
 * Actions of a table row: the frequent ones as icon buttons (each with its tooltip), the rest in a "More actions" menu.
 * Hidden actions are left out; a destructive one is marked `danger`.
 */
export const RowActions = ({ actions, menu }) => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const items = (menu || []).filter((m) => m && !m.hidden).map(({ hidden, ...m }) => m);
  return (
    <span className="bv-row-actions">
      {actions.filter((a) => a && !a.hidden).map((a) => (
        <Button key={a.label} type="button" icon={a.icon} text rounded severity={a.danger ? "danger" : undefined} disabled={a.disabled}
          aria-label={a.label} tooltip={a.label} tooltipOptions={{ position: "top" }} onClick={a.onClick} />
      ))}
      {items.length ? (
        <>
          <Menu model={items} popup ref={ref} />
          <Button type="button" icon="pi pi-ellipsis-v" text rounded aria-label={t("recordPage.moreActions")} tooltip={t("recordPage.moreActions")}
            tooltipOptions={{ position: "top" }} onClick={(e) => ref.current.toggle(e)} aria-haspopup />
        </>
      ) : null}
    </span>
  );
};
RowActions.propTypes = {
  actions: PropTypes.arrayOf(PropTypes.shape({
    icon: PropTypes.string, label: PropTypes.string, onClick: PropTypes.func, danger: PropTypes.bool, disabled: PropTypes.bool, hidden: PropTypes.bool,
  })),
  menu: PropTypes.arrayOf(PropTypes.object),
};
RowActions.defaultProps = { actions: [], menu: [] };

/** What to show where a list or section has nothing yet: an icon, one line, a hint and the action that fills it. */
export const EmptyState = ({ icon, title, text, action }) => (
  <div className="bv-empty-state">
    <i className={`pi ${icon}`} aria-hidden="true" />
    <p className="bv-empty-state__title">{title}</p>
    {text ? <p className="bv-empty-state__text">{text}</p> : null}
    {action}
  </div>
);
EmptyState.propTypes = { icon: PropTypes.string, title: PropTypes.node.isRequired, text: PropTypes.node, action: PropTypes.node };
EmptyState.defaultProps = { icon: "pi-inbox", text: null, action: null };

/** Search box and filters above a list, on one line, with "Clear filters" when any filter is set. */
export const FilterBar = ({ children, onClear, active, end }) => {
  const { t } = useTranslation();
  return (
    <div className="bv-filter-bar">
      {children}
      {active && onClear ? (
        <Button type="button" text size="small" icon="pi pi-filter-slash" label={t("recordPage.clearFilters")} onClick={onClear} />
      ) : null}
      {end ? <div className="bv-filter-bar__end">{end}</div> : null}
    </div>
  );
};
FilterBar.propTypes = { children: PropTypes.node, onClear: PropTypes.func, active: PropTypes.bool, end: PropTypes.node };
FilterBar.defaultProps = { children: null, onClear: null, active: false, end: null };

/**
 * Detail of the selected row as a side sheet from the right: title and status on top, the record's sections scrolling
 * below, the actions that apply to the record in the footer.
 */
export const SidePanel = ({ visible, onHide, title, meta, footer, children, wide }) => (
  <Sidebar visible={visible} position="right" onHide={onHide} blockScroll className={`bv-side-panel ${wide ? "bv-side-panel--wide" : ""}`}
    header={(
      <div className="bv-side-panel__head">
        <h2 className="bv-side-panel__title">{title}</h2>
        {meta ? <div className="bv-side-panel__meta">{meta}</div> : null}
      </div>
    )}>
    <div className="bv-side-panel__body">{children}</div>
    {footer ? <div className="bv-side-panel__footer">{footer}</div> : null}
  </Sidebar>
);
SidePanel.propTypes = {
  visible: PropTypes.bool, onHide: PropTypes.func.isRequired, title: PropTypes.node, meta: PropTypes.node, footer: PropTypes.node, children: PropTypes.node, wide: PropTypes.bool,
};
SidePanel.defaultProps = { visible: false, title: null, meta: null, footer: null, children: null, wide: false };

/** A titled block inside a side panel or a card. */
export const PanelSection = ({ title, actions, children }) => (
  <section className="bv-panel-section">
    <div className="bv-panel-section__head">
      <h3 className="bv-panel-section__title">{title}</h3>
      {actions ? <div className="bv-panel-section__actions">{actions}</div> : null}
    </div>
    {children}
  </section>
);
PanelSection.propTypes = { title: PropTypes.node.isRequired, actions: PropTypes.node, children: PropTypes.node };
PanelSection.defaultProps = { actions: null, children: null };
