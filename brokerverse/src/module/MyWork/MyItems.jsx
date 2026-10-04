import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { SelectButton } from "primereact/selectbutton";
import { Skeleton } from "primereact/skeleton";
import { CATEGORY_ICONS, DUE_FILTERS, PRIORITIES } from "./logic";
import ItemsTable from "./ItemsTable";

/** Due / priority / sort filters of an items list. */
export const ItemFilters = ({ state, patch, soonDays, children }) => {
  const { t } = useTranslation();
  const dueOptions = [{ label: t("myWork.filter.anyDue", "Any due date"), value: "" },
    ...DUE_FILTERS.map((d) => ({ label: t(`myWork.dueFilter.${d}`, { count: soonDays, defaultValue: d }), value: d }))];
  const priorityOptions = [{ label: t("myWork.filter.anyPriority", "Any priority"), value: "" },
    ...PRIORITIES.map((p) => ({ label: t(`myWork.priority.${p}`, p), value: p }))];
  const sortOptions = ["due", "priority", "client", "amount"].map((s) => ({ label: t(`myWork.sort.${s}`, s), value: s }));
  return (
    <div className="bv-list-toolbar mw-toolbar">
      <span className="p-input-icon-left bv-list-search">
        <i className="pi pi-search" />
        <InputText value={state.search} onChange={(e) => patch({ search: e.target.value })} placeholder={t("myWork.filter.search", "Search number, client or action")}
          aria-label={t("myWork.filter.search", "Search number, client or action")} />
      </span>
      <Dropdown value={state.due} options={dueOptions} onChange={(e) => patch({ due: e.value })} className="bv-list-filter" aria-label={t("myWork.col.due", "Due")} />
      <Dropdown value={state.priority} options={priorityOptions} onChange={(e) => patch({ priority: e.value })} className="bv-list-filter" aria-label={t("myWork.col.priority", "Priority")} />
      <Dropdown value={state.sort || "due"} options={sortOptions} onChange={(e) => patch({ sort: e.value })} className="bv-list-filter mw-sort"
        aria-label={t("myWork.filter.sort", "Sort by")} valueTemplate={(o) => (o ? `${t("myWork.filter.sortBy", "Sort")}: ${o.label}` : null)} />
      {children}
    </div>
  );
};
ItemFilters.propTypes = { state: PropTypes.object.isRequired, patch: PropTypes.func.isRequired, soonDays: PropTypes.number, children: PropTypes.node };

/** Category list on the left of the items (a row of chips on a narrow screen). */
export const CategoryRail = ({ categories, value, onChange, loading, totalLabel, header }) => {
  const { t } = useTranslation();
  const list = categories;
  const total = list.reduce((s, c) => s + c.count, 0);
  const overdue = list.reduce((s, c) => s + c.overdue, 0);
  const entry = (code, label, icon, count, late) => (
    <li key={code || "all"}>
      <button type="button" className={`mw-rail__item ${value === code ? "is-active" : ""} ${!loading && !count ? "is-empty" : ""}`} aria-pressed={value === code} onClick={() => onChange(code)}>
        <i className={icon} aria-hidden="true" />
        <span className="mw-rail__label">{label}</span>
        {late > 0 && <span className="mw-rail__late" title={t("myWork.overdueCount", { count: late, defaultValue: "{{count}} overdue" })}>{late}</span>}
        <span className="mw-rail__count">{loading ? "-" : count}</span>
      </button>
    </li>
  );
  return (
    <nav className="mw-rail" aria-label={t("myWork.categories", "Categories")}>
      {header}
      <ul>
        {entry("", totalLabel || t("myWork.allItems", "All items"), "pi pi-inbox", total, overdue)}
        {loading && !list.length
          ? Array.from({ length: 6 }, (_, i) => <li key={`sk${i}`} className="mw-rail__skeleton"><Skeleton height="1.1rem" /></li>)
          : list.map((c) => entry(c.code, t(`myWork.category.${c.code}`, c.label), c.icon || CATEGORY_ICONS[c.code], c.count, c.overdue))}
      </ul>
    </nav>
  );
};
CategoryRail.propTypes = {
  categories: PropTypes.array.isRequired, value: PropTypes.string, onChange: PropTypes.func.isRequired, loading: PropTypes.bool, totalLabel: PropTypes.string, header: PropTypes.node,
};

/** My Items: what waits on the signed-in user (a manager: on their team; or, with "Everyone", on anybody within their permissions). */
const MyItems = ({ state, patch, summary, loading, today, soonDays, reloadKey, isManager = false }) => {
  const { t } = useTranslation();
  const filters = useMemo(() => ({ scope: state.scope, category: state.category, due: state.due, priority: state.priority, search: state.search, sort: state.sort }),
    [state.scope, state.category, state.due, state.priority, state.search, state.sort]);
  const scopeOptions = [
    { label: t("myWork.scope.me", "Mine"), value: "me" },
    ...(isManager ? [{ label: t("myWork.scope.team", "My team"), value: "team" }] : []),
    { label: t("myWork.scope.all", "Everyone"), value: "all" },
  ];
  return (
    <div className="mw-split">
      <CategoryRail categories={summary?.categories || []} value={state.category} onChange={(category) => patch({ category })} loading={loading}
        header={<SelectButton value={state.scope} options={scopeOptions} onChange={(e) => e.value && patch({ scope: e.value })} className="mw-scope" aria-label={t("myWork.scope.label", "Whose items")} />} />
      <div className="mw-split__main">
        <ItemFilters state={state} patch={patch} soonDays={soonDays} />
        <ItemsTable filters={filters} listKey="my-work-items" today={today} soonDays={soonDays} showOwner={state.scope !== "me"} reloadKey={reloadKey} />
      </div>
    </div>
  );
};

MyItems.propTypes = {
  state: PropTypes.object.isRequired,
  patch: PropTypes.func.isRequired,
  summary: PropTypes.object,
  loading: PropTypes.bool,
  today: PropTypes.string.isRequired,
  soonDays: PropTypes.number,
  reloadKey: PropTypes.number,
  isManager: PropTypes.bool,
};

export default MyItems;
