import React, { useCallback, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { InputSwitch } from "primereact/inputswitch";
import { Message } from "primereact/message";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import { mayViewTechnical } from "../../components/TechnicalDetails";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { formatDate } from "../../utility/dateFormat";
import { notifyError } from "../../utility/dialogs";
import { roleGroups, visibleRoles } from "./roleAccess";

/** Labels of the access control screens (en.json "accessControl"), with the English text as the fallback. */
export const useLabels = () => {
  const { t } = useTranslation();
  return useCallback((key, fallback, values) => t(`accessControl.${key}`, { defaultValue: fallback, ...(values || {}) }), [t]);
};

/** Dates and date-times in the configured format (System Settings general.date_format), like every other screen. */
export const shortDate = (d) => formatDate(d, { empty: "" });
export const dateTime = (d) => formatDate(d, { withTime: true, empty: "" });

/**
 * Per-viewer choices of the access screens (include the base platform roles, show technical names), kept in this
 * browser only; a blocked or empty storage gives the default.
 */
export const BASE_ROLES_KEY = "bv.access.baseRoles";
export const TECHNICAL_NAMES_KEY = "bv.access.technicalNames";
export const readPreference = (key, fallback = false) => {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
export const writePreference = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // the choice then lasts for this visit only
  }
};

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Names of the access catalogue in the user's language, the server's English name as the fallback: areas, modules,
 * levels, and the department groups of the role lists.
 */
export const useAccessNames = () => {
  const k = useLabels();
  const area = useCallback((a) => (a ? k(`areas.${a.code}`, a.name) : ""), [k]);
  // a module added after this release (code "other:<module>") has only the server's name
  const module = useCallback((m) => (m ? (m.code.includes(":") ? m.name : k(`modules.${m.code}`, m.name)) : ""), [k]);
  const level = useCallback((code) => k(`levels.${code}`, { view: "View", edit: "Create and edit", approve: "Approve", special: "Special" }[code] || code), [k]);
  const group = useCallback((g) => (g.label ? k(`departments.${slug(g.key)}`, g.label) : g.key === "platform"
    ? k("basePlatformRoles", "Base platform roles") : k("otherRoles", "Other roles")), [k]);
  return { area, module, level, group };
};

/** The search parameters of the page as state: `set({ key: value })` changes them (empty removes), without a new history entry. */
export const useQueryState = () => {
  const [params, setParams] = useSearchParams();
  const set = useCallback((patch) => setParams((current) => {
    const next = new URLSearchParams(current);
    Object.entries(patch).forEach(([key, value]) => (value === null || value === undefined || value === "" || value === false ? next.delete(key) : next.set(key, value)));
    return next;
  }, { replace: true }), [setParams]);
  return [params, set];
};

/** Role directory of the access screens (GET /access-control/directory): departments, roles, settings, abilities. */
export const useDirectory = () => {
  const loader = useCallback(() => accessControlService.directory(), []);
  return useStableLoad(loader);
};

/**
 * "Include base platform roles", remembered for every access screen in this browser; a base platform role named in
 * the address turns it on.
 */
export const useBaseRoles = (forced = false) => {
  const [choice, setChoice] = useState(() => readPreference(BASE_ROLES_KEY, false) === true);
  const change = useCallback((on) => {
    setChoice(on);
    writePreference(BASE_ROLES_KEY, on);
  }, []);
  return [choice || forced, change];
};

/** "Show technical names" for the users who may see them (administrators), remembered in this browser. */
export const useTechnicalNames = (permission = "write:access-control") => {
  const allowed = useMemo(() => mayViewTechnical({ permission }), [permission]);
  const [on, setOn] = useState(() => allowed && readPreference(TECHNICAL_NAMES_KEY, false) === true);
  const change = useCallback((value) => {
    setOn(value);
    writePreference(TECHNICAL_NAMES_KEY, value);
  }, []);
  return { allowed, technical: allowed && on, setTechnical: change };
};

/** The ⋮ button of a page header with the "Show technical names" switch (nothing for other users). */
export const TechnicalSwitch = ({ allowed, technical, onChange, id = "access-technical" }) => {
  const k = useLabels();
  const panel = useRef(null);
  if (!allowed) return null;
  return (
    <>
      <Button icon="pi pi-ellipsis-v" text rounded aria-label={k("rolePermissions.moreOptions", "More options")} onClick={(e) => panel.current?.toggle(e)} />
      <OverlayPanel ref={panel} className="rp-menu">
        <div className="rp-check">
          <InputSwitch inputId={id} checked={technical} onChange={(e) => onChange(!!e.value)} />
          <label htmlFor={id}>{k("rolePermissions.technicalNames", "Show technical names")}</label>
        </div>
      </OverlayPanel>
    </>
  );
};

TechnicalSwitch.propTypes = { allowed: PropTypes.bool, technical: PropTypes.bool, onChange: PropTypes.func.isRequired, id: PropTypes.string };

/** The "Include base platform roles" check box of a toolbar. */
/** Access controls of Role Permissions: the switches that decide how access is enforced (approved by a second administrator). */
export const ACCESS_CONTROLS_PATH = "/master/generals/usermanagement/role-permissions?controls=1";

export const BaseRolesCheck = ({ checked, onChange, id = "access-base-roles" }) => {
  const k = useLabels();
  return (
    <span className="rp-check">
      <Checkbox inputId={id} checked={checked} onChange={(e) => onChange(!!e.checked)} />
      <label htmlFor={id}>{k("rolePermissions.includeBase", "Include base platform roles")}</label>
    </span>
  );
};

BaseRolesCheck.propTypes = { checked: PropTypes.bool, onChange: PropTypes.func.isRequired, id: PropTypes.string };

/**
 * Options of a role picker grouped by department (Dropdown / MultiSelect with optionGroupLabel "label" and
 * optionGroupChildren "items"): TISPH roles, the base platform roles only with `base`, active roles unless `inactive`.
 */
export const useRoleOptions = (directory, { base = false, inactive = false } = {}) => {
  const names = useAccessNames();
  return useMemo(() => {
    const roles = visibleRoles(directory?.roles || [], base).filter((r) => inactive || r.status === "active");
    return roleGroups(roles, directory?.departments || [], { base })
      .map((g) => ({ label: names.group(g), items: g.items.map((r) => ({ label: r.name, value: r.code, code: r.code })) }));
  }, [directory, base, inactive, names]);
};

/** Department options of a filter, in the order of the directory. */
export const useDepartmentOptions = (directory) => {
  const names = useAccessNames();
  return useMemo(() => (directory?.departments || []).map((d) => ({ label: names.group({ key: d.name, label: d.name }), value: d.name })), [directory, names]);
};

/** Download an export and say so when it fails. */
export const download = async (fn) => {
  try {
    await fn();
  } catch (e) {
    notifyError(e.message);
  }
};

/** A name with a muted second line (username, department, date). */
export const TwoLines = ({ main, sub, code }) => (
  <span className="rp-cell-stack">
    <span>{main}</span>
    {sub ? <span className="rp-muted">{sub}</span> : null}
    {code ? <span className="rp-code">{code}</span> : null}
  </span>
);

TwoLines.propTypes = { main: PropTypes.node, sub: PropTypes.node, code: PropTypes.node };

/** Empty state of a list: icon, one line and, when given, the action. */
export const EmptyState = ({ icon = "pi pi-inbox", text, action }) => (
  <div className="rp-empty access-empty">
    <i className={icon} aria-hidden="true" />
    <span>{text}</span>
    {action || null}
  </div>
);

EmptyState.propTypes = { icon: PropTypes.string, text: PropTypes.node.isRequired, action: PropTypes.node };

/** A load error inside a card with Try again; the data on screen is kept. */
export const LoadError = ({ error, onRetry }) => {
  const k = useLabels();
  if (!error) return null;
  return (
    <div className="rp-error">
      <Message severity="error" text={error} />
      <Button label={k("rolePermissions.retry", "Try again")} text onClick={onRetry} />
    </div>
  );
};

LoadError.propTypes = { error: PropTypes.string, onRetry: PropTypes.func };

/** Severity of every status of the four screens (text is always shown, colour is not the only signal). */
export const STATUS_SEVERITY = {
  pending: "warning", "awaiting-signoff": "warning", scheduled: "info", "in-effect": "success", ended: null, "ended-early": null, rejected: "danger", withdrawn: null,
  open: "warning", accepted: null, expired: "warning", closed: "success", active: "success", inactive: null, locked: "danger",
};

/** Severity of the StatusChip of a status of these screens (neutral when none). */
export const severityOf = (status) => STATUS_SEVERITY[status] || "secondary";

/** The chip of one conflict: Block or Warn while open, neutral when accepted, waiting for approval. */
export const ConflictChip = ({ conflict }) => {
  const k = useLabels();
  if (conflict.state === "accepted") {
    return <Tag className="rp-tag-muted" value={k("uam.acceptedUntil", "{{rule}} · exception to {{date}}", { rule: conflict.name, date: shortDate(conflict.validUntil) })} />;
  }
  if (conflict.state === "pending") return <Tag severity="warning" value={k("uam.exceptionWaiting", "{{rule}} · exception waiting for approval", { rule: conflict.name })} />;
  return <Tag severity={conflict.action === "block" ? "danger" : "warning"} value={conflict.name} icon={conflict.state === "expired" ? "pi pi-history" : undefined} />;
};

ConflictChip.propTypes = { conflict: PropTypes.object.isRequired };
