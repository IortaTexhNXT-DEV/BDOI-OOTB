import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import mastersService from "../../services/mastersService";
import addressService from "../../services/addressService";
import useMasterOptions from "../../agentModule/component/useMasterOptions";
import { hasPermission } from "../../utils/canOpen";
import { confirmAction } from "../../utility/dialogs";
import { Field, PageHeader, StatusTag, dateTime, showError, showSuccess } from "./common";
import { lobChoices, useProductLines } from "../Sales/salesProducts";
import ReassignDialog from "./ReassignDialog";

/** Line condition of a rule (and queue filter) for the prospects whose product is not yet tagged. */
export const UNTAGGED = "NONE";
const CONDITION_KEYS = ["lob", "productId", "channelId", "branchCode", "source", "leadCategory", "province", "city"];
const EMPTY_RULE = { name: "", priority: 100, method: "round_robin", assignees: [], status: "active", description: "",
  conditions: Object.fromEntries(CONDITION_KEYS.map((k) => [k, ""])) };

/** Rules in the order they are checked, and the ids after moving one rule up (-1) or down (+1). */
export const moveRule = (rules, id, step) => {
  const ids = rules.map((r) => r.id);
  const i = ids.indexOf(id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
};

/** A saved value kept as an option even when its list no longer offers it. */
const withSaved = (options, value) => (value && !options.some((o) => String(o.value) === String(value)) ? [...options, { value, label: String(value) }] : options);

/**
 * Operations > Sales & Marketing > Lead Assignment: the team view by reporting line (every account executive and
 * manager), and for the lead assignment team (read / write:lead-assignment) the reassignment queue (filters, take,
 * reassign, assign by the rules with a preview), single and bulk reassignment with a reason code, and the assignment
 * rules (round robin, load, fixed; by line (or product not yet tagged), product, channel, branch, source, category,
 * province, city; ordered, activated and deactivated).
 */
const LeadAssignment = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const manage = hasPermission("read:lead-assignment");
  const write = hasPermission("write:lead-assignment");
  const [assignees, setAssignees] = useState([]);
  const [channels, setChannels] = useState([]);
  const [branches, setBranches] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [team, setTeam] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [managerId, setManagerId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueFilter, setQueueFilter] = useState({ search: "", lob: null, reasonCode: null, branchCode: null });
  const [rules, setRules] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rule, setRule] = useState(null);
  const [reassign, setReassign] = useState(null); // { leads, mode: reassign | queue }
  const [history, setHistory] = useState(null);
  const [run, setRun] = useState(null); // preview of the queue run through the rules
  // the tab shown (TabView is controlled once it has onTabChange)
  const [tab, setTab] = useState(0);

  const sources = useMasterOptions("lead-source", { value: (r) => r.name });
  const reasons = useMasterOptions("reason-code", { filter: (r) => r.context === "reassignment" });
  const assigneeOptions = useMemo(() => assignees.map((a) => ({ value: a.id, label: `${a.name} (${a.branchCode || "-"}, ${a.open} ${t("distribution.la.open", "open")})` })), [assignees, t]);
  // the active lines that have active products (the product pickers' lines); a rule keeps the line it was saved with
  const lines = useProductLines({ enabled: manage });
  const untaggedOption = { value: UNTAGGED, label: t("distribution.la.untagged", "Product not yet tagged") };
  const lobOptions = useMemo(() => lobChoices(lines), [lines]);
  const ruleLobOptions = (lob) => withSaved([...lobOptions, untaggedOption], lob);
  const products = useMemo(() => (lines || []).flatMap((l) => l.products.map((p) => ({ ...p, lineCode: l.code }))), [lines]);
  const productOptions = (lob) => products.filter((p) => !lob || lob === UNTAGGED || p.lob === lob || p.lineCode === lob).map((p) => ({ value: String(p.id), label: p.name }));
  const methodOptions = ["round_robin", "load", "fixed"].map((v) => ({ value: v, label: t(`distribution.la.method.${v}`, v) }));
  const categoryOptions = ["Retail", "Corporate"].map((v) => ({ value: v, label: t(`distribution.la.category.${v}`, v) }));
  const reasonFilterOptions = [...reasons, { value: UNTAGGED, label: t("distribution.la.systemQueued", "Queued by the system or without a reason code") }];

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      setTeam(await service.teamView({ managerId: managerId || undefined, memberId: memberId || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [managerId, memberId]);
  const loadQueue = useCallback(async () => {
    if (!manage) return;
    try {
      setQueue(await service.assignmentQueue({ search: queueFilter.search.trim() || undefined, lob: queueFilter.lob, reasonCode: queueFilter.reasonCode, branchCode: queueFilter.branchCode }));
    } catch (e) {
      showError(toast, e);
    }
  }, [manage, queueFilter]);
  const loadRules = useCallback(async () => {
    if (!manage) return;
    try {
      setRules(await service.assignmentRules());
    } catch (e) {
      showError(toast, e);
    }
  }, [manage]);
  useEffect(() => { loadTeam(); }, [loadTeam]);
  useEffect(() => {
    const timer = setTimeout(loadQueue, 300);
    return () => clearTimeout(timer);
  }, [loadQueue]);
  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => {
    service.assignees().then(setAssignees).catch(() => setAssignees([]));
    service.channelOptions().then(setChannels).catch(() => setChannels([]));
    if (!manage) return;
    mastersService.options("branch").then((b) => setBranches(b.map((x) => ({ value: x.code, label: `${x.label} (${x.code})` })))).catch(() => setBranches([]));
    addressService.getProvincesByCountry("PH").then((r) => setProvinces(r?.success ? r.data : [])).catch(() => setProvinces([]));
  }, [manage]);
  // the cities of the rule's province
  const ruleProvince = rule?.conditions.province;
  useEffect(() => {
    const p = provinces.find((x) => x.name === ruleProvince);
    if (!p) {
      setCities([]);
      return;
    }
    addressService.getCitiesByProvince(p.id).then((r) => setCities(r?.success ? r.data : [])).catch(() => setCities([]));
  }, [ruleProvince, provinces]);

  const refresh = () => {
    setSelected([]);
    loadTeam();
    loadQueue();
  };
  const take = async (leads) => {
    try {
      showSuccess(toast, (await service.takeFromQueue(leads.map((l) => l.id))).message);
      refresh();
    } catch (e) {
      showError(toast, e);
    }
  };
  const previewRun = async () => {
    try {
      setRun((await service.runRules(true)).data);
    } catch (e) {
      showError(toast, e);
    }
  };
  const confirmRun = async () => {
    try {
      showSuccess(toast, (await service.runRules(false)).message);
      setRun(null);
      refresh();
      loadRules();
    } catch (e) {
      showError(toast, e);
    }
  };
  const saveRule = async () => {
    const conditions = Object.fromEntries(Object.entries(rule.conditions).filter(([, v]) => v));
    const body = { name: rule.name, priority: rule.priority, method: rule.method, assignees: rule.assignees, status: rule.status, description: rule.description || null, conditions };
    try {
      const r = rule.id ? await service.updateRule(rule.id, body) : await service.createRule(body);
      showSuccess(toast, r.message);
      setRule(null);
      loadRules();
    } catch (e) {
      showError(toast, e);
    }
  };
  const setStatus = async (r, active) => {
    try {
      showSuccess(toast, (await service.updateRule(r.id, { status: active ? "active" : "inactive" })).message);
      loadRules();
    } catch (e) {
      showError(toast, e);
    }
  };
  const move = async (r, step) => {
    const ids = moveRule(rules, r.id, step);
    if (!ids) return;
    try {
      const out = await service.reorderRules(ids);
      setRules(out.data);
      showSuccess(toast, out.message);
    } catch (e) {
      showError(toast, e);
    }
  };
  const deleteRule = async (r) => {
    if (!(await confirmAction(t("distribution.la.deleteRule", "Remove the rule {{name}}?", { name: r.name }), { danger: true }))) return;
    try {
      showSuccess(toast, (await service.deleteRule(r.id)).message);
      loadRules();
    } catch (e) {
      showError(toast, e);
    }
  };
  const openHistory = async (lead) => {
    try {
      setHistory({ lead, rows: await service.assignmentHistory(lead.id) });
    } catch (e) {
      showError(toast, e);
    }
  };

  const conditionText = (k, v) => {
    if (k === "lob" && v === UNTAGGED) return untaggedOption.label;
    if (k === "lob") return lobOptions.find((o) => o.value === v)?.label || v;
    if (k === "productId") return products.find((p) => String(p.id) === String(v))?.name || v;
    if (k === "channelId") return channels.find((c) => c.id === v)?.name || v;
    if (k === "branchCode") return branches.find((b) => b.value === v)?.label || v;
    if (k === "leadCategory") return t(`distribution.la.category.${v}`, v);
    return v;
  };
  const setCondition = (k, value) => setRule((r) => {
    const conditions = { ...r.conditions, [k]: value || "" };
    // a product belongs to its line; a city to its province
    if (k === "lob" && conditions.productId && !productOptions(value).some((o) => o.value === String(conditions.productId))) conditions.productId = "";
    if (k === "province") conditions.city = "";
    return { ...r, conditions };
  });

  const leadColumns = (list) => [
    <Column key="sel" selectionMode="multiple" headerStyle={{ width: "3rem" }} />,
    <Column key="no" field="leadNumber" header={t("distribution.la.lead", "Prospect")} body={(r) => <span>{r.leadNumber}<br /><span className="pe-muted">{r.name}</span></span>} />,
    <Column key="status" field="status" header={t("distribution.common.status", "Status")} />,
    <Column key="lob" header={t("distribution.la.lob", "Line")} body={(r) => (r.lob ? <span>{r.lob}{r.productName ? <><br /><span className="pe-muted">{r.productName}</span></> : null}</span>
      : <span className="pe-muted">{untaggedOption.label}</span>)} />,
    <Column key="where" header={t("distribution.la.territory", "Territory")} body={(r) => [r.city, r.province].filter(Boolean).join(", ")} />,
    <Column key="ch" field="channelName" header={t("distribution.la.channel", "Channel")} />,
    <Column key="owner" field="ownerName" header={t("distribution.la.owner", "Account executive")} />,
    <Column key="asg" header={t("distribution.la.assignment", "Assignment")} body={(r) => (<span><StatusTag status={r.assignmentStatus} />{r.queueReason ? <><br /><span className="pe-muted text-sm">{r.queueReason}</span></> : null}</span>)} />,
    ...(list === "queue" ? [<Column key="queued" header={t("distribution.la.queuedAt", "Queued")} body={(r) => dateTime(r.queuedAt)} />] : []),
    <Column key="act" body={(r) => (
      <div className="dist-actions">
        <Button icon="pi pi-history" text size="small" tooltip={t("distribution.la.history", "Assignment history")} aria-label={t("distribution.la.history", "Assignment history")} onClick={() => openHistory(r)} />
        {write && list === "queue" ? <Button icon="pi pi-download" text size="small" tooltip={t("distribution.la.take", "Take")} aria-label={t("distribution.la.take", "Take")} onClick={() => take([r])} /> : null}
        {write ? <Button icon="pi pi-user-edit" text size="small" tooltip={t("distribution.la.reassign", "Reassign")} aria-label={t("distribution.la.reassign", "Reassign")} onClick={() => setReassign({ leads: [r], mode: "reassign" })} /> : null}
      </div>
    )} />,
  ];

  const bulkBar = (list) => (write && selected.length ? (
    <div className="dist-toolbar">
      <span>{t("distribution.la.selected", "{{count}} selected", { count: selected.length })}</span>
      <Button label={t("distribution.la.reassign", "Reassign")} icon="pi pi-user-edit" size="small" onClick={() => setReassign({ leads: selected, mode: "reassign" })} />
      {list === "queue"
        ? <Button label={t("distribution.la.take", "Take")} icon="pi pi-download" size="small" outlined onClick={() => take(selected)} />
        : <Button label={t("distribution.la.toQueue", "Send to queue")} icon="pi pi-inbox" size="small" outlined onClick={() => setReassign({ leads: selected, mode: "queue" })} />}
    </div>
  ) : null);

  const teamManagers = assignees.map((a) => ({ value: a.id, label: a.name }));
  const setFilter = (k, v) => setQueueFilter((f) => ({ ...f, [k]: v }));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("distribution.la.title", "Lead Assignment")}
        subtitle={t("distribution.la.subtitle", "Who works each prospect: the team view by reporting line, the reassignment queue and the assignment rules.")} />
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => { setTab(e.index); setSelected([]); }}>
          <TabPanel header={t("distribution.la.team", "Team View")}>
            <div className="dist-toolbar">
              {manage ? (
                <Dropdown value={managerId} options={teamManagers} filter showClear placeholder={t("distribution.la.myTeam", "My team")} onChange={(e) => { setManagerId(e.value || null); setMemberId(null); }} className="w-18rem" />
              ) : null}
              <Dropdown value={memberId} options={(team?.members || []).map((m) => ({ value: m.id, label: `${" ".repeat(m.depth)}${m.name}` }))} showClear
                placeholder={t("distribution.la.allMembers", "Everyone in the team")} onChange={(e) => setMemberId(e.value || null)} className="w-18rem" />
            </div>
            <DataTable value={team?.members || []} dataKey="id" size="small" stripedRows loading={loading} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column header={t("distribution.la.member", "Team member")} body={(m) => <span style={{ paddingLeft: `${m.depth * 1.25}rem` }}>{m.name} <span className="pe-muted">{m.designation || ""}</span></span>} />
              <Column field="branchCode" header={t("distribution.la.branch", "Branch")} />
              <Column field="open" header={t("distribution.la.openLeads", "Open")} className="bv-num" headerClassName="bv-num" />
              <Column field="new" header={t("distribution.la.new", "New")} className="bv-num" headerClassName="bv-num" />
              <Column field="converted" header={t("distribution.la.converted", "Converted")} className="bv-num" headerClassName="bv-num" />
              <Column field="lost" header={t("distribution.la.lost", "Lost")} className="bv-num" headerClassName="bv-num" />
              <Column field="queued" header={t("distribution.la.queued", "In queue")} className="bv-num" headerClassName="bv-num" />
              <Column field="last30" header={t("distribution.la.last30", "Last 30 days")} className="bv-num" headerClassName="bv-num" />
            </DataTable>
            <h3 className="mt-4">{t("distribution.la.teamLeads", "Prospects of the team")}</h3>
            {bulkBar("team")}
            <DataTable value={team?.leads || []} dataKey="id" size="small" stripedRows paginator rows={20} selection={selected} onSelectionChange={(e) => setSelected(e.value)}
              selectionMode={write ? "checkbox" : null} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              {leadColumns("team")}
            </DataTable>
          </TabPanel>
          {manage ? (
            <TabPanel header={`${t("distribution.la.queue", "Reassignment Queue")} (${queue.length})`}>
              <p className="pe-muted mt-0">{t("distribution.la.queueHelp", "Prospects no rule could assign, whose account executive is no longer active, that were not worked in time or that were sent here by hand.")}</p>
              <div className="dist-toolbar">
                <span className="p-input-icon-left">
                  <i className="pi pi-search" />
                  <InputText value={queueFilter.search} onChange={(e) => setFilter("search", e.target.value)} placeholder={t("distribution.la.searchQueue", "Prospect name or number")}
                    aria-label={t("distribution.la.searchQueue", "Prospect name or number")} />
                </span>
                <Dropdown value={queueFilter.lob} options={[...lobOptions, untaggedOption]} showClear placeholder={t("distribution.la.cond.lob", "Line of business")} onChange={(e) => setFilter("lob", e.value || null)} className="w-14rem" />
                <Dropdown value={queueFilter.reasonCode} options={reasonFilterOptions} showClear placeholder={t("distribution.la.reason", "Reason")} onChange={(e) => setFilter("reasonCode", e.value || null)} className="w-16rem" />
                <Dropdown value={queueFilter.branchCode} options={branches} showClear placeholder={t("distribution.la.branch", "Branch")} onChange={(e) => setFilter("branchCode", e.value || null)} className="w-12rem" />
                {write ? <Button label={t("distribution.la.runRules", "Assign by rules")} icon="pi pi-sitemap" size="small" outlined className="ml-auto" onClick={previewRun} disabled={!queue.length} /> : null}
              </div>
              {bulkBar("queue")}
              <DataTable value={queue} dataKey="id" size="small" stripedRows paginator rows={20} selection={selected} onSelectionChange={(e) => setSelected(e.value)}
                selectionMode={write ? "checkbox" : null} emptyMessage={t("distribution.la.queueEmpty", "The queue is empty")}>
                {leadColumns("queue")}
              </DataTable>
            </TabPanel>
          ) : null}
          {manage ? (
            <TabPanel header={t("distribution.la.rules", "Assignment Rules")}>
              <div className="dist-toolbar">
                <span className="pe-muted">{t("distribution.la.rulesHelp", "The first active rule by priority whose conditions match a new prospect gives it an account executive. Empty conditions match anything.")}</span>
                {write ? <Button label={t("distribution.la.addRule", "Add rule")} icon="pi pi-plus" size="small" className="ml-auto" onClick={() => setRule({ ...EMPTY_RULE, conditions: { ...EMPTY_RULE.conditions } })} /> : null}
              </div>
              <DataTable value={rules} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.la.noRules", "No rule yet: prospects stay with the user who creates them")}>
                <Column field="priority" header={t("distribution.la.priority", "Priority")} style={{ width: "6rem" }} className="bv-num" headerClassName="bv-num" />
                <Column field="name" header={t("distribution.common.name", "Name")} />
                <Column header={t("distribution.la.conditions", "Conditions")} body={(r) => Object.entries(r.conditions).map(([k, v]) => `${t(`distribution.la.cond.${k}`, k)}: ${conditionText(k, v)}`).join("; ") || t("distribution.la.any", "Any prospect")} />
                <Column header={t("distribution.la.methodLabel", "Method")} body={(r) => t(`distribution.la.method.${r.method}`, r.method)} />
                <Column header={t("distribution.la.assignees", "Account executives")} body={(r) => (r.assigneeNames || []).join(", ")} />
                <Column header={t("distribution.la.active", "Active")} body={(r) => (write
                  ? <InputSwitch checked={r.status === "active"} onChange={(e) => setStatus(r, e.value)} aria-label={t("distribution.la.active", "Active")} />
                  : <StatusTag status={r.status} />)} style={{ width: "6rem" }} />
                {write ? <Column body={(r, { rowIndex }) => (
                  <div className="dist-actions">
                    <Button icon="pi pi-arrow-up" text size="small" disabled={rowIndex === 0} tooltip={t("distribution.la.moveUp", "Check earlier")} aria-label={t("distribution.la.moveUp", "Check earlier")} onClick={() => move(r, -1)} />
                    <Button icon="pi pi-arrow-down" text size="small" disabled={rowIndex === rules.length - 1} tooltip={t("distribution.la.moveDown", "Check later")} aria-label={t("distribution.la.moveDown", "Check later")} onClick={() => move(r, 1)} />
                    <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => setRule({ ...EMPTY_RULE, ...r, conditions: { ...EMPTY_RULE.conditions, ...r.conditions, productId: r.conditions.productId ? String(r.conditions.productId) : "" } })} />
                    <Button icon="pi pi-trash" text size="small" severity="danger" aria-label={t("distribution.common.delete", "Delete")} onClick={() => deleteRule(r)} />
                  </div>
                )} /> : null}
              </DataTable>
            </TabPanel>
          ) : null}
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={rule?.id ? t("distribution.la.editRule", "Edit assignment rule") : t("distribution.la.addRule", "Add rule")} visible={!!rule} style={{ width: "min(760px, 96vw)" }} onHide={() => setRule(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setRule(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveRule} disabled={!rule?.name || !rule?.assignees.length} /></div>}>
        {rule && (
          <div className="dist-grid">
            <Field label={`${t("distribution.common.name", "Name")} *`}><InputText value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} /></Field>
            <Field label={t("distribution.la.priority", "Priority")} help={t("distribution.la.priorityHelp", "Lower numbers are checked first")}>
              <InputNumber value={rule.priority} min={0} onValueChange={(e) => setRule({ ...rule, priority: e.value ?? 100 })} />
            </Field>
            <Field label={t("distribution.la.methodLabel", "Method")} help={t(`distribution.la.methodHelp.${rule.method}`, "")}><Dropdown value={rule.method} options={methodOptions} onChange={(e) => setRule({ ...rule, method: e.value })} /></Field>
            <Field label={t("distribution.common.status", "Status")}>
              <Dropdown value={rule.status} options={["active", "inactive"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} onChange={(e) => setRule({ ...rule, status: e.value })} />
            </Field>
            <Field label={`${t("distribution.la.assignees", "Account executives")} *`} full help={t("distribution.la.assigneesHelp", "In round-robin order")}>
              <MultiSelect value={rule.assignees} options={assigneeOptions} filter display="chip" onChange={(e) => setRule({ ...rule, assignees: e.value })} />
            </Field>
            <h4 className="dist-field--full m-0 mt-2">{t("distribution.la.conditions", "Conditions")} <span className="pe-muted text-sm">{t("distribution.la.conditionsHelp", "Empty: any value")}</span></h4>
            <Field label={t("distribution.la.cond.lob", "Line of business")}>
              <Dropdown value={rule.conditions.lob || null} options={ruleLobOptions(rule.conditions.lob)} showClear onChange={(e) => setCondition("lob", e.value)} />
            </Field>
            <Field label={t("distribution.la.cond.productId", "Product")}>
              <Dropdown value={rule.conditions.productId || null} options={withSaved(productOptions(rule.conditions.lob), rule.conditions.productId)} showClear filter
                disabled={rule.conditions.lob === UNTAGGED} onChange={(e) => setCondition("productId", e.value)} />
            </Field>
            <Field label={t("distribution.la.cond.channelId", "Distribution channel")}>
              <Dropdown value={rule.conditions.channelId || null} options={channels.map((c) => ({ value: c.id, label: c.label }))} filter showClear onChange={(e) => setCondition("channelId", e.value)} />
            </Field>
            <Field label={t("distribution.la.cond.branchCode", "Branch")}>
              <Dropdown value={rule.conditions.branchCode || null} options={withSaved(branches, rule.conditions.branchCode)} showClear onChange={(e) => setCondition("branchCode", e.value)} />
            </Field>
            <Field label={t("distribution.la.cond.source", "Source")}>
              <Dropdown value={rule.conditions.source || null} options={withSaved(sources, rule.conditions.source)} showClear filter onChange={(e) => setCondition("source", e.value)} />
            </Field>
            <Field label={t("distribution.la.cond.leadCategory", "Category")}>
              <Dropdown value={rule.conditions.leadCategory || null} options={withSaved(categoryOptions, rule.conditions.leadCategory)} showClear onChange={(e) => setCondition("leadCategory", e.value)} />
            </Field>
            <Field label={t("distribution.la.cond.province", "Province")}>
              <Dropdown value={rule.conditions.province || null} options={withSaved(provinces.map((p) => ({ value: p.name, label: p.name })), rule.conditions.province)} showClear filter
                onChange={(e) => setCondition("province", e.value)} />
            </Field>
            <Field label={t("distribution.la.cond.city", "City / municipality")}>
              <Dropdown value={rule.conditions.city || null} options={withSaved(cities.map((c) => ({ value: c.name, label: c.name })), rule.conditions.city)} showClear filter
                disabled={!rule.conditions.province} placeholder={rule.conditions.province ? "" : t("address.chooseProvinceFirst", "Choose the province first")} onChange={(e) => setCondition("city", e.value)} />
            </Field>
            <Field label={t("distribution.common.description", "Description")} full>
              <InputText value={rule.description || ""} onChange={(e) => setRule({ ...rule, description: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>

      <ReassignDialog leads={reassign?.leads} mode={reassign?.mode} onHide={() => setReassign(null)} onError={(e) => showError(toast, e)}
        onDone={(r) => { showSuccess(toast, r.message); setReassign(null); refresh(); }} />

      <Dialog className="pe-dialog" header={t("distribution.la.runTitle", "Assign the queue by the rules")} visible={!!run} style={{ width: "min(820px, 96vw)" }} onHide={() => setRun(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setRun(null)} /><Button label={t("distribution.la.runConfirm", "Assign {{count}} prospect(s)", { count: run?.assigned.length || 0 })} icon="pi pi-check" onClick={confirmRun} disabled={!run?.assigned.length} /></div>}>
        {run && (
          <>
            <p className="pe-muted mt-0">{t("distribution.la.runHelp", "{{count}} prospect(s) match a rule; {{unmatched}} stay in the queue.", { count: run.assigned.length, unmatched: run.unmatched })}</p>
            <DataTable value={run.assigned} size="small" stripedRows emptyMessage={t("distribution.la.runNone", "No prospect in the queue matches an active rule")}>
              <Column header={t("distribution.la.lead", "Prospect")} body={(r) => <span>{r.leadNumber}<br /><span className="pe-muted">{r.name}</span></span>} />
              <Column field="ruleName" header={t("distribution.la.rule", "Rule")} />
              <Column field="toName" header={t("distribution.la.to", "To account executive")} />
            </DataTable>
          </>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={history ? `${t("distribution.la.history", "Assignment history")} · ${history.lead.leadNumber}` : ""} visible={!!history} style={{ width: "min(820px, 96vw)" }} onHide={() => setHistory(null)}>
        <DataTable value={history?.rows || []} size="small" stripedRows emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column header={t("distribution.la.when", "When")} body={(r) => dateTime(r.assignedAt)} />
          <Column header={t("distribution.la.action", "Action")} body={(r) => t(`distribution.la.actions.${r.action}`, r.action)} />
          <Column field="fromName" header={t("distribution.la.from", "From")} />
          <Column field="toName" header={t("distribution.la.toShort", "To")} />
          <Column header={t("distribution.la.why", "Rule or reason")} body={(r) => r.ruleName || r.reason || ""} />
          <Column field="assignedBy" header={t("distribution.la.by", "By")} />
        </DataTable>
      </Dialog>
    </div>
  );
};

export default LeadAssignment;
