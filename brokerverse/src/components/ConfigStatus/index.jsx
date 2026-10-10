import React, { useId, useRef } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OverlayPanel } from "primereact/overlaypanel";
import { canOpen, hasPermission } from "../../utils/canOpen";
import { ADMIN_ROLES, getUserRoles } from "../../utils/menuPermissions";
import "./index.scss";

/** Master > Configuration (System Configuration > Configuration). */
export const SETTINGS_PATH = "/master/configuration/settings";
export const CONFIG_STATES = ["ready", "incomplete", "off"];

const SETTING_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const KEY_IN_BRACKETS = /\s*\([^)]*\b[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*[^)]*\)/g;
const MENU_PATH_IN_BRACKETS = /\s*\([^)]*\s>\s[^)]*\)/g;

/**
 * The missing items as business words: a setting key or a menu path in brackets is cut from an item and an item that
 * is only a setting key is left out, so a key passed by mistake never reaches the screen.
 */
export const businessItems = (items = []) => items
  .map((item) => (typeof item === "string" ? item.replace(KEY_IN_BRACKETS, "").replace(MENU_PATH_IN_BRACKETS, "").trim() : item))
  .filter((item) => item !== "" && item !== null && item !== undefined && !(typeof item === "string" && SETTING_KEY.test(item)));

/** The address of the configuration screen; `area` opens one area of Master > Configuration. */
export const configurePath = (to, area) => (area ? `${to}${to.includes("?") ? "&" : "?"}area=${encodeURIComponent(area)}` : to);

/**
 * True when the signed-in user may change the configuration behind a chip: `permission` when given (an administrator
 * holds every permission), otherwise the administrator role; and the user's menu must reach the screen.
 */
export const mayConfigure = (path, permission) => {
  const allowed = permission ? hasPermission(permission) : getUserRoles().some((role) => ADMIN_ROLES.includes(role));
  return allowed && canOpen(path.split("?")[0]);
};

/**
 * Compact chip for a feature that works only once it is configured (an e-invoicing connection, a CAS permit, a
 * numbering series): Ready, Incomplete or Off. When items are missing, or when the user may configure the feature,
 * the chip opens a small panel with the missing items and, for those users only, a Configure link to the screen
 * where it is set up.
 */
const ConfigStatus = ({ state, feature, missing = [], to = SETTINGS_PATH, area, permission, className = "" }) => {
  const { t } = useTranslation();
  const panel = useRef(null);
  const panelId = `bv-config-${useId().replace(/:/g, "")}`;
  const items = businessItems(missing);
  const path = configurePath(to, area);
  const configurable = mayConfigure(path, permission);
  const stateLabel = t(`configStatus.state.${state}`, { defaultValue: state });
  const name = feature ? `${feature}: ${stateLabel}` : stateLabel;
  const classes = `bv-config-status bv-config-status--${state} ${className}`.trim();
  const body = (
    <>
      <span className="bv-config-status__dot" aria-hidden="true" />
      {feature && <span className="bv-config-status__feature">{feature}</span>}
      <span className="bv-config-status__state">{stateLabel}</span>
    </>
  );

  if (!items.length && !configurable) return <span className={classes} role="status" aria-label={name}>{body}</span>;
  return (
    <>
      <button type="button" className={`${classes} bv-config-status--action`} aria-label={name} aria-haspopup="dialog" aria-controls={panelId} onClick={(e) => panel.current?.toggle(e)}>
        {body}
        <i className="pi pi-angle-down bv-config-status__caret" aria-hidden="true" />
      </button>
      <OverlayPanel ref={panel} id={panelId} className="bv-config-status__panel" role="dialog" aria-label={name}>
        <div className="bv-config-status__panel-title">{name}</div>
        {items.length > 0 && (
          <>
            <div className="bv-config-status__panel-label">{t("configStatus.missing", "Missing")}</div>
            <ul className="bv-config-status__missing">
              {items.map((item, i) => <li key={typeof item === "string" ? item : i}>{item}</li>)}
            </ul>
          </>
        )}
        {configurable && (
          <Link className="bv-config-status__configure" to={path} onClick={() => panel.current?.hide()}>
            <i className="pi pi-cog" aria-hidden="true" />
            {t("configStatus.configure", "Configure")}
          </Link>
        )}
      </OverlayPanel>
    </>
  );
};

ConfigStatus.propTypes = {
  /** ready: everything set; incomplete: switched on but items are missing; off: switched off */
  state: PropTypes.oneOf(CONFIG_STATES).isRequired,
  /** business name of the feature shown before the state ("E-invoicing", "CAS permit") */
  feature: PropTypes.string,
  /** what is missing, in business words ("BIR permit number", "Backup custodian") */
  missing: PropTypes.arrayOf(PropTypes.node),
  /** screen where the feature is configured (Master > Configuration by default) */
  to: PropTypes.string,
  /** area of Master > Configuration to open (company, accounting, notifications ...) */
  area: PropTypes.string,
  /** permission that may configure it (an API permission such as write:masters); the administrator role when left out */
  permission: PropTypes.string,
  className: PropTypes.string,
};

export default ConfigStatus;
