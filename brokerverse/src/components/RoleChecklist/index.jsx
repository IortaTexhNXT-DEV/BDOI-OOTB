import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Checkbox } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import "./index.scss";

/** Roles shown before the search box is offered. */
const SEARCH_FROM = 10;
const OTHER = "";

/**
 * Roles grouped for display: one group per department, in the order of the setting access.role_groups (the order of
 * each role's groupOrder), then Other roles: the roles in no department. A role of the base platform (platform) is
 * not offered for a new assignment; it is listed under Other roles only while the user holds it (`kept`), so it can be
 * taken off.
 */
export const groupRoles = (roles, kept = new Set()) => {
  const offered = roles.filter((r) => !r.platform || kept.has(r.value));
  const order = (r) => (r.groupOrder === null || r.groupOrder === undefined ? Number.MAX_SAFE_INTEGER : r.groupOrder);
  const groups = new Map();
  [...offered].sort((a, b) => order(a) - order(b)).forEach((r) => {
    const key = r.department || OTHER;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  const other = groups.get(OTHER);
  groups.delete(OTHER);
  if (other) groups.set(OTHER, other);
  return [...groups.entries()].map(([key, list]) => ({ key, roles: list }));
};

/**
 * The roles of a user as an aligned grid of checkboxes grouped by department, each with its one-line description, a
 * search box for a long list and the number chosen. `roles` are { value: code, label: name, description, department,
 * groupOrder, platform }; `value` the chosen codes.
 */
const RoleChecklist = ({ roles, value, onChange, disabled = false, invalid = false, id = "roles" }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [kept, setKept] = useState(() => new Set());
  const chosen = useMemo(() => new Set(value || []), [value]);
  // a platform role the user holds stays listed after it is unticked, until the form is left
  useEffect(() => {
    setKept((prev) => {
      const held = roles.filter((r) => r.platform && chosen.has(r.value) && !prev.has(r.value));
      return held.length ? new Set([...prev, ...held.map((r) => r.value)]) : prev;
    });
  }, [roles, chosen]);
  const groups = useMemo(() => groupRoles(roles, kept), [roles, kept]);
  const needle = search.trim().toLowerCase();
  const matches = (r) => !needle || [r.label, r.value, r.description, r.department].some((v) => String(v || "").toLowerCase().includes(needle));
  const shown = groups.map((g) => ({ ...g, roles: g.roles.filter(matches) })).filter((g) => g.roles.length);
  const count = groups.reduce((n, g) => n + g.roles.length, 0);

  const toggle = (code, checked) => {
    const next = (value || []).filter((c) => c !== code);
    onChange(checked ? [...next, code] : next);
  };
  const heading = (key) => key || t("generalMasters.otherRoles", "Other roles");

  return (
    <div className={`bv-role-checklist${invalid ? " bv-role-checklist--invalid" : ""}`} id={id}>
      <div className="bv-role-checklist__bar">
        {count >= SEARCH_FROM && (
          <span className="p-input-icon-left bv-role-checklist__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("generalMasters.searchRoles", "Search roles")}
              aria-label={t("generalMasters.searchRoles", "Search roles")} />
          </span>
        )}
        <span className="bv-role-checklist__count">{t("generalMasters.rolesSelected", { count: chosen.size, defaultValue: "{{count}} selected" })}</span>
      </div>
      {shown.map((g) => (
        <fieldset key={g.key || "other"} className="bv-role-checklist__group">
          {(groups.length > 1 || g.key) && <legend className="bv-role-checklist__heading">{heading(g.key)}</legend>}
          <div className="bv-role-checklist__grid">
            {g.roles.map((r) => {
              const inputId = `${id}-${r.value}`;
              return (
                <div key={r.value} className={`bv-role-checklist__item${chosen.has(r.value) ? " is-checked" : ""}`}>
                  <Checkbox inputId={inputId} checked={chosen.has(r.value)} disabled={disabled} onChange={(e) => toggle(r.value, e.checked)} />
                  <label htmlFor={inputId}>
                    <span className="bv-role-checklist__name">{r.label}</span>
                    {r.description ? <span className="bv-role-checklist__description" title={r.description}>{r.description}</span> : null}
                  </label>
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
  roles: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    department: PropTypes.string,
    groupOrder: PropTypes.number,
    platform: PropTypes.bool,
  })).isRequired,
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  invalid: PropTypes.bool,
  id: PropTypes.string,
};

export default RoleChecklist;
