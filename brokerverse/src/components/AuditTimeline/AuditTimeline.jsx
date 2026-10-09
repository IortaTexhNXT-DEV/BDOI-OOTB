import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { Skeleton } from "primereact/skeleton";
import auditService from "../../services/auditService";
import AuditChanges from "./AuditChanges";
import { EventMeta, eventTone } from "./AuditEventParts";
import "./auditTrail.scss";

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Kinds of event a history can be narrowed to (the colour family of their marker, AuditEventParts.eventTone). */
const KINDS = ["positive", "status", "neutral", "negative"];

/** Text an event is searched on: its headline, note, who, source and the fields it changed with their values. */
const searchText = (e) => [e.title, e.note, e.user?.displayName, e.source?.name, e.source?.label,
  ...(e.changes || []).flatMap((c) => [c.label, c.from, c.to])].filter((v) => v !== null && v !== undefined).join(" ").toLowerCase();

/**
 * History of one record as a vertical timeline, newest first and grouped by day: each entry is one business event
 * (what happened, when, who with their role, from which screen / API / job) with the fields it changed beneath it
 * (old value -> new value). A filter bar narrows it by text, person and kind of event; Export downloads the whole
 * history (Excel or CSV, one row per changed field). Dates and times come from the server in the configured format and
 * time zone. Used by the full-page audit trails (claim, quotation, client) and the client's Activity tab.
 *
 * Props:
 *   entity     record type as the audit trail names it: policy, quotation, claim, client, endorsement, receipt,
 *              master:<type> ... (required)
 *   recordId   id or number of the record; nothing loads until it is set
 *   emptyText  text shown when the record has no history (default: auditTrail.empty)
 *   limit      show this many events first, the rest behind "Show all" (default: every event)
 * Data: GET /audit/records/:entity/:id (auditService.getRecordHistory); Export: the same with ?export=excel|csv.
 */
const AuditTimeline = ({ entity, recordId, emptyText, limit }) => {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, error: null, events: [], today: null });
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState("");
  const [kind, setKind] = useState("");
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState("");
  const exportMenu = useRef(null);

  const load = useCallback(async () => {
    if (!entity || !recordId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await auditService.getRecordHistory(entity, recordId);
      setState({ loading: false, error: null, events: r.events, today: r.today });
    } catch (e) {
      setState({ loading: false, error: e.message || String(e), events: [], today: null });
    }
  }, [entity, recordId]);

  useEffect(() => { load(); }, [load]);

  const people = useMemo(() => [...new Map(state.events.map((e) => [e.user?.username || e.user?.displayName || "", e.user?.displayName || t("auditTrail.system", "System")])).entries()],
    [state.events, t]);
  const filtering = !!(query.trim() || person || kind);
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.events.filter((e) => (!person || (e.user?.username || e.user?.displayName || "") === person) && (!kind || eventTone(e) === kind)
      && (!q || searchText(e).includes(q)));
  }, [state.events, query, person, kind]);
  const visible = limit && !showAll && !filtering ? matching.slice(0, limit) : matching;
  const download = async (format) => {
    setExporting(format);
    setExportError("");
    try {
      await auditService.downloadRecordHistory(entity, recordId, format);
    } catch (e) {
      setExportError(e.message || String(e));
    } finally {
      setExporting(null);
    }
  };
  const days = useMemo(() => {
    const out = [];
    for (const e of visible) {
      const last = out[out.length - 1];
      if (last && last.day === e.day) last.events.push(e);
      else out.push({ day: e.day, date: e.date, events: [e] });
    }
    return out;
  }, [visible]);

  const dayLabel = (d) => {
    if (state.today && d.day === state.today) return t("auditTrail.today", { defaultValue: "Today" });
    if (state.today && d.day === addDays(state.today, -1)) return t("auditTrail.yesterday", { defaultValue: "Yesterday" });
    return null;
  };

  if (state.loading && !state.events.length) {
    return (
      <div className="bv-audit-timeline" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bv-audit-skeleton">
            <Skeleton shape="circle" size="0.75rem" />
            <div className="flex-1">
              <Skeleton width="40%" height="1rem" className="mb-2" />
              <Skeleton width="60%" height="0.8rem" className="mb-2" />
              <Skeleton width="80%" height="0.8rem" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bv-audit-timeline">
      <div className="bv-audit-timeline__bar">
        <div className="bv-audit-filters">
          <span className="p-input-icon-left bv-audit-filters__search">
            <i className="pi pi-search" />
            <InputText value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("auditTrail.searchHint", { defaultValue: "Search events, fields and values" })}
              aria-label={t("auditTrail.searchHint", { defaultValue: "Search events, fields and values" })} />
          </span>
          <Dropdown value={person} onChange={(e) => setPerson(e.value || "")} aria-label={t("auditTrail.user", { defaultValue: "User" })}
            options={[{ label: t("auditTrail.allUsers", { defaultValue: "All users" }), value: "" }, ...people.map(([value, label]) => ({ value, label }))]} />
          <Dropdown value={kind} onChange={(e) => setKind(e.value || "")} aria-label={t("auditTrail.kind", { defaultValue: "Kind of event" })}
            options={[{ label: t("auditTrail.allKinds", { defaultValue: "All events" }), value: "" }, ...KINDS.map((k) => ({ value: k, label: t(`auditTrail.kinds.${k}`) }))]} />
          {filtering ? (
            <Button type="button" text size="small" icon="pi pi-filter-slash" label={t("auditTrail.clearFilters", { defaultValue: "Clear filters" })}
              onClick={() => { setQuery(""); setPerson(""); setKind(""); }} />
          ) : null}
        </div>
        <div className="bv-audit-filters__end">
          <span className="bv-audit-count">
            {state.error ? state.error : filtering
              ? t("auditTrail.eventsShown", { shown: matching.length, count: state.events.length, defaultValue: `${matching.length} of ${state.events.length} events` })
              : t("auditTrail.eventCount", { count: state.events.length, defaultValue: state.events.length === 1 ? "1 event" : `${state.events.length} events` })}
          </span>
          <Menu popup ref={exportMenu} model={[
            { label: t("auditTrail.excel", { defaultValue: "Excel" }), icon: "pi pi-file-excel", command: () => download("excel") },
            { label: t("auditTrail.csv", { defaultValue: "CSV" }), icon: "pi pi-file", command: () => download("csv") },
          ]} />
          <Button type="button" icon="pi pi-download" outlined size="small" label={t("auditTrail.export", { defaultValue: "Export" })} loading={!!exporting}
            disabled={!state.events.length || !recordId} onClick={(e) => exportMenu.current.toggle(e)} aria-haspopup />
          <Button icon="pi pi-refresh" text rounded size="small" className="bv-audit-icon-btn" onClick={load} loading={state.loading}
            aria-label={t("auditTrail.refresh", { defaultValue: "Refresh" })} tooltip={t("auditTrail.refresh", { defaultValue: "Refresh" })} tooltipOptions={{ position: "top" }} />
        </div>
      </div>
      {exportError ? <small className="p-error block mb-2">{exportError}</small> : null}
      {!state.error && state.events.length > 0 && !matching.length ? (
        <div className="bv-audit-empty">
          <i className="pi pi-filter" aria-hidden="true" />
          <span>{t("auditTrail.noMatch", { defaultValue: "No event matches the filters." })}</span>
        </div>
      ) : null}
      {!state.error && !state.events.length ? (
        <div className="bv-audit-empty">
          <i className="pi pi-history" aria-hidden="true" />
          <span>{emptyText || t("auditTrail.empty", { defaultValue: "No changes have been recorded for this record yet." })}</span>
        </div>
      ) : null}
      {days.map((d) => (
        <section className="bv-audit-day" key={d.day || "unknown"} aria-label={d.date}>
          <h4 className="bv-audit-day__label">
            {dayLabel(d) ? <span className="bv-audit-day__relative">{dayLabel(d)}</span> : null}
            <span>{d.date}</span>
          </h4>
          <ol className="bv-audit-events">
            {d.events.map((e) => (
              <li className={`bv-audit-event bv-audit-event--${eventTone(e)}`} key={e.id}>
                <span className="bv-audit-event__dot" aria-hidden="true" />
                <div className="bv-audit-event__body">
                  <div className="bv-audit-event__head">
                    <span className="bv-audit-event__title">{e.title}</span>
                    <time className="bv-audit-event__time" dateTime={e.at}>{e.time}</time>
                  </div>
                  <EventMeta event={e} />
                  {e.note ? <p className="bv-audit-event__note">{e.note}</p> : null}
                  <AuditChanges changes={e.changes} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {limit && !filtering && state.events.length > limit ? (
        <Button text size="small" className="bv-audit-showall" onClick={() => setShowAll(!showAll)}
          label={showAll ? t("auditTrail.showRecent", { defaultValue: "Show recent events only" }) : t("auditTrail.showAllEvents", { count: state.events.length, defaultValue: `Show all ${state.events.length} events` })} />
      ) : null}
    </div>
  );
};

AuditTimeline.propTypes = {
  /** Record type as the audit trail names it: policy, quotation, claim, client, endorsement, receipt, master:<type> ... */
  entity: PropTypes.string.isRequired,
  /** Record id or number. */
  recordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  emptyText: PropTypes.string,
  /** Show this many events first, the rest behind "Show all" (none: every event). */
  limit: PropTypes.number,
};
AuditTimeline.defaultProps = { recordId: null, emptyText: null, limit: null };

export default AuditTimeline;
