import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { ColumnGroup } from "primereact/columngroup";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { Row } from "primereact/row";
import { Tag } from "primereact/tag";
import { SETTINGS_PATH, configurePath, mayConfigure } from "../../components/ConfigStatus";
import { cellState, columnGroups, departmentOptions, gapCount, limitValue, visibleRoles, visibleRows } from "./authorityFormat";
import { shortDate, useAccessNames, useLabels } from "./common";

/** One cell of the matrix: the limit (or Not set), a chip for a change waiting or scheduled; a button that opens the panel. */
const LimitCell = ({ row, role, cell, withoutLimit, onOpen }) => {
  const k = useLabels();
  const s = cellState(row, role, cell);
  const noLimit = k("noLimit", "No limit");
  if (s.kind === "cannot") {
    return <span className="am-cell am-cell--cannot" title={k("authority.cannotApprove", "This role has no access to this approval step")}>–</span>;
  }
  let text = k("notSet", "Not set");
  if (s.kind === "limit") text = limitValue(row.measure, cell.maxAmount, false, noLimit);
  const notSetHelp = withoutLimit === "refuse" ? k("authority.notSetRefuseTip", "No limit for this role. This role cannot approve")
    : k("authority.notSetAllowTip", "No limit for this role. Approvals are not restricted");
  const facts = s.kind === "notSet" ? notSetHelp : [cell.effectiveFrom ? k("authority.fromDate", "From {{date}}", { date: shortDate(cell.effectiveFrom) }) : null,
    cell.referenceNo, cell.approvedBy ? k("authority.approvedByName", "Approved by {{name}}", { name: cell.approvedBy }) : null].filter(Boolean).join(" · ");
  const pendingText = s.pending ? `${s.pending.ref}: ${s.pending.removes ? k("authority.removal", "Remove the limit")
    : limitValue(row.measure, s.pending.maxAmount, s.pending.unlimited, noLimit)} · ${k("authority.fromDate", "From {{date}}", { date: shortDate(s.pending.effectiveFrom) })}` : null;
  const shown = s.kind === "unlimited" ? noLimit : text;
  return (
    <button type="button" className={`am-cell am-cell--${s.kind}`} onClick={() => onOpen(row, role)} title={[facts, pendingText].filter(Boolean).join("\n")}
      aria-label={k("authority.cellLabel", "Approval limit of {{role}} for {{transaction}}: {{value}}", { role: role.name, transaction: row.name, value: shown })}>
      {s.kind === "unlimited" ? <Tag value={noLimit} className="am-chip-nolimit" /> : <span className="am-cell__value">{text}</span>}
      {s.pending ? <Tag severity="warning" className="am-cell__tag" value={s.pending.removes ? k("authority.removalPending", "Removal pending") : k("authority.pending", "Pending")} /> : null}
      {!s.pending && s.scheduled ? <Tag severity="info" className="am-cell__tag" value={k("authority.fromDate", "From {{date}}", { date: shortDate(s.scheduled.effectiveFrom) })} /> : null}
      {!s.pending && !s.scheduled && s.endsOn ? <Tag severity="secondary" className="am-cell__tag" value={k("authority.untilDate", "Until {{date}}", { date: shortDate(s.endsOn) })} /> : null}
    </button>
  );
};

LimitCell.propTypes = { row: PropTypes.object.isRequired, role: PropTypes.object.isRequired, cell: PropTypes.object, withoutLimit: PropTypes.string, onOpen: PropTypes.func.isRequired };

/**
 * Tab "Limits": transaction types down, roles across grouped by department. Filters: search, departments, approver
 * roles or all roles, the base platform roles, the transactions no approval step checks, the approver cells without
 * a limit. The rule for a cell without a limit is shown as a chip.
 */
const AuthorityLimitsTab = ({ data, filters, onFilters, technical, onOpen }) => {
  const k = useLabels();
  const names = useAccessNames();
  const [query, setQuery] = useState("");
  const { base, unchecked, scope, departments, gapsOnly } = filters;
  const set = (patch) => onFilters({ ...filters, ...patch });

  const allRows = useMemo(() => visibleRows(data, { query, unchecked, technical }), [data, query, unchecked, technical]);
  const rolesBefore = useMemo(() => visibleRoles(data, allRows, { base, departments, scope }), [data, allRows, base, departments, scope]);
  const rows = useMemo(() => (gapsOnly ? visibleRows(data, { query, unchecked, technical, gapsOnly, roles: rolesBefore }) : allRows),
    [gapsOnly, data, query, unchecked, technical, rolesBefore, allRows]);
  const roles = useMemo(() => visibleRoles(data, rows, { base, departments, scope, gapsOnly }), [data, rows, base, departments, scope, gapsOnly]);
  const groups = useMemo(() => columnGroups(data, roles, base), [data, roles, base]);
  const ordered = groups.flatMap((g) => g.items);
  const gaps = gapCount(data, { base });
  const ruleRefuse = data?.withoutLimit === "refuse";
  const settings = configurePath(SETTINGS_PATH, "security");

  const header = (
    <ColumnGroup>
      <Row>
        <Column header={k("colTransaction", "Transaction")} rowSpan={2} frozen className="am-col-type" />
        {groups.map((g) => <Column key={g.key} header={names.group(g)} colSpan={g.items.length} headerClassName="am-group" />)}
      </Row>
      <Row>
        {ordered.map((r) => (
          <Column key={r.code} headerClassName="am-role" header={(
            <span className="am-role__head" title={r.name}>
              <span className="am-role__name">{r.name}</span>
              {technical ? <span className="rp-code">{r.code}</span> : null}
            </span>
          )} />
        ))}
      </Row>
    </ColumnGroup>
  );

  let empty = k("authority.noMatch", "No transaction matches the search");
  if (rows.length && !ordered.length) empty = k("authority.noRole", "No role can approve these transactions");
  return (
    <div className="rp-card am-limits">
      <div className="rp-toolbar rp-toolbar--wrap am-toolbar">
        <span className="p-input-icon-left rp-search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={query} onChange={(e) => setQuery(e.target.value)} placeholder={k("authority.findTransaction", "Find a transaction")}
            aria-label={k("authority.findTransaction", "Find a transaction")} />
        </span>
        <MultiSelect value={departments} options={departmentOptions(data, base, names)} onChange={(e) => set({ departments: e.value })} display="chip" maxSelectedLabels={2}
          placeholder={k("authority.allDepartments", "All departments")} aria-label={k("authority.departments", "Departments")} className="am-filter" />
        <Dropdown value={scope} onChange={(e) => set({ scope: e.value })} aria-label={k("authority.roles", "Roles")} className="am-filter"
          options={[{ value: "approvers", label: k("authority.approverRoles", "Approver roles") }, { value: "all", label: k("allRoles", "All roles") }]} />
        <span className="rp-check">
          <InputSwitch inputId="am-base" checked={base} onChange={(e) => set({ base: !!e.value })} />
          <label htmlFor="am-base">{k("rolePermissions.includeBase", "Include base platform roles")}</label>
        </span>
        <span className="rp-check">
          <InputSwitch inputId="am-unchecked" checked={unchecked} onChange={(e) => set({ unchecked: !!e.value })} />
          <label htmlFor="am-unchecked">{k("authority.includeUnchecked", "Include transactions not checked yet")}</label>
        </span>
        <span className="am-spacer" />
        <span className={`am-rule${ruleRefuse ? " am-rule--refuse" : ""}`} role="status"
          title={ruleRefuse ? k("authority.ruleRefuseTip", "An approver whose roles have no limit for a transaction cannot approve it")
            : k("authority.ruleAllowTip", "An approver whose roles have no limit for a transaction may approve any amount")}>
          <span className="am-rule__dot" aria-hidden="true" />
          {ruleRefuse ? k("authority.ruleRefuse", "Without a limit: approvals refused") : k("authority.ruleAllow", "Without a limit: approvals not restricted")}
          {mayConfigure(settings) ? <Link to={settings} className="am-rule__link">{k("authority.configure", "Configure")}</Link> : null}
        </span>
        {gaps ? (
          <Button type="button" className={`am-gaps${gapsOnly ? " is-on" : ""}`} size="small" outlined={!gapsOnly} severity="warning" aria-pressed={gapsOnly}
            label={k("authority.gaps", "{{count}} approver limits not set", { count: gaps })} icon={gapsOnly ? "pi pi-filter-slash" : "pi pi-filter"}
            onClick={() => set({ gapsOnly: !gapsOnly })} />
        ) : null}
      </div>
      <DataTable value={rows} dataKey="code" size="small" scrollable headerColumnGroup={header} className="rp-table am-matrix" emptyMessage={empty}>
        <Column frozen className="am-col-type" body={(r) => (
          <span className="rp-cell-stack">
            <span className="am-type">{r.name}</span>
            <span className="rp-muted">
              {r.measure === "percent" ? k("measurePercent", "Percent of premium") : k("measureAmount", "Amount in PHP")}
              {r.step ? <i className="pi pi-info-circle am-type__info" title={k("authority.checkedAt", "Checked at {{step}}", { step: r.step })} aria-label={k("authority.checkedAt", "Checked at {{step}}", { step: r.step })} /> : null}
            </span>
            {!r.checked ? <Tag value={k("authority.notChecked", "Not checked by an approval step")} className="rp-tag-muted am-type__tag" /> : null}
            {technical ? <span className="rp-code">{r.code}</span> : null}
          </span>
        )} />
        {ordered.map((role) => (
          <Column key={role.code} className="am-col-role" body={(r) => <LimitCell row={r} role={role} cell={r.cells[role.code]} withoutLimit={data.withoutLimit} onOpen={onOpen} />} />
        ))}
      </DataTable>
      {rows.length && !ordered.length && scope === "approvers" ? (
        <Button label={k("authority.showAllRoles", "Show all roles")} link onClick={() => set({ scope: "all" })} />
      ) : null}
    </div>
  );
};

AuthorityLimitsTab.propTypes = {
  data: PropTypes.object.isRequired,
  filters: PropTypes.shape({ base: PropTypes.bool, unchecked: PropTypes.bool, scope: PropTypes.string, departments: PropTypes.array, gapsOnly: PropTypes.bool }).isRequired,
  onFilters: PropTypes.func.isRequired,
  technical: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
};

export default AuthorityLimitsTab;
