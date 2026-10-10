import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Menu } from "primereact/menu";
import { Tag } from "primereact/tag";
import LoadingBar from "../../components/LoadingBar";
import { visibleRules } from "./sod";
import { BaseRolesCheck, EmptyState, LoadError, StatusTag, TwoLines, dateTime, useLabels } from "./common";

const SHOWN = 3;

/** Access of one side of a rule as chips ("Users › Create and edit", the full path on hover), the rest behind "+n more". */
const AccessChips = ({ names }) => {
  const k = useLabels();
  const short = (name) => String(name).split(" › ").slice(-2).join(" › ");
  const rest = names.slice(SHOWN);
  return (
    <div className="access-chips">
      {names.slice(0, SHOWN).map((n) => <Tag key={n} value={short(n)} title={n} className="rp-tag-muted" />)}
      {rest.length ? <Tag value={k("sod.more", "+{{count}} more", { count: rest.length })} title={rest.join("\n")} className="rp-tag-muted" /> : null}
    </div>
  );
};

AccessChips.propTypes = { names: PropTypes.arrayOf(PropTypes.string).isRequired };

/**
 * Tab "Rules": each rule with the two roles (or the two sets of access), Block or Warn, the users breaking it, its
 * status and the change waiting for approval. Rules between two base platform roles show with "Include base platform
 * roles". Edit and switch off or on open the rule panel (each a change approved by another administrator).
 */
const SodRulesTab = ({ state, base, onBase, technical, onEdit, onUsers }) => {
  const k = useLabels();
  const menu = useRef(null);
  const [menuRow, setMenuRow] = useState(null);
  const rows = visibleRules(state.data?.rows || [], base);
  const edit = !!state.data?.abilities?.edit;
  const hidden = (state.data?.rows || []).length - rows.length;

  const between = (r) => (r.kind === "access" ? (
    <div className="sod-sides">
      <AccessChips names={r.accessANames} />
      <span className="rp-muted sod-sides__with">{k("sod.notWith", "not combined with")}</span>
      <AccessChips names={r.accessBNames} />
    </div>
  ) : (
    <TwoLines main={`${r.roleAName || r.roleA} + ${r.roleBName || r.roleB}`} sub={[r.roleADepartment, r.roleBDepartment].filter(Boolean).filter((d, i, a) => a.indexOf(d) === i).join(" · ")} />
  ));
  const menuItems = menuRow ? [
    { label: k("edit", "Edit"), icon: "pi pi-pencil", command: () => onEdit(menuRow), disabled: !menuRow.canEdit },
    { label: menuRow.active ? k("switchOff", "Switch off") : k("sod.switchOn", "Switch on"), icon: menuRow.active ? "pi pi-power-off" : "pi pi-play",
      command: () => onEdit({ ...menuRow, toggle: true }), disabled: !menuRow.canEdit },
    { label: k("sod.showUsers", "Show the users"), icon: "pi pi-users", command: () => onUsers(menuRow), disabled: !menuRow.users },
  ] : [];

  return (
    <div className="rp-card bv-loading-host">
      <LoadingBar active={state.refreshing} />
      <div className="rp-toolbar rp-toolbar--wrap">
        <BaseRolesCheck checked={base} onChange={onBase} id="sod-base" />
        {hidden ? <span className="rp-muted">{k("sod.hiddenRules", "{{count}} rules between base platform roles are hidden", { count: hidden })}</span> : null}
      </div>
      <LoadError error={state.error} onRetry={state.reload} />
      <DataTable value={rows} dataKey="id" loading={state.loading} size="small" className="rp-table access-table" scrollable
        emptyMessage={<EmptyState icon="pi pi-sitemap" text={k("noRules", "No rule")}
          action={edit ? <Button label={k("newRule", "New rule")} icon="pi pi-plus" text onClick={() => onEdit(null)} /> : null} />}>
        <Column header={k("colRule", "Rule")} sortable sortField="name" body={(r) => <TwoLines main={<strong>{r.name}</strong>} sub={r.reason} code={technical ? r.code : null} />}
          style={{ minWidth: "16rem" }} />
        <Column header={k("colBetween", "Between")} body={between} style={{ minWidth: "20rem" }} />
        <Column header={k("colAction", "When assigned")} body={(r) => <Tag value={r.action === "block" ? k("actionBlock", "Block") : k("actionWarn", "Warn")}
          severity={r.action === "block" ? "danger" : "warning"} />} />
        <Column header={k("sod.colUsers", "Users")} body={(r) => (r.users ? <Button label={String(r.users)} link className="rp-linkbtn" onClick={() => onUsers(r)}
          aria-label={k("sod.usersOf", "Users breaking {{rule}}", { rule: r.name })} /> : <span className="rp-muted">0</span>)} className="am-num-col" />
        <Column header={k("colStatus", "Status")} body={(r) => (
          <TwoLines main={r.change ? <StatusTag status="pending" label={k("changes.waiting", "Waiting for approval")} />
            : <StatusTag status={r.active ? "active" : "inactive"} label={r.active ? k("on", "On") : k("off", "Off")} />}
          sub={r.change ? r.change.ref : r.updatedBy ? `${r.updatedBy} · ${dateTime(r.updatedAt)}` : null} />
        )} />
        {edit ? (
          <Column header="" className="bv-actions" body={(r) => (
            <Button icon="pi pi-ellipsis-v" text rounded aria-haspopup="menu" aria-label={k("sod.ruleActions", "Actions for {{rule}}", { rule: r.name })}
              onClick={(e) => { setMenuRow(r); menu.current?.toggle(e); }} />
          )} />
        ) : null}
      </DataTable>
      <Menu ref={menu} popup model={menuItems} />
      {state.data?.pendingNew?.length ? (
        <p className="rp-muted access-note">{k("sod.newWaiting", "New rules waiting for approval: {{names}}", { names: state.data.pendingNew.map((c) => c.targetLabel).join(", ") })}</p>
      ) : null}
    </div>
  );
};

SodRulesTab.propTypes = {
  state: PropTypes.object.isRequired, base: PropTypes.bool, onBase: PropTypes.func.isRequired, technical: PropTypes.bool, onEdit: PropTypes.func.isRequired,
  onUsers: PropTypes.func.isRequired,
};

export default SodRulesTab;
