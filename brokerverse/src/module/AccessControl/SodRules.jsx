import React, { useCallback, useMemo, useState } from "react";
import { Badge } from "primereact/badge";
import { Button } from "primereact/button";
import { TabPanel, TabView } from "primereact/tabview";
import LoadingBar from "../../components/LoadingBar";
import PageHeader from "../../components/PageHeader";
import StatCards from "../../components/StatCards";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import AccessChanges from "./AccessChanges";
import SodConflictsTab from "./SodConflictsTab";
import SodExceptionPanel from "./SodExceptionPanel";
import SodRulePanel from "./SodRulePanel";
import SodRulesTab from "./SodRulesTab";
import { TABS, sodStats } from "./sod";
import { LoadError, TechnicalSwitch, download, useBaseRoles, useDirectory, useLabels, useQueryState, useTechnicalNames } from "./common";
import "../Administration/index.scss";
import "./index.scss";

/**
 * Master > Users and Access > Segregation of Duties: roles one person should not hold together and access a role or
 * a person should not combine. Tabs Conflicts (the users breaking a rule, by user, with their exceptions), Rules and
 * Waiting for approval (?tab, user, rule, change). Rule changes and exceptions wait for another administrator's
 * approval. Exports to Excel for audit.
 */
const SodRules = () => {
  const k = useLabels();
  const [params, set] = useQueryState();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "conflicts";
  const { allowed, technical, setTechnical } = useTechnicalNames();
  const { data: directory } = useDirectory();
  const rulesLoader = useCallback(() => accessControlService.sodRules(), []);
  const rules = useStableLoad(rulesLoader);
  const allUsers = params.get("all") === "1";
  const conflictsLoader = useCallback(() => accessControlService.sodConflicts({ status: allUsers ? "all" : undefined }), [allUsers]);
  const conflicts = useStableLoad(conflictsLoader);
  const [base, setBase] = useBaseRoles(params.get("base") === "1");
  const [rulePanel, setRulePanel] = useState(null);
  const [exceptionFor, setExceptionFor] = useState(null);

  const data = rules.data;
  const stats = useMemo(() => sodStats(conflicts.data?.rows || [], data?.rows || [], conflicts.data?.asOf), [conflicts.data, data]);
  const pendingCount = useMemo(() => (data?.rows || []).filter((r) => r.change).length + (data?.pendingNew || []).length
    + (conflicts.data?.rows || []).filter((c) => c.state === "pending").length, [data, conflicts.data]);
  const reloadAll = useCallback(async () => {
    await Promise.all([rules.reload(), conflicts.reload()]);
  }, [rules, conflicts]);
  const edit = !!data?.abilities?.edit;
  const ready = !!data && !!conflicts.data;
  const show = (patch) => set({ tab: null, rule: null, user: null, state: null, ...patch });

  const cards = [
    { key: "users", label: k("sod.statUsers", "Users with conflicts"), value: ready ? stats.users : null,
      note: ready ? k("sod.openNote", "{{count}} open", { count: stats.openUsers }) : null, onClick: () => show({}), active: tab === "conflicts" && !params.get("state") },
    { key: "accepted", label: k("sod.statAccepted", "Accepted exceptions"), value: ready ? stats.accepted : null, onClick: () => show({ state: "accepted" }),
      active: tab === "conflicts" && params.get("state") === "accepted" },
    { key: "ending", label: k("sod.statEnding", "Exceptions ending in 30 days"), value: ready ? stats.endingSoon : null, onClick: () => show({ state: "accepted" }) },
    { key: "rules", label: k("sod.statActiveRules", "Active rules"), value: ready ? stats.rulesOn : null,
      note: ready && stats.platformOn ? k("sod.platformRulesNote", "And {{count}} for base platform roles", { count: stats.platformOn }) : null,
      onClick: () => set({ tab: "rules" }), active: tab === "rules" },
  ];

  const actions = (
    <>
      <Button label={k("exportExcel", "Export to Excel")} icon="pi pi-file-excel" outlined disabled={!data}
        onClick={() => download(() => accessControlService.downloadSod({ technical: technical ? 1 : undefined, base: base ? 1 : undefined }))} />
      {edit ? <Button label={k("newRule", "New rule")} icon="pi pi-plus" onClick={() => setRulePanel({ rule: null })} /> : null}
      <TechnicalSwitch allowed={allowed} technical={technical} onChange={setTechnical} id="sod-technical" />
    </>
  );
  const tabs = [
    { key: "conflicts", label: k("sod.tabConflicts", "Conflicts"), icon: "pi pi-users" },
    { key: "rules", label: k("sod.tabRules", "Rules"), icon: "pi pi-sitemap" },
    { key: "pending", label: k("changes.waiting", "Waiting for approval"), icon: "pi pi-clock", badge: ready ? pendingCount : null },
  ];

  let body = null;
  if (tab === "pending") {
    body = <AccessChanges kinds="sod-rule,sod-exception" focus={Number(params.get("change")) || null} onChanged={reloadAll} />;
  } else if (tab === "rules") {
    body = <SodRulesTab state={rules} base={base} onBase={setBase} technical={technical} onEdit={(rule) => setRulePanel({ rule })}
      onUsers={(rule) => show({ rule: String(rule.id) })} />;
  } else {
    body = <SodConflictsTab state={conflicts} rules={data?.rows || []} directory={directory} technical={technical} onException={setExceptionFor} onChanged={reloadAll} />;
  }

  return (
    <div className="admin__page access__page rp-page access-page">
      <PageHeader title={k("sodTitle", "Segregation of Duties")} home={k("master", "Master")} section={k("userManagement", "Users and Access")}
        trail={[k("sodTitle", "Segregation of Duties")]} actions={actions}
        help={k("sod.help", "Roles one person should not hold together. Block refuses the combination when roles are given; Warn allows it and lists the person here until an exception is accepted.")} />
      <StatCards items={cards} className="access-stats" />
      <TabView className="bv-tabbar rp-tabs" activeIndex={TABS.indexOf(tab)} onTabChange={(e) => set({ tab: TABS[e.index] === "conflicts" ? null : TABS[e.index], change: null })}>
        {tabs.map((t) => (
          <TabPanel key={t.key} leftIcon={`${t.icon} mr-2`} header={(
            <span className="rp-tab">
              {t.label}
              {t.badge ? <Badge value={t.badge} severity="warning" className="rp-tab__badge" /> : null}
            </span>
          )} />
        ))}
      </TabView>
      <LoadError error={rules.error} onRetry={rules.reload} />
      <div className="bv-loading-host">
        <LoadingBar active={rules.refreshing} />
        {body}
      </div>
      <SodRulePanel target={rulePanel} directory={directory} approval={data?.approval !== false} technical={technical} onHide={() => setRulePanel(null)} onDone={reloadAll} />
      <SodExceptionPanel conflict={exceptionFor} asOf={conflicts.data?.asOf} maxDays={data?.maxExceptionDays} approval={data?.approval !== false}
        onHide={() => setExceptionFor(null)} onDone={reloadAll} />
    </div>
  );
};

export default SodRules;
