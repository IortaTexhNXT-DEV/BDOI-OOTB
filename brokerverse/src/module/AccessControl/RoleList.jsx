import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { ListBox } from "primereact/listbox";
import { Tag } from "primereact/tag";
import { useAccessNames, useLabels } from "./common";

const NARROW = "(max-width: 991px)";

/** True below 992px, where the role list becomes a drop-down above the panel. */
const mediaQuery = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(NARROW) : null);
const useNarrow = () => {
  const [narrow, setNarrow] = useState(() => !!mediaQuery()?.matches);
  useEffect(() => {
    const query = mediaQuery();
    if (!query?.addEventListener) return undefined;
    const update = () => setNarrow(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
};

/** Chips of a role in the list: waiting for approval, inactive, full access. */
export const RoleChips = ({ role }) => {
  const k = useLabels();
  return (
    <span className="rp-chips">
      {role.pending ? <Tag value={k("rolePermissions.pendingChip", "Pending")} severity="warning" /> : null}
      {role.status !== "active" ? <Tag value={k("rolePermissions.inactiveChip", "Inactive")} className="rp-tag-muted" title={k("rolePermissions.inactiveHint", "An inactive role grants no access")} /> : null}
      {role.fullAccess ? <Tag value={k("rolePermissions.fullAccessChip", "Full access")} severity="info" /> : null}
    </span>
  );
};

RoleChips.propTypes = { role: PropTypes.object.isRequired };

/**
 * Left panel of By role: the roles grouped by department with their active users, a filter and "Include base platform
 * roles". Arrow keys move through the list and typing finds a role (ListBox).
 */
const RoleList = ({ groups, selected, onSelect, base, onBaseChange, technical }) => {
  const k = useLabels();
  const names = useAccessNames();
  const narrow = useNarrow();
  const options = useMemo(() => groups.map((g) => ({ ...g, label: names.group(g), items: g.items })), [groups, names]);

  const item = (role) => (
    <div className="rp-role">
      <span className="rp-role__main">
        <span className="rp-role__name">{role.name}</span>
        {technical ? <span className="rp-code">{role.code}</span> : null}
        <RoleChips role={role} />
      </span>
      <span className="rp-role__users" title={k("rolePermissions.activeUsers", "{{count}} active users", { count: role.users.active })}>{role.users.active}</span>
    </div>
  );
  const groupHeader = (g) => (
    <div className="rp-group">
      <span>{g.label}</span>
      <span className="rp-group__count">{g.items.length}</span>
    </div>
  );
  const baseBox = (
    <div className="rp-check">
      <Checkbox inputId="rp-base-roles" checked={base} onChange={(e) => onBaseChange(!!e.checked)} />
      <label htmlFor="rp-base-roles">{k("rolePermissions.includeBase", "Include base platform roles")}</label>
    </div>
  );

  if (narrow) {
    return (
      <div className="rp-rolepick">
        <Dropdown value={selected} options={options} optionLabel="name" optionValue="code" optionGroupLabel="label" optionGroupChildren="items"
          optionGroupTemplate={groupHeader} itemTemplate={item} filter filterBy="name,code" onChange={(e) => onSelect(e.value)} className="w-full"
          placeholder={k("rolePermissions.chooseRole", "Choose a role")} aria-label={k("rolePermissions.roles", "Roles")} />
        {baseBox}
      </div>
    );
  }
  return (
    <aside className="rp-list" aria-label={k("rolePermissions.roles", "Roles")}>
      <div className="rp-list__head">
        <h2>{k("rolePermissions.roles", "Roles")}</h2>
        {baseBox}
      </div>
      <ListBox value={selected} options={options} optionLabel="name" optionValue="code" optionGroupLabel="label" optionGroupChildren="items"
        optionGroupTemplate={groupHeader} itemTemplate={item} filter filterBy="name,code" filterPlaceholder={k("rolePermissions.findRole", "Find a role")}
        emptyFilterMessage={k("rolePermissions.noRoleMatches", "No role matches")} onChange={(e) => e.value && onSelect(e.value)} className="rp-listbox"
        listStyle={{ maxHeight: "calc(100vh - 20rem)" }} />
    </aside>
  );
};

RoleList.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, items: PropTypes.array })).isRequired,
  selected: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  base: PropTypes.bool,
  onBaseChange: PropTypes.func.isRequired,
  technical: PropTypes.bool,
};

export default RoleList;
