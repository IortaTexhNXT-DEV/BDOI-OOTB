import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Checkbox } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import "./index.scss";

/** Roles shown before the search box is offered. */
const SEARCH_FROM = 10;

/**
 * Roles grouped for display: the standard roles of the product first, then each family of roles that share a code
 * prefix ("tis-sales-officer", "tis-finance": the TIS roles). A prefix of fewer than three roles, or one that is a
 * role code itself ("accounting" of "accounting-manager"), stays with the standard roles.
 */
export const groupRoles = (roles) => {
  const codes = new Set(roles.map((r) => r.value));
  const prefixOf = (code) => {
    const i = String(code).indexOf("-");
    return i > 0 ? String(code).slice(0, i) : "";
  };
  const counts = roles.reduce((acc, r) => {
    const p = prefixOf(r.value);
    if (p && !codes.has(p)) acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const groups = new Map([["", []]]);
  roles.forEach((r) => {
    const p = prefixOf(r.value);
    const key = p && !codes.has(p) && counts[p] >= 3 ? p : "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.entries()].filter(([, list]) => list.length).map(([key, list]) => ({ key, roles: list }));
};

/**
 * The roles of a user as an aligned grid of checkboxes in groups, with a search box for a long list and the number
 * chosen. `roles` are { value: code, label: name }; `value` the chosen codes.
 */
const RoleChecklist = ({ roles, value, onChange, disabled = false, invalid = false, id = "roles" }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const chosen = useMemo(() => new Set(value || []), [value]);
  const groups = useMemo(() => groupRoles(roles), [roles]);
  const needle = search.trim().toLowerCase();
  const matches = (r) => !needle || r.label.toLowerCase().includes(needle) || String(r.value).toLowerCase().includes(needle);
  const shown = groups.map((g) => ({ ...g, roles: g.roles.filter(matches) })).filter((g) => g.roles.length);

  const toggle = (code, checked) => {
    const next = (value || []).filter((c) => c !== code);
    onChange(checked ? [...next, code] : next);
  };
  const heading = (key) => (key ? t("generalMasters.roleGroup", { group: key.toUpperCase(), defaultValue: "{{group}} roles" }) : t("generalMasters.standardRoles", "Standard roles"));

  return (
    <div className={`bv-role-checklist${invalid ? " bv-role-checklist--invalid" : ""}`} id={id}>
      <div className="bv-role-checklist__bar">
        {roles.length >= SEARCH_FROM && (
          <span className="p-input-icon-left bv-role-checklist__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("generalMasters.searchRoles", "Search roles")}
              aria-label={t("generalMasters.searchRoles", "Search roles")} />
          </span>
        )}
        <span className="bv-role-checklist__count">{t("generalMasters.rolesSelected", { count: chosen.size, defaultValue: "{{count}} selected" })}</span>
      </div>
      {shown.map((g) => (
        <fieldset key={g.key || "standard"} className="bv-role-checklist__group">
          {groups.length > 1 && <legend className="bv-role-checklist__heading">{heading(g.key)}</legend>}
          <div className="bv-role-checklist__grid">
            {g.roles.map((r) => {
              const inputId = `${id}-${r.value}`;
              return (
                <div key={r.value} className={`bv-role-checklist__item${chosen.has(r.value) ? " is-checked" : ""}`}>
                  <Checkbox inputId={inputId} checked={chosen.has(r.value)} disabled={disabled} onChange={(e) => toggle(r.value, e.checked)} />
                  <label htmlFor={inputId}>{r.label}</label>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      {!shown.length && <p className="bv-role-checklist__empty">{t("generalMasters.noRolesMatch", "No role matches the search")}</p>}
    </div>
  );
};

RoleChecklist.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired })).isRequired,
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  invalid: PropTypes.bool,
  id: PropTypes.string,
};

export default RoleChecklist;
