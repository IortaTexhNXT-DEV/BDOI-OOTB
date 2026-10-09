import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import accessControlService from "../../services/accessControlService";
import { useStableLoad } from "../../hooks/useStableLoad";
import { canOpen } from "../../utils/canOpen";
import { confirmAction } from "../../utility/dialogs";
import { cellState, changeCount, moduleMatches, modulesWithAccess, stagedDelta, toggleLevel, viewDependents } from "./roleAccess";
import { ChangeActions, ChangeDetails, changeCounts, useChangeActions } from "./RoleAccessChanges";
import RoleAccessReview, { SodWarning } from "./RoleAccessReview";
import { dateTime, useAccessNames, useLabels } from "./common";

const ROLE_PATH = "/master/generals/usermanagement/role";
const MATRIX_PATH = "/master/generals/usermanagement/access-matrix";
const LEVEL_COLUMNS = ["view", "edit", "approve", "special"];

/** One level of a module: a check, a dash or "n/a" to read; a switch while editing (locked when it comes from elsewhere). */
const LevelCell = ({ cell, editing, label, viaName, technical, onToggle }) => {
  const k = useLabels();
  if (!cell.code) return <span className="rp-na" aria-label={k("rolePermissions.notAvailable", "Not available")}>{k("rolePermissions.na", "n/a")}</span>;
  const through = cell.how === "included" ? k("rolePermissions.through", "Through {{role}}", { role: viaName }) : null;
  const marker = cell.change || cell.pending;
  let mark;
  if (editing && !cell.locked) {
    mark = <InputSwitch checked={cell.on} onChange={(e) => onToggle(!!e.value)} aria-label={label} className="rp-switch" />;
  } else if (cell.on) {
    mark = cell.how === "included"
      ? <i className="pi pi-link rp-through" role="img" aria-label={`${label}: ${through}`} title={through} />
      : <i className="pi pi-check rp-yes" role="img" aria-label={`${label}: ${k("rolePermissions.granted", "Granted")}`} />;
  } else {
    mark = <span className="rp-no" role="img" aria-label={`${label}: ${k("rolePermissions.notGranted", "Not granted")}`}>—</span>;
  }
  return (
    <span className="rp-cell">
      <span className="rp-cell__mark">
        {mark}
        {editing && cell.locked ? <i className="pi pi-lock rp-lock" title={through || k("rolePermissions.locked", "Basic access stays on for every role")} aria-hidden="true" /> : null}
      </span>
      {marker === "added" ? <Tag value={cell.change ? k("rolePermissions.added", "Added") : k("rolePermissions.pendingAdded", "Pending: added")} className="rp-tag-added" /> : null}
      {marker === "removed" ? <Tag value={cell.change ? k("rolePermissions.removed", "Removed") : k("rolePermissions.pendingRemoved", "Pending: removed")} className="rp-tag-removed" /> : null}
      {technical ? <span className="rp-code">{cell.code}</span> : null}
    </span>
  );
};

LevelCell.propTypes = {
  cell: PropTypes.object.isRequired, editing: PropTypes.bool, label: PropTypes.string, viaName: PropTypes.string, technical: PropTypes.bool, onToggle: PropTypes.func,
};

/**
 * Right panel of By role: the selected role (department, users, status, included roles), its change waiting for
 * approval, and its access area by area like the menu, each module with View / Create and edit / Approve (and Special).
 * Edit access turns the levels into switches; the changes are reviewed and submitted for approval.
 */
const RoleAccessPanel = ({ role, idx, roleByCode, technical, approval, editing, staged, implied, onEdit, onStage, onDiscard, onSubmitted, onSelectRole, onCompare, onChanged }) => {
  const k = useLabels();
  const names = useAccessNames();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [onlyGranted, setOnlyGranted] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const actions = useChangeActions(onChanged);

  const count = changeCount(staged);
  const delta = useMemo(() => stagedDelta(staged), [staged]);
  const checkLoader = useCallback(() => accessControlService.checkRoleAccess(role.code, delta), [role.code, delta]);
  const { data: check } = useStableLoad(checkLoader, { enabled: editing && count > 0, debounceMs: 400 });
  const liveCheck = editing && count > 0 ? check : null;
  const warnings = liveCheck?.warnings || [];

  const roleName = (code) => roleByCode[code]?.name || code;
  const moduleNames = useCallback((m) => [names.module(m), names.area(idx.area(m.area)), ...m.levels.map((l) => names.level(l))], [names, idx]);
  const areas = useMemo(() => idx.areas.map((a) => {
    const all = idx.modulesOf(a.code);
    const granted = modulesWithAccess(idx, role, staged, a.code);
    const rows = all.filter((m) => moduleMatches(idx, m, query, { technical, names: moduleNames }))
      .filter((m) => editing || !onlyGranted || granted.includes(m) || m.levels.some((l) => cellState(idx, role, staged, m.code, l).pending));
    return { area: a, rows, granted: granted.length, total: all.length, special: idx.areaHasSpecial(a.code) };
  }).filter((x) => x.rows.length), [idx, role, staged, query, technical, moduleNames, editing, onlyGranted]);

  const toggle = async (module, level, on) => {
    if (!on && level === "view") {
      const others = viewDependents(idx, role, staged, module.code);
      if (others.length && !(await confirmAction(k("rolePermissions.viewOffConfirm", "Turning off View also turns off {{levels}} of {{module}}. Continue?",
        { levels: others.map((c) => names.level(idx.permission(c).level)).join(", "), module: names.module(module) })))) return;
    }
    const r = toggleLevel(idx, role, staged, module.code, level, on);
    onStage({ staged: r.staged, implied: [...implied.filter((c) => !r.dropped.includes(c) && r.staged[c]), ...r.implied] });
  };
  const scrollTo = (code) => document.getElementById(`rp-area-${code}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });

  const blockedText = role.editBlocked ? k(`rolePermissions.blocked.${role.editBlocked}`, {
    "no-permission": "You may view the access of roles but not change it",
    "full-access": "This role has full access; it is not changed here",
    "own-role": "You cannot change the access of a role you hold",
    pending: "A change of this role is waiting for approval",
  }[role.editBlocked]) : null;
  const department = role.platform ? k("basePlatformRoles", "Base platform roles") : role.department ? names.group({ key: role.department, label: role.department }) : k("otherRoles", "Other roles");
  const changedRow = (m) => {
    const marks = m.levels.map((l) => cellState(idx, role, staged, m.code, l).change).filter(Boolean);
    if (!marks.length) return "";
    return marks.includes("removed") ? "rp-row--removed" : "rp-row--added";
  };

  const header = (
    <header className="rp-panel__head">
      <div className="rp-panel__title">
        <h2>{role.name}</h2>
        <div className="rp-facts">
          <span>{department}</span>
          {canOpen(MATRIX_PATH)
            ? (
              <button type="button" className="rp-linkbtn" onClick={() => navigate(`${MATRIX_PATH}?role=${encodeURIComponent(role.code)}`)}>
                {k("rolePermissions.usersCount", "{{count}} users", { count: role.users.active })}
              </button>
            )
            : <span>{k("rolePermissions.usersCount", "{{count}} users", { count: role.users.active })}</span>}
          <Tag value={role.status === "active" ? k("rolePermissions.active", "Active") : k("rolePermissions.inactiveChip", "Inactive")} severity={role.status === "active" ? "success" : null}
            className={role.status === "active" ? "" : "rp-tag-muted"} />
          {role.inherits.map((c) => (
            <button key={c} type="button" className="rp-linkbtn" onClick={() => onSelectRole(c)}>{k("rolePermissions.includes", "Includes {{role}}", { role: roleName(c) })}</button>
          ))}
          {technical ? <span className="rp-code">{role.code}</span> : null}
        </div>
      </div>
      <div className="rp-panel__actions">
        <Button label={k("rolePermissions.compareWith", "Compare with…")} icon="pi pi-clone" outlined onClick={onCompare} disabled={editing} />
        {canOpen(ROLE_PATH) && role.id ? <Button label={k("rolePermissions.roleDetails", "Role details")} outlined onClick={() => navigate(`${ROLE_PATH}/view/${role.id}`)} /> : null}
        {!editing ? (
          <Button label={k("rolePermissions.editAccess", "Edit access")} icon="pi pi-pencil" disabled={!!role.editBlocked} onClick={onEdit}
            tooltip={blockedText || undefined} tooltipOptions={{ showOnDisabled: true, position: "bottom" }} />
        ) : null}
      </div>
    </header>
  );

  if (role.fullAccess) {
    return (
      <div className="rp-panel">
        {header}
        <div className="rp-full">
          <i className="pi pi-shield" aria-hidden="true" />
          <div>
            <strong>{k("rolePermissions.fullAccess", "Full access: every module and level")}</strong>
            <span className="rp-muted">{k("rolePermissions.fullAccessUsers", "{{count}} active users hold it", { count: role.users.active })}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rp-panel">
      {header}
      {role.pending && !editing ? (
        <div className="rp-banner" role="status">
          <i className="pi pi-clock" aria-hidden="true" />
          <div className="rp-banner__text">
            <strong>{k("rolePermissions.waiting", "Waiting for approval")}</strong>
            <span>{k("rolePermissions.requestedBy", "{{who}}, {{when}}", { who: role.pending.requestedBy, when: dateTime(role.pending.requestedAt) })}</span>
            <span>{changeCounts(role.pending)} · {role.pending.payload?.reason || role.pending.changeNote}</span>
          </div>
          <div className="rp-banner__actions">
            <Button label={k("rolePermissions.viewChange", "View change")} text size="small" onClick={() => setChangeOpen(true)} />
            <ChangeActions change={role.pending} actions={actions} affected={role.users.active} />
          </div>
        </div>
      ) : null}

      <nav className="rp-areanav" aria-label={k("rolePermissions.areas", "Areas")}>
        {areas.map(({ area, granted }) => (
          <button key={area.code} type="button" className="rp-areanav__item" onClick={() => scrollTo(area.code)}>
            {names.area(area)}<span className="rp-areanav__count">{granted}</span>
          </button>
        ))}
      </nav>
      <div className="rp-toolbar">
        <span className="p-input-icon-left rp-search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={query} onChange={(e) => setQuery(e.target.value)} placeholder={k("rolePermissions.findModule", "Find a module or screen")}
            aria-label={k("rolePermissions.findModule", "Find a module or screen")} />
        </span>
        {!editing ? (
          <div className="rp-check">
            <Checkbox inputId="rp-only-granted" checked={onlyGranted} onChange={(e) => setOnlyGranted(!!e.checked)} />
            <label htmlFor="rp-only-granted">{k("rolePermissions.onlyGranted", "Only modules with access")}</label>
          </div>
        ) : null}
      </div>

      {!areas.length ? (
        <div className="rp-empty">
          <span>{query ? k("rolePermissions.noModuleMatches", "No module matches \"{{query}}\"", { query }) : k("rolePermissions.noAccess", "This role has no access yet")}</span>
          {query ? <Button label={k("rolePermissions.clear", "Clear")} text onClick={() => setQuery("")} /> : null}
        </div>
      ) : null}

      {areas.map(({ area, rows, granted, total, special }) => {
        const open = !collapsed[area.code] || !!query;
        const levels = LEVEL_COLUMNS.filter((l) => l !== "special" || special);
        return (
          <section key={area.code} id={`rp-area-${area.code}`} className="rp-area">
            <button type="button" className="rp-area__head" aria-expanded={open} onClick={() => setCollapsed((c) => ({ ...c, [area.code]: open }))}>
              <i className={`pi ${open ? "pi-chevron-down" : "pi-chevron-right"}`} aria-hidden="true" />
              <h3>{names.area(area)}</h3>
              <span className="rp-area__count">{k("rolePermissions.modulesWithAccess", "{{count}} of {{total}} modules", { count: granted, total })}</span>
            </button>
            {open ? (
              <DataTable value={rows} dataKey="code" size="small" className="rp-table" rowClassName={changedRow}>
                <Column header={k("rolePermissions.colModule", "Module")} body={(m) => (
                  <span className="rp-cell-stack">
                    <span className="rp-module">{names.module(m)}</span>
                    {m.screens?.length ? <span className="rp-muted">{m.screens.join(", ")}</span> : null}
                  </span>
                )} />
                {levels.map((level) => (
                  <Column key={level} header={names.level(level)} headerClassName="rp-level-col" bodyClassName="rp-level-col" body={(m) => {
                    const cell = cellState(idx, role, staged, m.code, level);
                    return (
                      <LevelCell cell={cell} editing={editing} technical={technical} viaName={roleName(cell.via)} onToggle={(on) => toggle(m, level, on)}
                        label={`${names.level(level)}, ${names.module(m)}, ${role.name}`} />
                    );
                  }} />
                ))}
              </DataTable>
            ) : null}
          </section>
        );
      })}

      {editing && warnings.length ? <ul className="rp-sod-list rp-sod-list--inline">{warnings.map((w) => <SodWarning key={`${w.code}-${w.scope}`} warning={w} idx={idx} />)}</ul> : null}
      {editing ? (
        <div className="rp-editbar" role="region" aria-label={k("rolePermissions.editing", "Changes not submitted")}>
          <span className="rp-editbar__text">
            {k("rolePermissions.changeCount", "{{count}} changes", { count })}
            {warnings.length ? (
              <span className={liveCheck?.blocked ? "rp-editbar__blocked" : "rp-editbar__warn"}>
                {` · ${k("rolePermissions.sodCount", "{{count}} segregation of duties warnings", { count: warnings.length })}`}
              </span>
            ) : null}
          </span>
          <Button label={k("rolePermissions.discard", "Discard")} text onClick={onDiscard} />
          <Button label={k("rolePermissions.review", "Review and submit")} icon="pi pi-arrow-right" iconPos="right" disabled={!count || !!liveCheck?.blocked}
            onClick={() => setReviewOpen(true)} />
        </div>
      ) : null}

      {reviewOpen ? (
        <RoleAccessReview visible role={role} idx={idx} staged={staged} implied={implied} check={liveCheck} approval={approval} onHide={() => setReviewOpen(false)}
          onSubmitted={(r) => { setReviewOpen(false); onSubmitted(r); }} />
      ) : null}
      {role.pending ? (
        <Dialog header={k("rolePermissions.changeTitle", "Change {{ref}} of {{role}}", { ref: role.pending.ref, role: role.name })} visible={changeOpen} onHide={() => setChangeOpen(false)}
          style={{ width: "36rem" }} modal>
          <ChangeDetails change={role.pending} idx={idx} />
        </Dialog>
      ) : null}
    </div>
  );
};

RoleAccessPanel.propTypes = {
  role: PropTypes.object.isRequired,
  idx: PropTypes.object.isRequired,
  roleByCode: PropTypes.object.isRequired,
  technical: PropTypes.bool,
  approval: PropTypes.bool,
  editing: PropTypes.bool,
  staged: PropTypes.object.isRequired,
  implied: PropTypes.arrayOf(PropTypes.string).isRequired,
  onEdit: PropTypes.func.isRequired,
  onStage: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSubmitted: PropTypes.func.isRequired,
  onSelectRole: PropTypes.func.isRequired,
  onCompare: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
};

export default RoleAccessPanel;
