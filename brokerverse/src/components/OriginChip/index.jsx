/**
 * Origin of a business record: records loaded from the legacy system at go-live carry the API block
 * { kind: "migrated", legacySystem, legacyNumber, loadId, loadNumber, migratedAt, migratedByName }, records issued in
 * BrokerVerse { kind: "issued" }. The chip marks migrated records only; issued records show nothing.
 *
 *   <OriginChip origin={policy.origin} />                      Migrated · Legacy no. PC-MLY-2026-000101 · Load MIG-000012
 *   <OriginChip origin={policyOriginOf(claim)} variant="policy" />   Migrated policy · Legacy no. ...
 *   <OriginChip origin={policyOriginOf(renewal)} variant="renewal" />   Renewal of legacy policy · Legacy no. ...
 *   <OriginChip origin={row.origin} compact />                 the chip alone, with the legacy number in its tooltip (lists)
 *
 * The load number opens the load in Data Migration & Go-Live for holders of read:data-load and is plain text for others.
 */
import React, { useId } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Dropdown } from "primereact/dropdown";
import { Tooltip } from "primereact/tooltip";
import StatusChip from "../StatusChip";
import { hasPermission } from "../../utils/canOpen";
import { formatBusinessDateTime } from "../../utility/dateFormat";
import "./originChip.scss";

export const MIGRATED = "migrated";
export const ISSUED = "issued";
/** Address of a migration load in the workspace. */
export const loadPath = (loadId) => `/master/configuration/go-live/loads/${encodeURIComponent(loadId)}`;

/** True when the origin block (or the bare kind) is that of a migrated record. */
export const isMigrated = (origin) => (origin && typeof origin === "object" ? origin.kind : origin) === MIGRATED;

/** Origin block of the policy behind an endorsement, claim, renewal or bill (policyOrigin, policyLegacyNumber), or null. */
export const policyOriginOf = (record) => (record?.policyOrigin === MIGRATED ? { kind: MIGRATED, legacyNumber: record.policyLegacyNumber || null } : null);

const OriginChip = ({ origin, variant, compact, className }) => {
  const { t } = useTranslation();
  const id = `bv-origin-${useId().replace(/:/g, "")}`;
  if (!isMigrated(origin)) return null;
  const o = typeof origin === "object" ? origin : { kind: MIGRATED };
  const label = {
    policy: t("origin.migratedPolicy", "Migrated policy"),
    renewal: t("origin.renewalOfLegacyPolicy", "Renewal of legacy policy"),
  }[variant] || t("origin.migrated", "Migrated");
  const legacy = o.legacyNumber ? t("origin.legacyNo", { number: o.legacyNumber, defaultValue: "Legacy no. {{number}}" }) : null;
  const details = [
    o.legacySystem ? t("origin.legacySystem", { name: o.legacySystem, defaultValue: "Legacy system: {{name}}" }) : null,
    o.migratedAt ? t("origin.migratedAt", { time: formatBusinessDateTime(o.migratedAt), defaultValue: "Migrated {{time}}" }) : null,
    o.migratedByName ? t("origin.migratedBy", { name: o.migratedByName, defaultValue: "by {{name}}" }) : null,
  ].filter(Boolean);
  const tip = (compact ? [legacy, o.loadNumber ? t("origin.load", { number: o.loadNumber, defaultValue: "Load {{number}}" }) : null, ...details] : details).filter(Boolean);
  const load = !compact && o.loadNumber ? (
    hasPermission("read:data-load") && o.loadId
      ? <Link to={loadPath(o.loadId)} className="bv-origin__load">{t("origin.load", { number: o.loadNumber, defaultValue: "Load {{number}}" })}</Link>
      : <span className="bv-origin__load">{t("origin.load", { number: o.loadNumber, defaultValue: "Load {{number}}" })}</span>
  ) : null;
  return (
    <span className={["bv-origin", compact ? "bv-origin--compact" : null, className].filter(Boolean).join(" ")} data-testid="origin-chip">
      <span id={id} className="bv-origin__chip" aria-describedby={tip.length ? `${id}-tip` : undefined}>
        <StatusChip label={label} severity="info" />
      </span>
      {tip.length ? (
        <>
          <Tooltip target={`#${id}`} position="bottom">{tip.map((line) => <div key={line}>{line}</div>)}</Tooltip>
          <span id={`${id}-tip`} className="p-hidden-accessible">{tip.join(", ")}</span>
        </>
      ) : null}
      {!compact && legacy ? <span className="bv-origin__legacy">{legacy}</span> : null}
      {load}
    </span>
  );
};

OriginChip.propTypes = {
  /** the origin block of the API, or its kind ("migrated" / "issued") */
  origin: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({ kind: PropTypes.string })]),
  /** "policy": the record is issued in BrokerVerse on a migrated policy (endorsement, claim, bill); "renewal": the renewal of a migrated policy */
  variant: PropTypes.oneOf(["record", "policy", "renewal"]),
  /** the chip alone, the legacy number and load in its tooltip (list columns) */
  compact: PropTypes.bool,
  className: PropTypes.string,
};
OriginChip.defaultProps = { origin: null, variant: "record", compact: false, className: null };

/** Choices of the Origin filter of a list: All, Issued in BrokerVerse, Migrated (the value goes to the API as origin). */
export const useOriginOptions = () => {
  const { t } = useTranslation();
  return [
    { label: t("origin.all", "All"), value: "" },
    { label: t("origin.issued", "Issued in BrokerVerse"), value: ISSUED },
    { label: t("origin.migrated", "Migrated"), value: MIGRATED },
  ];
};

/** Origin filter of a list's filter bar. */
export const OriginFilter = ({ value, onChange, className, inputId }) => {
  const { t } = useTranslation();
  const options = useOriginOptions();
  return (
    <Dropdown inputId={inputId} value={value || ""} options={options} onChange={(e) => onChange(e.value || "")} className={className}
      aria-label={t("origin.title", "Origin")} placeholder={t("origin.title", "Origin")} data-testid="origin-filter" />
  );
};
OriginFilter.propTypes = { value: PropTypes.string, onChange: PropTypes.func.isRequired, className: PropTypes.string, inputId: PropTypes.string };
OriginFilter.defaultProps = { value: "", className: null, inputId: undefined };

/**
 * Body of an Origin column: the compact chip on migrated rows; "Migrated policy" on a record issued in BrokerVerse on a
 * migrated policy (claim, bill, renewal); nothing otherwise.
 */
export const originColumnBody = (row) => (isMigrated(row?.origin)
  ? <OriginChip origin={row.origin} compact />
  : <OriginChip origin={policyOriginOf(row)} variant="policy" compact />);

export default OriginChip;
