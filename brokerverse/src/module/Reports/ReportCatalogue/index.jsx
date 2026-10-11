import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import PageHeader from "../../../components/PageHeader";
import reportsService from "../../../services/reportsService";
import ReportScreen from "../ReportScreen";
import "../ReportScreen/index.scss";
import "./index.scss";
import { CATEGORIES, categoryOf } from "./reportCategories";

const RECENT_MAX = 8;

/** Per-user localStorage key; storage may be missing or blocked, so every access is guarded. */
const storageKey = (name) => {
  let user = "anonymous";
  try {
    user = localStorage.getItem("USER_ID") || localStorage.getItem("USER_EMAIL") || user;
  } catch (e) {
    /* storage unavailable */
  }
  return `bv.reports.${name}.${user}`;
};
const readList = (name) => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(name)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
};
const writeList = (name, list) => {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(list));
  } catch (e) {
    /* storage unavailable: kept for this visit only */
  }
};

/**
 * Reports > All Reports: the report centre. Lists every report of the catalogue the signed-in user's roles may run
 * (GET /reports filters by role and permission) in a compact table with a category rail, search, favourites and the
 * reports recently run from here; each opens the report screen (/reports/run/:code).
 */
export const ReportCatalogue = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [favourites, setFavourites] = useState(() => readList("favourites"));
  const [recent, setRecent] = useState(() => readList("recent"));

  useEffect(() => {
    reportsService
      .getCatalogue()
      .then(setReports)
      .catch((e) => setError(e.message));
  }, []);

  // "/" focuses the search, unless the user is typing in a field
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const categoryLabel = useCallback((key) => t(`reports.centre.categories.${key}`, CATEGORIES.find((c) => c.key === key)?.label || key), [t]);

  const rows = useMemo(() => (reports || []).map((r) => ({ ...r, group: categoryOf(r.code) })), [reports]);
  const available = useMemo(() => new Set(rows.map((r) => r.code)), [rows]);

  const toggleFavourite = (code) => {
    const next = favourites.includes(code) ? favourites.filter((c) => c !== code) : [...favourites, code];
    setFavourites(next);
    writeList("favourites", next);
  };

  const open = (code) => {
    const next = [code, ...recent.filter((c) => c !== code)].slice(0, RECENT_MAX);
    setRecent(next);
    writeList("recent", next);
    navigate(`/reports/run/${code}`);
  };

  const rail = useMemo(() => {
    const count = (key) => rows.filter((r) => r.group === key).length;
    return [
      { key: "all", label: t("reports.centre.all", "All reports"), icon: "pi pi-th-large", count: rows.length },
      { key: "favourites", label: t("reports.centre.favourites", "Favourites"), icon: "pi pi-star", count: favourites.filter((c) => available.has(c)).length },
      { key: "recent", label: t("reports.centre.recent", "Recently run"), icon: "pi pi-history", count: recent.filter((c) => available.has(c)).length },
      ...CATEGORIES.map((c) => ({ key: c.key, label: categoryLabel(c.key), count: count(c.key), category: true })).filter((c) => c.count > 0),
    ];
  }, [rows, favourites, recent, available, t, categoryLabel]);

  const term = search.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = rows;
    if (view === "favourites") list = rows.filter((r) => favourites.includes(r.code));
    else if (view === "recent") list = recent.map((c) => rows.find((r) => r.code === c)).filter(Boolean);
    else if (view !== "all") list = rows.filter((r) => r.group === view);
    if (term) list = list.filter((r) => `${r.name} ${r.description || ""} ${r.code}`.toLowerCase().includes(term));
    return list;
  }, [rows, view, favourites, recent, term]);

  const nameBody = (r) => (
    <div className="report-centre__name-cell">
      <a
        href={`/reports/run/${r.code}`}
        className="report-centre__name"
        onClick={(e) => {
          e.preventDefault();
          open(r.code);
        }}
      >
        {r.name}
      </a>
      {r.description && (
        <span className="report-centre__desc" title={r.description}>
          {r.description}
        </span>
      )}
    </div>
  );

  const starBody = (r) => {
    const on = favourites.includes(r.code);
    return (
      <Button
        type="button"
        icon={on ? "pi pi-star-fill" : "pi pi-star"}
        text
        rounded
        className={`report-centre__star${on ? " report-centre__star--on" : ""}`}
        aria-pressed={on}
        aria-label={on ? t("reports.centre.unfavourite", "Remove from favourites") : t("reports.centre.favourite", "Add to favourites")}
        onClick={() => toggleFavourite(r.code)}
      />
    );
  };

  const emptyText = () => {
    if (term) return t("reports.centre.noMatch", "No reports match your search.");
    if (view === "favourites") return t("reports.centre.noFavourites", "No favourites yet. Star a report to keep it here.");
    if (view === "recent") return t("reports.centre.noRecent", "Reports you open from this page appear here.");
    return t("reports.centre.none", "No reports available.");
  };

  return (
    <div className="report-screen report-centre">
      <PageHeader
        title={t("reports.centre.title", "All Reports")}
        home={t("reports.heading")}
        section={t("reports.centre.title", "All Reports")}
        help={t("reports.centre.help", "Every report your role may run. Search by name, description or code (press / to search), filter by category, and star the reports you use most.")}
      />
      {error && <Message severity="warn" text={error} className="w-full mb-3" />}
      <div className="report-centre__layout">
        <nav className="report-centre__rail" aria-label={t("reports.centre.categoriesLabel", "Report categories")}>
          {rail.map((item, i) => (
            <React.Fragment key={item.key}>
              {item.category && !rail[i - 1]?.category && <div className="report-centre__rail-heading">{t("reports.centre.categoriesLabel", "Report categories")}</div>}
              <button
                type="button"
                className={`report-centre__rail-item${view === item.key ? " report-centre__rail-item--active" : ""}`}
                aria-current={view === item.key ? "true" : undefined}
                onClick={() => setView(item.key)}
              >
                {item.icon && <i className={item.icon} aria-hidden="true" />}
                <span className="report-centre__rail-label">{item.label}</span>
                <span className="report-centre__rail-count">{item.count}</span>
              </button>
            </React.Fragment>
          ))}
        </nav>
        <section className="report-centre__main">
          <div className="report-centre__toolbar">
            <Dropdown
              className="report-centre__rail-select"
              value={view}
              options={rail.map((r) => ({ value: r.key, label: `${r.label} (${r.count})` }))}
              onChange={(e) => setView(e.value)}
              aria-label={t("reports.centre.categoriesLabel", "Report categories")}
            />
            <span className="p-input-icon-left report-centre__search">
              <i className="pi pi-search" />
              <InputText
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("reports.centre.searchPlaceholder", "Search reports by name, description or code")}
                aria-label={t("reports.centre.search", "Search reports")}
              />
              <kbd className="report-centre__kbd" aria-hidden="true">/</kbd>
            </span>
          </div>
          <DataTable
            value={visible}
            dataKey="code"
            loading={!reports && !error}
            size="small"
            stripedRows
            className="report-centre__table"
            emptyMessage={emptyText()}
            responsiveLayout="stack"
            breakpoint="640px"
          >
            <Column header="" body={starBody} style={{ width: "3rem" }} />
            <Column header={t("reports.centre.colReport", "Report")} body={nameBody} />
            <Column
              header={t("reports.centre.colCategory", "Category")}
              body={(r) => <Tag value={categoryLabel(r.group)} severity="secondary" className="bv-status-chip report-centre__chip" />}
              style={{ width: "14rem" }}
            />
            <Column header={t("reports.centre.colCode", "Code")} body={(r) => <code className="report-centre__code">{r.code}</code>} style={{ width: "13rem" }} />
            <Column
              header=""
              body={(r) => (
                <Button type="button" label={t("reports.centre.run", "Run")} icon="pi pi-play" size="small" outlined onClick={() => open(r.code)} aria-label={`${t("reports.centre.run", "Run")} ${r.name}`} />
              )}
              style={{ width: "6.5rem", textAlign: "right" }}
            />
          </DataTable>
        </section>
      </div>
    </div>
  );
};

/** /reports/run/:code - one catalogue report. */
export const ReportRunner = () => {
  const { code } = useParams();
  return <ReportScreen code={code} group="All Reports" groupPath="/reports/catalogue" />;
};

export default ReportCatalogue;
