/**
 * Activity log of a record: a vertical timeline, newest first, grouped by day. Each entry says what was done (the
 * action in words), when (dd/mm/yyyy HH:mm in the business time zone), by whom (display name and role), the status move
 * as chips, the remarks given, and the fields it changed (before, after) folded under "What changed".
 *
 *   <ActivityLog entries={fromRemittanceActivity(remittance.activityLog)} />
 *   <ActivityLog entries={entries} loading={loading} error={error} onRetry={reload} />
 *   <RecordActivityLog entity="journal_voucher" recordId={voucher.id} />   // loads GET /audit/records/:entity/:id
 *
 * Entries: { id, at, seq?, actionCode, actionLabel?, user: { displayName, username, role }, fromStatus, toStatus, remarks,
 * changes: [{ field, label, before, after }], source }; ./adapters makes them from the API's history rows. `seq` orders
 * entries made at the same moment (created before approved); without it they keep the order given.
 */
import React, { useId, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";
import StatusChip from "../StatusChip";
import { instantParts } from "../../utility/dateFormat";
import { actionText, actionTone, humanize } from "./actions";
import "./activityLog.scss";

const DASH = "—";

/** When an entry happened: the server's date and time when it gave them, else its instant in the business time zone. */
const whenOf = (e) => {
  const parts = instantParts(e.at);
  const date = e.date || parts?.date || null;
  const time = e.time || parts?.time || null;
  return { day: e.day || parts?.day || date, date, text: [date, time].filter(Boolean).join(" "), iso: typeof e.at === "string" ? e.at : parts && new Date(e.at).toISOString() };
};

const timeOf = (e) => {
  const ms = e.at ? Date.parse(e.at instanceof Date ? e.at.toISOString() : e.at) : NaN;
  return Number.isNaN(ms) ? null : ms;
};

// entries made at the same moment: in the order the steps happen (seq) when known, else as given
const tie = (a, b, order) => {
  if (a.e.seq === undefined || a.e.seq === null || b.e.seq === undefined || b.e.seq === null) return a.i - b.i;
  return order === "asc" ? a.e.seq - b.e.seq : b.e.seq - a.e.seq;
};

/** Entries in order (newest first unless `order` is "asc"), grouped by business day. */
export const groupByDay = (entries, order = "desc") => {
  const sorted = (entries || [])
    .map((e, i) => ({ e, i, ms: timeOf(e) }))
    .sort((a, b) => (a.ms === null || b.ms === null ? a.i - b.i : (order === "asc" ? a.ms - b.ms : b.ms - a.ms) || tie(a, b, order)))
    .map(({ e }) => ({ ...e, when: whenOf(e) }));
  const days = [];
  sorted.forEach((e) => {
    const last = days[days.length - 1];
    if (last && last.day === e.when.day) last.entries.push(e);
    else days.push({ day: e.when.day, date: e.when.date, entries: [e] });
  });
  return days;
};

const Value = ({ value, masked }) => {
  const { t } = useTranslation();
  if (masked) return <span className="bv-activity-log__value bv-activity-log__value--muted">{t("activityLog.hidden")}</span>;
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) {
    return <span className="bv-activity-log__value bv-activity-log__value--muted">{DASH}</span>;
  }
  let text;
  if (typeof value === "boolean") text = value ? t("detailView.yes") : t("detailView.no");
  else if (Array.isArray(value)) text = value.map((v) => (v && typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  else if (typeof value === "object") text = Object.entries(value).map(([k, v]) => `${humanize(k)}: ${v ?? DASH}`).join("; ");
  else text = String(value);
  return <span className="bv-activity-log__value">{text}</span>;
};

Value.propTypes = { value: PropTypes.any, masked: PropTypes.bool };
Value.defaultProps = { value: null, masked: false };

// an action taken on the application's own screens is the usual case and is not labelled; the menu path of the
// screen repeats the action already named in the title, so only another channel (job, API, upload, portal) is shown
const sourceText = (source, t) => {
  if (!source || source.channel === "application") return null;
  if (source.channel === "screen") return source.name ? null : source.label || null;
  if (source.channel === "api") return t("activityLog.sources.api");
  return source.label || null;
};

const ActivityEntry = ({ entry, expanded }) => {
  const { t } = useTranslation();
  const changesId = useId();
  const [open, setOpen] = useState(expanded);
  const who = entry.user?.displayName || entry.user?.username || t("activityLog.system");
  const role = entry.user?.role || (Array.isArray(entry.user?.roles) ? entry.user.roles.join(", ") : null);
  const source = sourceText(entry.source, t);
  const changes = entry.changes || [];
  const { fromStatus: from, toStatus: to } = entry;
  return (
    <li className={`bv-activity-log__entry bv-activity-log__entry--${actionTone(entry.actionCode)}`}>
      <span className="bv-activity-log__marker" aria-hidden="true" />
      <div className="bv-activity-log__body">
        <div className="bv-activity-log__head">
          <span className="bv-activity-log__action">{entry.actionLabel || actionText(entry.actionCode)}</span>
          <time className="bv-activity-log__time" dateTime={entry.when.iso || undefined}>{entry.when.text}</time>
        </div>
        <div className="bv-activity-log__who">
          <span className="bv-activity-log__name">{who}</span>
          {role ? <span className="bv-activity-log__role">{role}</span> : null}
          {source ? <span className="bv-activity-log__source">{source}</span> : null}
        </div>
        {from || to ? (
          <div className="bv-activity-log__status" role="group" aria-label={from && to ? t("activityLog.statusChange", { from, to }) : to || from}>
            {from ? <StatusChip label={from} /> : null}
            {from && to ? <i className="pi pi-arrow-right bv-activity-log__arrow" aria-hidden="true" /> : null}
            {to ? <StatusChip label={to} /> : null}
          </div>
        ) : null}
        {entry.remarks ? (
          <div className="bv-activity-log__remarks">
            <span className="bv-activity-log__remarks-label">{t("activityLog.remarks")}</span>
            <p>{entry.remarks}</p>
          </div>
        ) : null}
        {changes.length ? (
          <div className="bv-activity-log__changes">
            <button type="button" className="bv-activity-log__toggle" aria-expanded={open} aria-controls={changesId} onClick={() => setOpen(!open)}>
              <i className={`pi ${open ? "pi-chevron-down" : "pi-chevron-right"}`} aria-hidden="true" />
              {t("activityLog.whatChanged")}
            </button>
            <table id={changesId} className="bv-activity-log__table" hidden={!open}>
              <thead>
                <tr>
                  <th scope="col">{t("activityLog.field")}</th>
                  <th scope="col">{t("activityLog.before")}</th>
                  <th scope="col">{t("activityLog.after")}</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={c.field || i}>
                    <th scope="row">{c.label || humanize(c.field)}</th>
                    <td><Value value={c.before} masked={c.masked && c.before !== null && c.before !== undefined} /></td>
                    <td><Value value={c.after} masked={c.masked && c.after !== null && c.after !== undefined} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </li>
  );
};

const entryShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  seq: PropTypes.number,
  actionCode: PropTypes.string,
  actionLabel: PropTypes.string,
  user: PropTypes.shape({ displayName: PropTypes.string, username: PropTypes.string, role: PropTypes.string, roles: PropTypes.arrayOf(PropTypes.string) }),
  fromStatus: PropTypes.string,
  toStatus: PropTypes.string,
  remarks: PropTypes.string,
  changes: PropTypes.arrayOf(PropTypes.shape({ field: PropTypes.string, label: PropTypes.string, before: PropTypes.any, after: PropTypes.any, masked: PropTypes.bool })),
  source: PropTypes.shape({ channel: PropTypes.string, label: PropTypes.string, name: PropTypes.string }),
});

ActivityEntry.propTypes = { entry: entryShape.isRequired, expanded: PropTypes.bool.isRequired };

const ActivityLog = ({ entries, loading, error, onRetry, emptyText, order, expandChanges, className }) => {
  const { t } = useTranslation();
  const days = useMemo(() => groupByDay(entries, order), [entries, order]);
  const classes = ["bv-activity-log", className].filter(Boolean).join(" ");

  if (loading && !days.length) {
    return (
      <div className={classes} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bv-activity-log__skeleton">
            <Skeleton shape="circle" size="0.75rem" />
            <div className="bv-activity-log__skeleton-lines">
              <Skeleton width="45%" height="1rem" />
              <Skeleton width="30%" height="0.8rem" />
              <Skeleton width="70%" height="0.8rem" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${classes} bv-activity-log__state bv-activity-log__state--error`} role="alert">
        <i className="pi pi-exclamation-circle" aria-hidden="true" />
        <span>{typeof error === "string" && error ? error : t("activityLog.failed")}</span>
        {onRetry ? <Button type="button" label={t("activityLog.retry")} text size="small" onClick={onRetry} /> : null}
      </div>
    );
  }

  if (!days.length) return <div className={`${classes} bv-activity-log__state`}>{emptyText || t("activityLog.empty")}</div>;

  const today = instantParts(new Date())?.day;
  const yesterday = instantParts(new Date(Date.now() - 86400000))?.day;
  return (
    <div className={classes} aria-busy={loading || undefined}>
      {days.map((d) => (
        <section key={d.day || "undated"} className="bv-activity-log__day" aria-label={d.date || undefined}>
          {d.date ? (
            <h4 className="bv-activity-log__day-label">
              {d.day === today ? <span className="bv-activity-log__relative">{t("activityLog.today")}</span> : null}
              {d.day === yesterday ? <span className="bv-activity-log__relative">{t("activityLog.yesterday")}</span> : null}
              <span>{d.date}</span>
            </h4>
          ) : null}
          <ol className="bv-activity-log__list">
            {d.entries.map((e, i) => <ActivityEntry key={e.id ?? i} entry={e} expanded={expandChanges} />)}
          </ol>
        </section>
      ))}
    </div>
  );
};

ActivityLog.propTypes = {
  entries: PropTypes.arrayOf(entryShape),
  loading: PropTypes.bool,
  /** a message (shown) or true (the generic message) */
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  onRetry: PropTypes.func,
  emptyText: PropTypes.string,
  /** desc: newest first (default); asc: oldest first */
  order: PropTypes.oneOf(["desc", "asc"]),
  /** show the changed fields of every entry open */
  expandChanges: PropTypes.bool,
  className: PropTypes.string,
};

ActivityLog.defaultProps = { entries: [], loading: false, error: null, onRetry: null, emptyText: null, order: "desc", expandChanges: false, className: null };

export default ActivityLog;
