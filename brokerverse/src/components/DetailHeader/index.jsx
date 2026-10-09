/**
 * Head of a detail pop-up or side panel: the record number with its status chip, what the record belongs to, a row of
 * key facts (label above value, formatted by type) and the record's actions at the right.
 *
 *   <DetailHeader title={r.remittanceNo} status={{ code: r.statusCode, label: r.status }} subtitle={r.insurerName}
 *     meta={[{ label: netAmountLabel, value: r.netAmount, type: "amount" }, { label: dueDateLabel, value: r.dueDate, type: "date" }]}
 *     actions={<Button label={printLabel} icon="pi pi-print" outlined onClick={print} />} />
 */
import React from "react";
import PropTypes from "prop-types";
import StatusChip from "../StatusChip";
import { formatValue, NUMERIC_TYPES } from "../KeyValueGrid/formatValue";
import "./detailHeader.scss";

const DetailHeader = ({ title, subtitle, status, meta, actions, className }) => {
  const chip = typeof status === "string" ? { label: status } : status;
  const facts = (meta || []).filter((m) => m && !m.hidden);
  return (
    <div className={["bv-detail-header", className].filter(Boolean).join(" ")}>
      <div className="bv-detail-header__main">
        <div className="bv-detail-header__title-row">
          <h2 className="bv-detail-header__title">{title}</h2>
          {chip ? <StatusChip {...chip} /> : null}
        </div>
        {subtitle ? <div className="bv-detail-header__subtitle">{subtitle}</div> : null}
        {facts.length ? (
          <dl className="bv-detail-header__meta">
            {facts.map((m, i) => (
              <div key={m.key || (typeof m.label === "string" ? m.label : i)} className="bv-detail-header__fact">
                <dt>{m.label}</dt>
                <dd className={NUMERIC_TYPES.has(m.type) ? "bv-detail-header__num" : undefined}>{formatValue(m.value, m)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {actions ? <div className="bv-detail-header__actions">{actions}</div> : null}
    </div>
  );
};

DetailHeader.propTypes = {
  /** the record number (or name when it has none) */
  title: PropTypes.node.isRequired,
  /** the party or object the record belongs to */
  subtitle: PropTypes.node,
  /** "Pending Approval" or { code, label, severity } (components/StatusChip) */
  status: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({ code: PropTypes.string, label: PropTypes.string, severity: PropTypes.string })]),
  /** key facts: [{ label, value, type }] as components/KeyValueGrid items */
  meta: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.node.isRequired, value: PropTypes.any, type: PropTypes.string, hidden: PropTypes.bool })),
  actions: PropTypes.node,
  className: PropTypes.string,
};

DetailHeader.defaultProps = { subtitle: null, status: null, meta: [], actions: null, className: null };

export default DetailHeader;
