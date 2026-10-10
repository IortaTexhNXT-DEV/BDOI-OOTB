import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import adminService from "../../services/adminService";
import { openConfirm } from "../../components/ConfirmDialog";
import { formatDate } from "../../utility/dateFormat";
import { AREAS, HIDDEN_GROUPS, areaOfGroup, groupTitle, presentationOf } from "./configuration/catalog";
import {
  ChipsEditor, ColorEditor, HtmlEditor, ImageEditor, JsonEditor, KeyValueEditor, NumberEditor, RecordsEditor, SelectEditor, SwitchEditor, TextEditor,
} from "./configuration/editors";
import "./index.scss";
import "./configuration/index.scss";

const OTHER = { id: "other", title: "Other settings", icon: "pi pi-sliders-h", summary: "Settings not yet placed in an area.", groups: [], links: [] };
const when = (d) => formatDate(d, { empty: "" });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Master > Configuration: the business parameters of the platform, grouped by business area (company, sales,
 * policies, claims, collections, remittance, commission, accounting, e-mail, security, reports, retention). Each
 * setting is shown in plain words with its unit; technical settings sit under "Advanced". Changes are saved together
 * and recorded in the audit trail. Presentation rules: configuration/catalog.js.
 */
const Configuration = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [params, setParams] = useSearchParams();
  const areaId = params.get("area");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({});
  const [invalid, setInvalid] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await adminService.getSettings()).filter((r) => !HIDDEN_GROUPS.includes(r.group)));
      setDraft({});
    } catch (e) {
      toast.current?.show({ severity: "error", summary: "Could not load the configuration", detail: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changed = Object.keys(draft).filter((k) => !same(draft[k], rows.find((r) => r.key === k)?.value));
  // leaving the page with unsaved changes asks first: the browser's own prompt on reload or close, the application's
  // confirmation on a link to another screen (the menu, the header)
  const changedRef = useRef(changed);
  changedRef.current = changed;
  useEffect(() => {
    if (!changed.length) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    const leave = async (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest?.("a[href]");
      if (!link || link.target === "_blank" || link.closest(".cfg") || link.closest(".p-dialog")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      const count = changedRef.current.length;
      const leaveAnyway = await openConfirm({
        title: t("configuration.leaveTitle"),
        severity: "warning",
        message: t("configuration.leaveMessage", { count }),
        facts: changedRef.current.slice(0, 6).map((k) => ({ label: rows.find((r) => r.key === k)?.label || k, value: t("configuration.notSaved") })),
        note: count > 6 ? t("configuration.leaveMore", { count: count - 6 }) : null,
        confirmLabel: t("configuration.leaveAction"),
        cancelLabel: t("configuration.stay"),
      });
      if (!leaveAnyway) return;
      setDraft({});
      navigate(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", leave, true);
    };
  }, [changed.length, navigate, rows, t]);

  const enriched = useMemo(() => rows.map((r) => ({ ...r, view: presentationOf(r), area: areaOfGroup(r.group) })), [rows]);
  const areas = useMemo(() => {
    const list = [...AREAS, OTHER].map((a) => ({ ...a, rows: enriched.filter((r) => r.area === a.id) }));
    return list.filter((a) => a.rows.length);
  }, [enriched]);

  const q = search.trim().toLowerCase();
  const matches = useMemo(() => (q ? enriched.filter((r) => `${r.label} ${r.key} ${groupTitle(r.group)}`.toLowerCase().includes(q)) : []), [enriched, q]);

  const valueOf = (r) => (r.key in draft ? draft[r.key] : r.value);
  const set = (key, v) => setDraft((d) => ({ ...d, [key]: v }));
  const discard = () => { setDraft({}); setInvalid({}); };

  const save = async () => {
    const bad = Object.keys(invalid).filter((k) => invalid[k]);
    if (bad.length) {
      toast.current?.show({ severity: "warn", summary: "Fix the highlighted settings first", detail: bad.map((k) => rows.find((r) => r.key === k)?.label).join(", ") });
      return;
    }
    const changes = Object.fromEntries(changed.map((k) => [k, draft[k]]));
    if (!Object.keys(changes).length) return;
    setSaving(true);
    try {
      const data = await adminService.saveSettings(changes);
      setRows(data.filter((r) => !HIDDEN_GROUPS.includes(r.group)));
      setDraft({});
      toast.current?.show({ severity: "success", summary: `${Object.keys(changes).length} setting(s) saved`, detail: "The change is in effect and recorded in the audit trail." });
    } catch (e) {
      toast.current?.show({ severity: "error", summary: "Not saved", detail: e.message });
    } finally {
      setSaving(false);
    }
  };

  const editorFor = (r) => {
    const v = valueOf(r);
    const view = r.view;
    const disabled = r.editable === false || !!view.managed;
    const props = { id: r.key, value: v, onChange: (next) => set(r.key, next), disabled };
    switch (view.editor) {
      case "switch": return <SwitchEditor {...props} />;
      case "number": return <NumberEditor {...props} unit={view.unit} percent={view.percent} />;
      case "select": return <SelectEditor {...props} choices={view.choices} />;
      case "color": return <ColorEditor {...props} />;
      case "image": return <ImageEditor {...props} />;
      case "chips": return <ChipsEditor {...props} numeric={view.numeric} />;
      case "keyvalue": return <KeyValueEditor {...props} percent={view.percent} />;
      case "records": return <RecordsEditor {...props} original={r.value} />;
      case "template": return <HtmlEditor id={r.key} disabled={disabled} subject={v?.subject} body={v?.html}
        onSubject={"subject" in (r.value || {}) ? (s) => set(r.key, { ...v, subject: s }) : null} onBody={(html) => set(r.key, { ...v, html })} />;
      case "html": return <HtmlEditor id={r.key} disabled={disabled} body={v} onBody={(html) => set(r.key, html)} />;
      case "json": return <JsonEditor {...props} onInvalid={(bad) => setInvalid((m) => ({ ...m, [r.key]: bad }))} />;
      case "textarea": return <TextEditor {...props} long />;
      default: return <TextEditor {...props} />;
    }
  };

  const settingRow = (r, { showGroup = false } = {}) => {
    const dirty = changed.includes(r.key);
    const wide = ["template", "html", "json", "records", "keyvalue"].includes(r.view.editor);
    return (
      <div key={r.key} className={`cfg__row${dirty ? " is-changed" : ""}${wide ? " is-wide" : ""}`}>
        <div className="cfg__row-text">
          <label htmlFor={r.key} className="cfg__label" title={`Reference: ${r.key}`}>{r.label}</label>
          <div className="cfg__meta">
            {showGroup ? <span>{groupTitle(r.group)}</span> : null}
            {r.view.managed ? <span><Link to={r.view.managed.path}>Managed in {r.view.managed.label}</Link></span> : null}
            {r.editable === false ? <span>Read only</span> : null}
            {r.updatedBy && !String(r.updatedBy).match(/^(seed|system)$/i) ? <span>Last changed by {r.updatedBy} on {when(r.updatedAt)}</span> : null}
            {dirty ? <Tag value="Not saved" severity="warning" className="cfg__dirty" /> : null}
          </div>
        </div>
        <div className="cfg__row-editor">{editorFor(r)}</div>
      </div>
    );
  };

  // while searching, the page is the search result list, whatever area was open
  const area = q ? null : areas.find((a) => a.id === areaId);
  const openArea = (id) => { setParams(id ? { area: id } : {}); setSearch(""); window.scrollTo?.(0, 0); };

  const saveBar = changed.length ? (
    <div className="cfg__savebar" role="region" aria-label="Unsaved changes">
      <span><i className="pi pi-pencil" /> {changed.length} unsaved change{changed.length > 1 ? "s" : ""}</span>
      <div className="cfg__savebar-actions">
        <Button label="Discard" text onClick={discard} disabled={saving} />
        <Button label="Save changes" icon="pi pi-check" onClick={save} loading={saving} />
      </div>
    </div>
  ) : null;

  const header = (
    <>
      <BreadCrumb model={[{ label: "Configuration", command: () => openArea(null), className: area ? "bv-crumb-link" : undefined }, ...(area ? [{ label: area.title }] : [])]}
        home={{ label: "Master" }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>{q ? "Search results" : area ? area.title : "Configuration"}</h2>
        </div>
        <span className="p-input-icon-left cfg__search">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a setting, e.g. VAT, renewal notice, password" aria-label="Find a setting" />
        </span>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="admin__page cfg">
        {header}
        <div className="cfg__cards">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height="8.5rem" borderRadius="10px" />)}</div>
      </div>
    );
  }

  // search results across every area
  if (q) {
    return (
      <div className="admin__page cfg">
        <Toast ref={toast} />
        {header}
        <p className="cfg__count">{matches.length} setting{matches.length === 1 ? "" : "s"} found</p>
        <div className="cfg__panel">{matches.length ? matches.map((r) => settingRow(r, { showGroup: true })) : <p className="cfg__empty">No setting matches “{search}”.</p>}</div>
        {saveBar}
      </div>
    );
  }

  // landing page: one card per business area
  if (!area) {
    return (
      <div className="admin__page cfg">
        <Toast ref={toast} />
        {header}
        <div className="cfg__cards">
          {areas.map((a) => (
            <button type="button" key={a.id} className="cfg__card" onClick={() => openArea(a.id)}>
              <span className="cfg__card-icon"><i className={a.icon} /></span>
              <span className="cfg__card-title">{a.title}</span>
              <span className="cfg__card-text">{a.summary}</span>
              <span className="cfg__card-count">{a.rows.filter((r) => !r.view.advanced).length} settings</span>
            </button>
          ))}
        </div>
        {saveBar}
      </div>
    );
  }

  const managedRows = area.rows.filter((r) => r.view.managed);
  const visible = area.rows.filter((r) => !r.view.managed && (showAdvanced || !r.view.advanced));
  const advancedCount = area.rows.filter((r) => r.view.advanced).length;
  const byGroup = area.groups.concat([...new Set(area.rows.map((r) => r.group))].filter((g) => !area.groups.includes(g)))
    .map((g) => ({ group: g, rows: visible.filter((r) => r.group === g) }))
    .filter((g) => g.rows.length);

  return (
    <div className="admin__page cfg">
      <Toast ref={toast} />
      {header}
      <div className="cfg__layout">
        <nav className="cfg__nav" aria-label="Configuration areas">
          {areas.map((a) => (
            <button type="button" key={a.id} className={`cfg__nav-item${a.id === area.id ? " is-active" : ""}`} onClick={() => openArea(a.id)}>
              <i className={a.icon} /> <span>{a.title}</span>
            </button>
          ))}
        </nav>
        <div className="cfg__content">
          <div className="cfg__toolbar">
            {area.links.length ? (
              <div className="cfg__links">
                <span>Related screens:</span>
                {area.links.map((l) => <Link key={l.path} to={l.path}>{l.label}</Link>)}
              </div>
            ) : <span />}
            {advancedCount ? (
              <label className="cfg__advanced" htmlFor="cfg-advanced">
                <InputSwitch inputId="cfg-advanced" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.value)} />
                Show advanced settings ({advancedCount})
              </label>
            ) : null}
          </div>
          {byGroup.map(({ group, rows: items }) => (
            <section key={group} className="cfg__panel" aria-labelledby={`cfg-${group}`}>
              <h3 id={`cfg-${group}`}>{groupTitle(group)}</h3>
              {items.map((r) => settingRow(r))}
            </section>
          ))}
          {managedRows.length ? (
            <details className="cfg__panel cfg__managed">
              <summary>
                <span className="cfg__managed-title">Set on other screens ({managedRows.length})</span>
                <span className="cfg__muted">Read only here: the application name and branding, the company's legal identity, premium tax rates and GL accounts are changed on their own screens.</span>
              </summary>
              <div className="cfg__managed-grid">
                {managedRows.map((r) => (
                  <div key={r.key} className="cfg__managed-item">
                    <span>{r.label}</span>
                    <span className="cfg__managed-value">{typeof r.value === "object" ? Object.entries(r.value || {}).map(([k, v]) => `${k}: ${v}`).join(", ") : String(r.value ?? "")}</span>
                    <Link to={r.view.managed.path}>Managed in {r.view.managed.label}</Link>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {!byGroup.length ? <p className="cfg__empty">This area has only advanced settings. Switch on “Show advanced settings” to see them.</p> : null}
        </div>
      </div>
      {saveBar}
    </div>
  );
};

export default Configuration;
