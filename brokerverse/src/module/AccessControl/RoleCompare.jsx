import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { compareRows } from "./roleAccess";
import { useAccessNames, useLabels } from "./common";

export const MAX_COMPARED = 4;

/**
 * Tab "Compare roles": two to four roles side by side, module by module and area by area, with the levels each holds;
 * a marker and a tint on the rows where they differ, and "Show differences only".
 */
const RoleCompare = ({ idx, groups, roles, selected, diffOnly, technical, onChange, onDiffOnly, onEditRole }) => {
  const k = useLabels();
  const names = useAccessNames();
  const [query, setQuery] = useState("");
  const roleByCode = useMemo(() => Object.fromEntries(roles.map((r) => [r.code, r])), [roles]);
  const compared = useMemo(() => selected.map((c) => roleByCode[c]).filter(Boolean), [selected, roleByCode]);
  const options = useMemo(() => groups.map((g) => ({ label: names.group(g), items: g.items.map((r) => ({ label: r.name, value: r.code })) })), [groups, names]);
  const moduleNames = useCallback((m) => [names.module(m), names.area(idx.area(m.area)), ...m.levels.map((l) => names.level(l))], [names, idx]);
  const rows = useMemo(() => (compared.length > 1 ? compareRows(idx, compared, { diffOnly, query, technical, names: moduleNames }) : []), [idx, compared, diffOnly, query, technical, moduleNames]);

  const levelChips = (role, row) => {
    if (role.fullAccess) return <Tag value={k("rolePermissions.fullAccessChip", "Full access")} severity="info" />;
    const held = row.cells[role.code];
    if (!held.length) return <span className="rp-no" aria-label={k("rolePermissions.notGranted", "Not granted")}>—</span>;
    return (
      <span className="rp-chips">
        {held.map((x) => {
          const title = x.how === "included" ? k("rolePermissions.through", "Through {{role}}", { role: roleByCode[x.via]?.name || x.via }) : undefined;
          const pending = x.pending === "added" ? k("rolePermissions.pendingAdded", "Pending: added") : x.pending === "removed" ? k("rolePermissions.pendingRemoved", "Pending: removed") : null;
          return (
            <Tag key={x.level} value={pending ? `${names.level(x.level)} (${pending})` : names.level(x.level)} title={title}
              className={`rp-level-tag${x.how === "included" ? " rp-level-tag--through" : ""}${x.pending ? ` rp-level-tag--${x.pending}` : ""}`} />
          );
        })}
      </span>
    );
  };

  const roleHeader = (role) => (
    <span className="rp-cell-stack">
      <span className="rp-compare__role">{role.name}</span>
      <span className="rp-muted">{role.platform ? k("basePlatformRoles", "Base platform roles") : role.department ? names.group({ key: role.department, label: role.department }) : k("otherRoles", "Other roles")} · {k("rolePermissions.usersCount", "{{count}} users", { count: role.users.active })}</span>
      {technical ? <span className="rp-code">{role.code}</span> : null}
      {!role.fullAccess && !role.editBlocked ? <button type="button" className="rp-linkbtn" onClick={() => onEditRole(role.code)}>{k("rolePermissions.editAccess", "Edit access")}</button> : null}
    </span>
  );

  let empty = null;
  if (compared.length < 2) empty = k("rolePermissions.chooseTwo", "Choose at least two roles");
  else if (!rows.length) empty = query ? k("rolePermissions.noModuleMatches", "No module matches \"{{query}}\"", { query }) : k("rolePermissions.sameAccess", "These roles have the same access");

  return (
    <div className="rp-card">
      <div className="rp-toolbar rp-toolbar--wrap">
        <MultiSelect value={selected} options={options} optionGroupLabel="label" optionGroupChildren="items" display="chip" filter selectionLimit={MAX_COMPARED}
          onChange={(e) => onChange(e.value)} placeholder={k("rolePermissions.chooseRoles", "Choose two to four roles")} className="rp-compare__pick"
          aria-label={k("rolePermissions.roles", "Roles")} showSelectAll={false} />
        <div className="rp-check">
          <InputSwitch inputId="rp-diff-only" checked={diffOnly} onChange={(e) => onDiffOnly(!!e.value)} />
          <label htmlFor="rp-diff-only">{k("rolePermissions.diffOnly", "Show differences only")}</label>
        </div>
        <span className="p-input-icon-left rp-search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={query} onChange={(e) => setQuery(e.target.value)} placeholder={k("rolePermissions.findModule", "Find a module or screen")}
            aria-label={k("rolePermissions.findModule", "Find a module or screen")} />
        </span>
      </div>
      {empty ? <div className="rp-empty"><span>{empty}</span>{query ? <Button label={k("rolePermissions.clear", "Clear")} text onClick={() => setQuery("")} /> : null}</div> : (
        <DataTable value={rows} dataKey="key" size="small" scrollable className="rp-table rp-compare" rowGroupMode="subheader" groupRowsBy="area"
          rowClassName={(r) => (r.differs ? "rp-row--differs" : "")}
          rowGroupHeaderTemplate={(r) => <span className="rp-compare__area">{names.area(idx.area(r.area))}</span>}>
          <Column header={k("rolePermissions.colModule", "Module")} frozen style={{ minWidth: "16rem" }} body={(r) => (
            <span className="rp-compare__module">
              {r.differs ? <i className="pi pi-circle-fill rp-differs" title={k("rolePermissions.differs", "The roles differ")} aria-label={k("rolePermissions.differs", "The roles differ")} /> : null}
              <span className="rp-module">{names.module(r.module)}</span>
            </span>
          )} />
          {compared.map((role) => <Column key={role.code} header={roleHeader(role)} style={{ minWidth: "12rem" }} body={(r) => levelChips(role, r)} />)}
        </DataTable>
      )}
    </div>
  );
};

RoleCompare.propTypes = {
  idx: PropTypes.object.isRequired,
  groups: PropTypes.array.isRequired,
  roles: PropTypes.array.isRequired,
  selected: PropTypes.arrayOf(PropTypes.string).isRequired,
  diffOnly: PropTypes.bool,
  technical: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onDiffOnly: PropTypes.func.isRequired,
  onEditRole: PropTypes.func.isRequired,
};

export default RoleCompare;
