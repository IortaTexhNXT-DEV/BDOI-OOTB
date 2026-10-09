import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import { confirmAction, promptText } from "../../utility/dialogs";
import { Field, PageHeader, StatusTag, dateTime, showError, showSuccess } from "./common";
import { useSalesProducts } from "../Sales/salesProducts";

const EMPTY_RULE = { name: "", priority: 100, method: "round_robin", assignees: [], status: "active", description: "",
  conditions: { branchCode: "", lob: "", source: "", leadCategory: "", channelId: "", province: "", city: "" } };

/**
 * Operations > Sales & Marketing > Lead Assignment: the team view by reporting line (every account executive and
 * manager), and for the lead assignment team (read / write:lead-assignment) the reassignment queue, bulk reassignment
 * and the assignment rules (round robin, load, fixed; by branch, line, source, category, channel, province, city).
 */
const LeadAssignment = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const manage = hasPermission("read:lead-assignment");
  const write = hasPermission("write:lead-assignment");
  const [assignees, setAssignees] = useState([]);
  const [channels, setChannels] = useState([]);
  const [team, setTeam] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [managerId, setManagerId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [rules, setRules] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rule, setRule] = useState(null);
  const [reassign, setReassign] = useState(null); // { leads, toUserId, reason }
  const [history, setHistory] = useState(null);

  const assigneeOptions = useMemo(() => assignees.map((a) => ({ value: a.id, label: `${a.name} (${a.branchCode || "-"}, ${a.open} ${t("distribution.la.open", "open")})` })), [assignees, t]);
  // lines of the active products (Product master); a rule keeps the line it was saved with
  const products = useSalesProducts({ enabled: manage });
  const lobOptions = useMemo(() => [...new Set((products || []).map((p) => p.lob).filter(Boolean))].sort().map((v) => ({ value: v, label: v })), [products]);
  const ruleLobOptions = (lob) => (lob && !lobOptions.some((o) => o.value === lob) ? [...lobOptions, { value: lob, label: lob }] : lobOptions);
  const methodOptions = ["round_robin", "load", "fixed"].map((v) => ({ value: v, label: t(`distribution.la.method.${v}`, v) }));

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
      const [q, r] = await Promise.all([service.assignmentQueue(), service.assignmentRules()]);
      setQueue(q);
      setRules(r);
    } catch (e) {
      showError(toast, e);
    }
  }, [manage]);
  useEffect(() => { loadTeam(); }, [loadTeam]);
  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => {
    service.assignees().then(setAssignees).catch(() => setAssignees([]));
    service.channelOptions().then(setChannels).catch(() => setChannels([]));
  }, []);

  const doReassign = async () => {
    try {
      const r = await service.reassign({ leadIds: reassign.leads.map((l) => l.id), toUserId: reassign.toUserId, reason: reassign.reason || undefined });
      showSuccess(toast, r.message);
      setReassign(null);
      setSelected([]);
      loadTeam();
      loadQueue();
    } catch (e) {
      showError(toast, e);
    }
  };
  const toQueue = async (leads) => {
    const reason = await promptText(t("distribution.la.queueReason", "Why does this prospect need another account executive?"));
    if (!reason) return;
    try {
      const r = await service.sendToQueue({ leadIds: leads.map((l) => l.id), reason });
      showSuccess(toast, r.message);
      setSelected([]);
      loadTeam();
      loadQueue();
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
      loadQueue();
    } catch (e) {
      showError(toast, e);
    }
  };
  const deleteRule = async (r) => {
    if (!(await confirmAction(t("distribution.la.deleteRule", "Remove the rule {{name}}?", { name: r.name }), { danger: true }))) return;
    try {
      showSuccess(toast, (await service.deleteRule(r.id)).message);
      loadQueue();
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

  const leadColumns = (withActions) => [
    <Column key="sel" selectionMode="multiple" headerStyle={{ width: "3rem" }} />,
    <Column key="no" field="leadNumber" header={t("distribution.la.lead", "Prospect")} body={(r) => <span>{r.leadNumber}<br /><span className="pe-muted">{r.name}</span></span>} />,
    <Column key="status" field="status" header={t("distribution.common.status", "Status")} />,
    <Column key="lob" field="lob" header={t("distribution.la.lob", "Line")} />,
    <Column key="where" header={t("distribution.la.territory", "Territory")} body={(r) => [r.city, r.province].filter(Boolean).join(", ")} />,
    <Column key="ch" field="channelName" header={t("distribution.la.channel", "Channel")} />,
    <Column key="owner" field="ownerName" header={t("distribution.la.owner", "Account executive")} />,
    <Column key="asg" header={t("distribution.la.assignment", "Assignment")} body={(r) => (<span><StatusTag status={r.assignmentStatus} />{r.queueReason ? <><br /><span className="pe-muted text-sm">{r.queueReason}</span></> : null}</span>)} />,
    <Column key="act" body={(r) => (
      <div className="dist-actions">
        <Button icon="pi pi-history" text size="small" tooltip={t("distribution.la.history", "Assignment history")} aria-label={t("distribution.la.history", "Assignment history")} onClick={() => openHistory(r)} />
        {withActions && write ? <Button icon="pi pi-user-edit" text size="small" tooltip={t("distribution.la.reassign", "Reassign")} aria-label={t("distribution.la.reassign", "Reassign")} onClick={() => setReassign({ leads: [r], toUserId: null, reason: "" })} /> : null}
      </div>
    )} />,
  ];

  const bulkBar = (list) => (write && selected.length ? (
    <div className="dist-toolbar">
      <span>{t("distribution.la.selected", "{{count}} selected", { count: selected.length })}</span>
      <Button label={t("distribution.la.reassign", "Reassign")} icon="pi pi-user-edit" size="small" onClick={() => setReassign({ leads: selected, toUserId: null, reason: "" })} />
      {list !== "queue" ? <Button label={t("distribution.la.toQueue", "Send to queue")} icon="pi pi-inbox" size="small" outlined onClick={() => toQueue(selected)} /> : null}
    </div>
  ) : null);

  const teamManagers = assignees.map((a) => ({ value: a.id, label: a.name }));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("distribution.la.title", "Lead Assignment")}
        subtitle={t("distribution.la.subtitle", "Who works each prospect: the team view by reporting line, the reassignment queue and the assignment rules.")} />
      <div className="pe-card">
        <TabView onTabChange={() => setSelected([])}>
          <TabPanel header={t("distribution.la.team", "Team View")}>
            <div className="dist-toolbar">
              {manage ? (
                <Dropdown value={managerId} options={teamManagers} filter showClear placeholder={t("distribution.la.myTeam", "My team")} onChange={(e) => { setManagerId(e.value || null); setMemberId(null); }} className="w-18rem" />
              ) : null}
              <Dropdown value={memberId} options={(team?.members || []).map((m) => ({ value: m.id, label: `${" ".repeat(m.depth)}${m.name}` }))} showClear
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
              {leadColumns(true)}
            </DataTable>
          </TabPanel>
          {manage ? (
            <TabPanel header={`${t("distribution.la.queue", "Reassignment Queue")} (${queue.length})`}>
              <p className="pe-muted mt-0">{t("distribution.la.queueHelp", "Prospects no rule could assign, whose account executive is no longer active, that were not worked in time or that were sent here by hand.")}</p>
              {bulkBar("queue")}
              <DataTable value={queue} dataKey="id" size="small" stripedRows paginator rows={20} selection={selected} onSelectionChange={(e) => setSelected(e.value)}
                selectionMode={write ? "checkbox" : null} emptyMessage={t("distribution.la.queueEmpty", "The queue is empty")}>
                {leadColumns(true)}
                <Column header={t("distribution.la.queuedAt", "Queued")} body={(r) => dateTime(r.queuedAt)} />
              </DataTable>
            </TabPanel>
          ) : null}
          {manage ? (
            <TabPanel header={t("distribution.la.rules", "Assignment Rules")}>
              <div className="dist-toolbar">
                <span className="pe-muted">{t("distribution.la.rulesHelp", "The first active rule by priority whose conditions match a new prospect gives it an account executive. Empty conditions match anything.")}</span>
                {write ? <Button label={t("distribution.la.addRule", "Add rule")} icon="pi pi-plus" size="small" onClick={() => setRule({ ...EMPTY_RULE, conditions: { ...EMPTY_RULE.conditions } })} /> : null}
              </div>
              <DataTable value={rules} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.la.noRules", "No rule yet: prospects stay with the user who creates them")}>
                <Column field="priority" header={t("distribution.la.priority", "Priority")} style={{ width: "6rem" }} />
                <Column field="name" header={t("distribution.common.name", "Name")} />
                <Column header={t("distribution.la.conditions", "Conditions")} body={(r) => Object.entries(r.conditions).map(([k, v]) => `${t(`distribution.la.cond.${k}`, k)}: ${k === "channelId" ? (channels.find((c) => c.id === v)?.name || v) : v}`).join("; ") || t("distribution.la.any", "Any prospect")} />
                <Column header={t("distribution.la.methodLabel", "Method")} body={(r) => t(`distribution.la.method.${r.method}`, r.method)} />
                <Column header={t("distribution.la.assignees", "Account executives")} body={(r) => (r.assigneeNames || []).join(", ")} />
                <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
                {write ? <Column body={(r) => (
                  <div className="dist-actions">
                    <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => setRule({ ...EMPTY_RULE, ...r, conditions: { ...EMPTY_RULE.conditions, ...r.conditions } })} />
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
            <Field label={t("distribution.common.name", "Name")}><InputText value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} /></Field>
            <Field label={t("distribution.la.priority", "Priority")} help={t("distribution.la.priorityHelp", "Lower numbers are checked first")}>
              <InputNumber value={rule.priority} min={0} onValueChange={(e) => setRule({ ...rule, priority: e.value ?? 100 })} />
            </Field>
            <Field label={t("distribution.la.methodLabel", "Method")}><Dropdown value={rule.method} options={methodOptions} onChange={(e) => setRule({ ...rule, method: e.value })} /></Field>
            <Field label={t("distribution.common.status", "Status")}>
              <Dropdown value={rule.status} options={["active", "inactive"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} onChange={(e) => setRule({ ...rule, status: e.value })} />
            </Field>
            <Field label={t("distribution.la.assignees", "Account executives")} full help={t("distribution.la.assigneesHelp", "In round-robin order")}>
              <MultiSelect value={rule.assignees} options={assigneeOptions} filter display="chip" onChange={(e) => setRule({ ...rule, assignees: e.value })} />
            </Field>
            <Field label={t("distribution.la.cond.lob", "Line of business")}>
              <Dropdown value={rule.conditions.lob} options={ruleLobOptions(rule.conditions.lob)} showClear onChange={(e) => setRule({ ...rule, conditions: { ...rule.conditions, lob: e.value || "" } })} />
            </Field>
            <Field label={t("distribution.la.cond.channelId", "Distribution channel")}>
              <Dropdown value={rule.conditions.channelId} options={channels.map((c) => ({ value: c.id, label: c.label }))} filter showClear
                onChange={(e) => setRule({ ...rule, conditions: { ...rule.conditions, channelId: e.value || "" } })} />
            </Field>
            {["province", "city", "branchCode", "source", "leadCategory"].map((k) => (
              <Field key={k} label={t(`distribution.la.cond.${k}`, k)}>
                <InputText value={rule.conditions[k]} onChange={(e) => setRule({ ...rule, conditions: { ...rule.conditions, [k]: e.target.value } })} />
              </Field>
            ))}
            <Field label={t("distribution.common.description", "Description")} full>
              <InputText value={rule.description || ""} onChange={(e) => setRule({ ...rule, description: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("distribution.la.reassignTitle", "Reassign {{count}} prospect(s)", { count: reassign?.leads.length || 0 })} visible={!!reassign} style={{ width: "min(520px, 96vw)" }}
        onHide={() => setReassign(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setReassign(null)} /><Button label={t("distribution.la.reassign", "Reassign")} icon="pi pi-check" onClick={doReassign} disabled={!reassign?.toUserId} /></div>}>
        {reassign && (
          <div className="dist-grid">
            <Field label={t("distribution.la.to", "To account executive")} full>
              <Dropdown value={reassign.toUserId} options={assigneeOptions} filter onChange={(e) => setReassign({ ...reassign, toUserId: e.value })} />
            </Field>
            <Field label={t("distribution.la.reason", "Reason")} full>
              <InputText value={reassign.reason} onChange={(e) => setReassign({ ...reassign, reason: e.target.value })} />
            </Field>
          </div>
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
