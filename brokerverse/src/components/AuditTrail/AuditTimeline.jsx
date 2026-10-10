import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
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

/**
 * History of one record as a vertical timeline, newest first and grouped by day: each entry is one business event
 * (what happened, when, who with their role, from which screen / API / job) with the fields it changed beneath it.
 * Dates and times come from the server in the configured format and time zone.
 */
const AuditTimeline = ({ entity, recordId, emptyText, limit }) => {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, error: null, events: [], today: null });
  const [showAll, setShowAll] = useState(false);

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

  const visible = limit && !showAll ? state.events.slice(0, limit) : state.events;
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
        <span className="bv-audit-count">{state.error || null}</span>
        <Button icon="pi pi-refresh" text rounded size="small" className="bv-audit-icon-btn" onClick={load} loading={state.loading}
          aria-label={t("auditTrail.refresh", { defaultValue: "Refresh" })} tooltip={t("auditTrail.refresh", { defaultValue: "Refresh" })} tooltipOptions={{ position: "top" }} />
      </div>
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
      {limit && state.events.length > limit ? (
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
