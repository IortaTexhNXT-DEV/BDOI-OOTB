import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "primereact/badge";
import { Button } from "primereact/button";
import { InputSwitch } from "primereact/inputswitch";
import { Message } from "primereact/message";
import { OverlayPanel } from "primereact/overlaypanel";
import { Skeleton } from "primereact/skeleton";
import { TabPanel, TabView } from "primereact/tabview";
import PageHeader from "../../components/PageHeader";
import LoadingBar from "../../components/LoadingBar";
import { mayViewTechnical } from "../../components/TechnicalDetails";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { confirmAction, notifyError } from "../../utility/dialogs";
import { changeCount, indexCatalogue, nextInGroup, roleGroups, visibleRoles } from "./roleAccess";
import RoleList from "./RoleList";
import RoleAccessPanel from "./RoleAccessPanel";
import RoleCompare, { MAX_COMPARED } from "./RoleCompare";
import RoleAccessChanges from "./RoleAccessChanges";
import { BASE_ROLES_KEY, TECHNICAL_NAMES_KEY, readPreference, useLabels, writePreference } from "./common";
import "../Administration/index.scss";
import "./index.scss";

const VIEWS = ["role", "compare", "pending"];
const NO_EDIT = { role: null, staged: {}, implied: [] };
const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);

const PageSkeleton = () => (
  <div className="rp-layout" role="status" aria-busy="true">
    <div className="rp-list">
      {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height="2rem" className="mb-2" />)}
    </div>
    <div className="rp-panel">
      <Skeleton width="18rem" height="1.75rem" className="mb-2" />
      <Skeleton width="24rem" height="1rem" className="mb-4" />
      {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height="8rem" className="mb-3" />)}
    </div>
  </div>
);

/**
 * Master > Users and Access > Role Permissions: what each role may do, organised like the menu. By role (roles by
 * department on the left, the access of the selected role on the right, editable), Compare roles (two to four side
 * by side) and Waiting for approval (changes of access another administrator approves). The state is in the address
 * (?view, role, roles, diff, change, base), so links from notifications and My Work open the right place.
 */
const RolePermissions = () => {
  const k = useLabels();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "role";
  const mayTechnical = useMemo(() => mayViewTechnical({ permission: "write:roles" }), []);
  const [technical, setTechnical] = useState(() => mayTechnical && readPreference(TECHNICAL_NAMES_KEY, false) === true);
  const [baseChoice, setBaseChoice] = useState(() => readPreference(BASE_ROLES_KEY, false) === true);
  const [edit, setEdit] = useState(NO_EDIT);
  const menu = useRef(null);

  const loader = useCallback(() => accessControlService.roleAccess(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const idx = useMemo(() => indexCatalogue(data?.catalogue), [data]);
  const allRoles = useMemo(() => data?.roles || [], [data]);
  const roleByCode = useMemo(() => Object.fromEntries(allRoles.map((r) => [r.code, r])), [allRoles]);

  // a platform role named in the address shows the platform roles
  const named = [params.get("role"), ...list(params.get("roles"))].filter(Boolean);
  const base = baseChoice || params.get("base") === "1" || named.some((c) => roleByCode[c]?.platform);
  const roles = useMemo(() => visibleRoles(allRoles, base), [allRoles, base]);
  const groups = useMemo(() => roleGroups(roles, data?.departments || [], { base }), [roles, data, base]);
  const selected = roleByCode[params.get("role")] ? params.get("role") : groups[0]?.items[0]?.code || null;
  const role = roleByCode[selected] || null;
  const compared = list(params.get("roles")).filter((c) => roleByCode[c]).slice(0, MAX_COMPARED);
  const editing = !!edit.role && edit.role === selected && view === "role";
  const dirty = editing && changeCount(edit.staged) > 0;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mayLeave = useCallback(async () => !dirty || confirmAction(k("rolePermissions.leaveConfirm", "Discard the changes you have not submitted?"),
    { header: k("rolePermissions.leaveTitle", "Changes not submitted"), acceptLabel: k("rolePermissions.discard", "Discard"), rejectLabel: k("cancel", "Cancel"), danger: true }),
  [dirty, k]);
  const go = useCallback(async (patch) => {
    if (!(await mayLeave())) return;
    setEdit(NO_EDIT);
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(patch).forEach(([key, value]) => (value === null || value === undefined || value === "" ? next.delete(key) : next.set(key, value)));
      if (next.get("view") === "role") next.delete("view");
      return next;
    }, { replace: true });
  }, [mayLeave, setParams]);

  const changeBase = (on) => {
    setBaseChoice(on);
    writePreference(BASE_ROLES_KEY, on);
    if (!on) go({ base: null, role: roleByCode[selected]?.platform ? null : selected });
  };
  const changeTechnical = (on) => {
    setTechnical(on);
    writePreference(TECHNICAL_NAMES_KEY, on);
  };
  const compareWith = () => {
    const next = nextInGroup(groups, selected);
    go({ view: "compare", roles: [selected, next].filter(Boolean).join(",") });
  };
  const exportExcel = async () => {
    let codes = [];
    if (view === "role") codes = groups.find((g) => g.items.some((r) => r.code === selected))?.items.map((r) => r.code) || [];
    if (view === "compare") codes = compared;
    if (view === "pending") codes = allRoles.filter((r) => r.pending).map((r) => r.code);
    try {
      await accessControlService.downloadRoleAccess({ roles: codes.join(",") || undefined, base: base ? 1 : undefined });
    } catch (e) {
      notifyError(e.message);
    }
  };
  const submitted = async () => {
    setEdit(NO_EDIT);
    await reload();
  };

  const actions = (
    <>
      <Button label={k("exportExcel", "Export to Excel")} icon="pi pi-file-excel" outlined onClick={exportExcel} disabled={!data} />
      {mayTechnical ? (
        <>
          <Button icon="pi pi-ellipsis-v" text rounded aria-label={k("rolePermissions.moreOptions", "More options")} onClick={(e) => menu.current?.toggle(e)} />
          <OverlayPanel ref={menu} className="rp-menu">
            <div className="rp-check">
              <InputSwitch inputId="rp-technical" checked={technical} onChange={(e) => changeTechnical(!!e.value)} />
              <label htmlFor="rp-technical">{k("rolePermissions.technicalNames", "Show technical names")}</label>
            </div>
          </OverlayPanel>
        </>
      ) : null}
    </>
  );
  const tabs = [
    { key: "role", label: k("rolePermissions.byRole", "By role"), icon: "pi pi-user" },
    { key: "compare", label: k("rolePermissions.compare", "Compare roles"), icon: "pi pi-clone" },
    { key: "pending", label: k("rolePermissions.waiting", "Waiting for approval"), icon: "pi pi-clock", badge: data?.pendingCount ?? null },
  ];

  let body = null;
  if (!data) {
    body = loading ? <PageSkeleton /> : null;
  } else if (view === "compare") {
    body = (
      <RoleCompare idx={idx} groups={groups} roles={roles} selected={compared.length ? compared : [selected, nextInGroup(groups, selected)].filter(Boolean)}
        diffOnly={params.get("diff") === "1"} technical={technical} onChange={(codes) => go({ roles: codes.join(",") })}
        onDiffOnly={(on) => go({ diff: on ? "1" : null })} onEditRole={(code) => go({ view: "role", role: code, roles: null, diff: null })} />
    );
  } else if (view === "pending") {
    body = (
      <RoleAccessChanges idx={idx} focus={Number(params.get("change")) || null} technical={technical} onChanged={reload}
        onOpenRole={(code) => go({ view: "role", role: code, change: null })} />
    );
  } else {
    body = (
      <div className="rp-layout">
        <RoleList groups={groups} selected={selected} onSelect={(code) => code !== selected && go({ role: code })} base={base} onBaseChange={changeBase} technical={technical} />
        <section className="rp-card rp-main bv-loading-host">
          <LoadingBar active={refreshing} />
          {role ? (
            <RoleAccessPanel key={role.code} role={role} idx={idx} roleByCode={roleByCode} technical={technical} approval={data.approval} editing={editing}
              staged={editing ? edit.staged : NO_EDIT.staged} implied={editing ? edit.implied : NO_EDIT.implied}
              onEdit={() => setEdit({ role: role.code, staged: {}, implied: [] })} onStage={(next) => setEdit((e) => ({ ...e, ...next }))}
              onDiscard={() => setEdit(NO_EDIT)} onSubmitted={submitted} onSelectRole={(code) => go({ role: code })} onCompare={compareWith} onChanged={reload} />
          ) : <div className="rp-empty">{k("rolePermissions.noRoleMatches", "No role matches")}</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="admin__page access__page rp-page">
      <PageHeader title={k("roleMatrixTitle", "Role Permissions")} home={k("master", "Master")} section={k("userManagement", "Users and Access")}
        trail={[k("roleMatrixTitle", "Role Permissions")]} actions={actions}
        help={k("rolePermissions.help", "What each role may do, by part of the system. A change applies once another administrator approves it.")} />
      <TabView className="bv-tabbar rp-tabs" activeIndex={VIEWS.indexOf(view)} onTabChange={(e) => go({ view: VIEWS[e.index], change: null })}>
        {tabs.map((t) => (
          <TabPanel key={t.key} leftIcon={`${t.icon} mr-2`} header={(
            <span className="rp-tab">
              {t.label}
              {t.badge !== null && t.badge !== undefined ? <Badge value={t.badge} severity={t.badge ? "warning" : "secondary"} className="rp-tab__badge" /> : null}
            </span>
          )} />
        ))}
      </TabView>
      {error ? (
        <div className="rp-error">
          <Message severity="error" text={error} />
          <Button label={k("rolePermissions.retry", "Try again")} text onClick={reload} />
        </div>
      ) : null}
      {body}
    </div>
  );
};

export default RolePermissions;
