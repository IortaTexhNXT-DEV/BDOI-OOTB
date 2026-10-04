import React, { useState } from "react";
import PropTypes from "prop-types";

const LONG = 140;
const DASH = "—";

/** A value of the trail: a dash when empty, "Hidden" for a secret, long text cut with "Show more". */
const Value = ({ value, masked, old }) => {
  const [open, setOpen] = useState(false);
  if (masked) return <span className="bv-audit-value bv-audit-value--hidden"><i className="pi pi-lock" aria-hidden="true" /> Hidden</span>;
  if (value === null || value === undefined || value === "") return <span className="bv-audit-value bv-audit-value--empty" aria-label="empty">{DASH}</span>;
  const text = String(value);
  const long = text.length > LONG;
  return (
    <span className={`bv-audit-value${old ? " bv-audit-value--old" : ""}`}>
      {old ? <span className="bv-sr-only">was </span> : null}
      {long && !open ? `${text.slice(0, LONG).trimEnd()}…` : text}
      {long ? (
        <button type="button" className="bv-audit-more" onClick={() => setOpen(!open)}>{open ? "Show less" : "Show more"}</button>
      ) : null}
    </span>
  );
};

Value.propTypes = { value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), masked: PropTypes.bool, old: PropTypes.bool };
Value.defaultProps = { value: null, masked: false, old: false };

/**
 * The fields an event changed, one line each: label, old value (struck through, muted), new value. A creation lists the
 * values set (no old value), a deletion the values removed. More than `max` lines fold behind "Show all".
 */
const AuditChanges = ({ changes, max }) => {
  const [all, setAll] = useState(false);
  if (!changes?.length) return null;
  const shown = all ? changes : changes.slice(0, max);
  // a creation (no field had a value before) lists the values set; otherwise an empty old value shows as a dash
  const withOld = changes.some((c) => c.from !== null && c.from !== undefined);
  return (
    <div className="bv-audit-changes">
      <dl>
        {shown.map((c) => (
          <div className="bv-audit-change" key={c.key}>
            <dt>{c.label}</dt>
            <dd>
              {withOld ? (
                <>
                  <Value value={c.from} masked={!!c.masked && c.from !== null} old={c.from !== null && c.from !== undefined} />
                  <i className="pi pi-arrow-right bv-audit-arrow" aria-hidden="true" />
                </>
              ) : null}
              <Value value={c.to} masked={!!c.masked && c.to !== null} />
            </dd>
          </div>
        ))}
      </dl>
      {changes.length > max ? (
        <button type="button" className="bv-audit-more bv-audit-more--block" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${changes.length} fields`}
        </button>
      ) : null}
    </div>
  );
};

AuditChanges.propTypes = {
  changes: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, from: PropTypes.any, to: PropTypes.any, masked: PropTypes.bool })),
  max: PropTypes.number,
};
AuditChanges.defaultProps = { changes: [], max: 8 };

export default AuditChanges;
