/**
 * Head of a detail pop-up or side panel: the record number with its status chip, what the record belongs to, a row of
 * key facts (label above value, formatted by type) and the record's actions at the right.
 *
 *   <DetailHeader title={r.remittanceNo} status={{ code: r.statusCode, label: r.status }} subtitle={r.insurerName}
 *     meta={[{ label: netAmountLabel, value: r.netAmount, type: "amount" }, { label: dueDateLabel, value: r.dueDate, type: "date" }]}
 *     actions={<Button label={printLabel} icon="pi pi-print" outlined onClick={print} />} />
 *
 * Optional for a record page: `flags` (chips beside the status, each with its text: "Off-cycle", "Overdue"), `sod` (one
 * line naming who prepared, submitted and decides it) and `steps`, the lifecycle stepper with the date and person of
 * each step reached.
 *
 *   <DetailHeader ... flags={[{ key: "offCycle", label: offCycleLabel, severity: "info" }]} sod={sodLine}
 *     steps={[{ key: "draft", label: draftLabel, state: "done", date: r.createdAt, person: "M. Reyes" },
 *       { key: "approval", label: approvalLabel, state: "current" }, { key: "paid", label: paidLabel }]} />
 */
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import StatusChip from "../StatusChip";
import { formatValue, NUMERIC_TYPES } from "../KeyValueGrid/formatValue";
import "./detailHeader.scss";

const STEP_STATES = ["done", "current", "pending"];

const Steps = ({ steps }) => {
  const { t } = useTranslation();
  return (
    <ol className="bv-detail-header__steps" aria-label={t("detailHeader.lifecycle")}>
      {steps.map((step, i) => {
        const state = STEP_STATES.includes(step.state) ? step.state : "pending";
        return (
          <li key={step.key || i} className={`bv-detail-header__step bv-detail-header__step--${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="bv-detail-header__step-mark" aria-hidden="true">{state === "done" ? <i className="pi pi-check" /> : i + 1}</span>
            <span className="bv-detail-header__step-text">
              <span className="bv-detail-header__step-label">{step.label}</span>
              {step.date || step.person ? (
                <span className="bv-detail-header__step-meta">
                  {[step.date ? formatValue(step.date, { type: step.dateType || "datetime" }) : null, step.person].filter(Boolean).join(" · ")}
                </span>
              ) : null}
              {state === "current" ? <span className="p-sr-only">{t("detailHeader.currentStep")}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const DetailHeader = ({ title, subtitle, status, meta, actions, className, flags, sod, steps }) => {
  const chip = typeof status === "string" ? { label: status } : status;
  const facts = (meta || []).filter((m) => m && !m.hidden);
  const chips = (flags || []).filter((f) => f && !f.hidden && f.label);
  return (
    <div className={["bv-detail-header", className].filter(Boolean).join(" ")}>
      <div className="bv-detail-header__main">
        <div className="bv-detail-header__title-row">
          <h2 className="bv-detail-header__title">{title}</h2>
          {chip ? <StatusChip {...chip} /> : null}
          {chips.map((f) => <StatusChip key={f.key || f.label} label={f.label} severity={f.severity || "secondary"} className="bv-detail-header__flag" />)}
        </div>
        {subtitle ? <div className="bv-detail-header__subtitle">{subtitle}</div> : null}
        {sod ? <div className="bv-detail-header__sod">{sod}</div> : null}
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
        {steps && steps.length ? <Steps steps={steps} /> : null}
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
  /** chips beside the status, each with its own text: [{ key, label, severity }] */
  flags: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, severity: PropTypes.string, hidden: PropTypes.bool })),
  /** segregation of duties in one line ("Prepared by M. Reyes · Submitted by M. Reyes · Awaiting J. Cruz") */
  sod: PropTypes.node,
  /** lifecycle stepper: [{ key, label, state: done / current / pending, date, dateType (datetime or date), person }] */
  steps: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string, label: PropTypes.node.isRequired, state: PropTypes.oneOf(STEP_STATES), date: PropTypes.string, dateType: PropTypes.string, person: PropTypes.string,
  })),
};

Steps.propTypes = { steps: DetailHeader.propTypes.steps.isRequired };

DetailHeader.defaultProps = { subtitle: null, status: null, meta: [], actions: null, className: null, flags: [], sod: null, steps: [] };

export default DetailHeader;
