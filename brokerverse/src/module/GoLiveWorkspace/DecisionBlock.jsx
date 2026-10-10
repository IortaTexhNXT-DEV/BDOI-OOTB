import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import DetailDialog from "../../components/DetailDialog";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import { EmptyState, RowActions, SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import { calendarDateFormat } from "../../utility/dateFormat";
import goLiveService from "../../services/goLiveService";
import { Chip, dateTimeOf, myId, useAccess, useWorkspace } from "./shared";

export const MIN_APPROVERS = 2;
export const ROLE_LABELS = ["Finance Head", "General Manager", "Operations Unit Head", "Project Sponsor", "IT Head"];
const FINANCE_HEAD = /finance head/i;
const OPEN = ["draft", "voting"];

/** What is wrong with the approvers of a new decision (empty when it can be created). */
export const approverProblems = (rows, t) => {
  const out = {};
  const chosen = rows.filter((r) => r.userId);
  if (chosen.length < MIN_APPROVERS) out.approvers = t("goLive.decision.minApprovers", { count: MIN_APPROVERS });
  else if (new Set(chosen.map((r) => r.userId)).size !== chosen.length) out.approvers = t("goLive.decision.approverTwice");
  else if (chosen.some((r) => !String(r.roleLabel || "").trim())) out.approvers = t("goLive.decision.roleRequired");
  else if (!chosen.some((r) => FINANCE_HEAD.test(r.roleLabel))) out.approvers = t("goLive.decision.financeHeadRequired");
  return out;
};

/** What is wrong with a No-Go vote: the reason, the actions and the new date are required. */
export const noGoProblems = (f, t) => {
  const out = {};
  if (!String(f.reason || "").trim()) out.reason = t("goLive.decision.reasonRequired");
  if (!String(f.actions || "").trim()) out.actions = t("goLive.decision.actionsRequired");
  if (!f.newDate) out.newDate = t("goLive.decision.newDateRequired");
  return out;
};

/** New decision of a run: the approvers (users who may approve go-live, never the creator) with the role they vote for. */
const NewDecisionDialog = ({ run, users, onHide, onCreated }) => {
  const { t } = useTranslation();
  const candidates = users.filter((u) => u.canApprove && u.userId !== myId());
  const next = useRef(2);
  const [rows, setRows] = useState([{ key: 0, userId: null, roleLabel: "Finance Head" }, { key: 1, userId: null, roleLabel: "General Manager" }]);
  const [meetingAt, setMeetingAt] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problems = tried ? approverProblems(rows, t) : {};
  const edit = (i, patch) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setTried(true);
    if (Object.keys(approverProblems(rows, t)).length) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await goLiveService.createDecision({ runId: run.id, meetingAt: meetingAt ? meetingAt.toISOString() : null,
        approvers: rows.filter((r) => r.userId).map((r) => ({ userId: r.userId, roleLabel: r.roleLabel.trim() })) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="lg" header={t("goLive.decision.newTitle", { number: run.runNumber })} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.decision.create")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <label htmlFor="decision-meeting" className="bv-field-label">{t("goLive.decision.meetingAt")}</label>
        <Calendar inputId="decision-meeting" value={meetingAt} onChange={(e) => setMeetingAt(e.value || null)} showTime hourFormat="24" dateFormat={calendarDateFormat()} showIcon className="w-full" />
        <span className="bv-field-label">{t("goLive.decision.approvers")}<span className="required-marker">*</span></span>
        {rows.map((r, i) => (
          <div key={r.key} className="go-live__approver">
            <Dropdown value={r.userId} options={candidates.map((u) => ({ label: u.name, value: u.userId }))} onChange={(e) => edit(i, { userId: e.value || null })} filter showClear
              placeholder={t("goLive.decision.chooseApprover")} aria-label={t("goLive.decision.approver", { n: i + 1 })} className="go-live__approver-user" />
            <Dropdown value={r.roleLabel} options={ROLE_LABELS.map((l) => ({ label: l, value: l }))} onChange={(e) => edit(i, { roleLabel: e.value })} editable
              aria-label={t("goLive.decision.roleOf", { n: i + 1 })} className="go-live__approver-role" />
            <Button type="button" icon="pi pi-times" text rounded aria-label={t("goLive.decision.removeApprover")} disabled={rows.length <= 1}
              onClick={() => setRows((list) => list.filter((_, j) => j !== i))} />
          </div>
        ))}
        <div>
          <Button type="button" icon="pi pi-plus" label={t("goLive.decision.addApprover")} text size="small" onClick={() => { next.current += 1; setRows((list) => [...list, { key: next.current, userId: null, roleLabel: "" }]); }} />
        </div>
        <FieldError error={problems.approvers} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Met or not met of a manual criterion with its evidence. */
const CriterionDialog = ({ decision, criterion, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(criterion.status === "not-met" ? "not-met" : "met");
  const [evidence, setEvidence] = useState(criterion.evidence || "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problem = tried && status === "met" && !evidence.trim() ? t("goLive.decision.evidenceRequired") : null;
  const save = async () => {
    setTried(true);
    if (status === "met" && !evidence.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.setCriterion(decision.id, criterion.code, { status, evidence: evidence.trim() || null });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={`${criterion.code} · ${criterion.title}`} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.decision.saveCriterion")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <label htmlFor="criterion-status" className="bv-field-label">{t("goLive.loads.status")}</label>
        <Dropdown inputId="criterion-status" value={status} options={["met", "not-met"].map((s) => ({ label: t(`goLive.status.criterion.${s}`), value: s }))} onChange={(e) => setStatus(e.value)}
          className="w-full" />
        <label htmlFor="criterion-evidence" className="bv-field-label">{t("goLive.decision.evidence")}{status === "met" ? <span className="required-marker">*</span> : null}</label>
        <InputTextarea id="criterion-evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={3} autoResize maxLength={2000}
          className={`w-full${problem ? " p-invalid" : ""}`} />
        <FieldError error={problem} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** A No-Go vote: the reason, the actions and the new date, with remarks. */
const NoGoDialog = ({ decision, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [f, setF] = useState({ reason: "", actions: "", newDate: "", remarks: "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problems = tried ? noGoProblems(f, t) : {};
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setTried(true);
    if (Object.keys(noGoProblems(f, t)).length) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await goLiveService.vote(decision.id, { vote: "no-go", reason: f.reason.trim(), actions: f.actions.trim(), newDate: f.newDate, remarks: f.remarks.trim() || null }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={t("goLive.decision.noGoTitle", { number: decision.runNumber })} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.decision.voteNoGo")} severity="danger" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <label htmlFor="nogo-reason" className="bv-field-label">{t("goLive.decision.reason")}<span className="required-marker">*</span></label>
        <InputTextarea id="nogo-reason" value={f.reason} onChange={set("reason")} rows={2} autoResize maxLength={2000} className={`w-full${problems.reason ? " p-invalid" : ""}`} />
        <FieldError error={problems.reason} />
        <label htmlFor="nogo-actions" className="bv-field-label">{t("goLive.decision.actions")}<span className="required-marker">*</span></label>
        <InputTextarea id="nogo-actions" value={f.actions} onChange={set("actions")} rows={2} autoResize maxLength={2000} className={`w-full${problems.actions ? " p-invalid" : ""}`} />
        <FieldError error={problems.actions} />
        <label htmlFor="nogo-date" className="bv-field-label">{t("goLive.decision.newDate")}<span className="required-marker">*</span></label>
        <DateField id="nogo-date" value={f.newDate} onChange={set("newDate")} invalid={!!problems.newDate} />
        <FieldError error={problems.newDate} />
        <label htmlFor="nogo-remarks" className="bv-field-label">{t("goLive.decision.remarks")}</label>
        <InputText id="nogo-remarks" value={f.remarks} onChange={set("remarks")} maxLength={1000} className="w-full" />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Go / No-Go of the production run: criteria with their automatic results, evidence and waivers; approvers and votes. */
const DecisionBlock = ({ run }) => {
  const { t } = useTranslation();
  const { notify, reloadOverview } = useWorkspace();
  const { canWrite, canApprove } = useAccess();
  const loader = useCallback(() => (run ? goLiveService.decisions(run.id) : Promise.resolve([])), [run]);
  const { data: decisions, refreshing, reload } = useStableLoad(loader, { initialData: [] });
  const usersLoader = useCallback(() => (canWrite ? goLiveService.users() : Promise.resolve([])), [canWrite]);
  const { data: users } = useStableLoad(usersLoader, { initialData: [] });
  const [creating, setCreating] = useState(false);
  const [criterion, setCriterion] = useState(null);
  const [noGo, setNoGo] = useState(false);
  const decision = (decisions || []).find((d) => d.status !== "withdrawn") || null;
  const changed = (message) => {
    notify("success", message);
    reload();
    reloadOverview();
  };

  if (!run) return <SectionCard title={t("goLive.decision.title")}><EmptyState icon="pi-flag" title={t("goLive.decision.noProductionRun")} /></SectionCard>;

  const draft = decision?.status === "draft";
  const mine = decision && decision.createdById === myId();
  const myVote = decision?.approvers.find((a) => a.userId === myId());
  const allMet = decision && decision.criteria.every((c) => ["met", "waived"].includes(c.status));

  const act = (fn, message) => async () => {
    try {
      await fn();
      changed(message);
    } catch (e) {
      notify("error", e.message);
    }
  };
  const openVoting = () => openConfirm({
    title: t("goLive.decision.openVotingTitle"), severity: "warning", message: t("goLive.decision.openVotingMessage", { count: decision.approvers.length }),
    facts: decision.approvers.map((a) => ({ label: a.roleLabel, value: a.name })), confirmLabel: t("goLive.decision.openVoting"),
    onConfirm: async () => {
      await goLiveService.openVoting(decision.id);
      changed(t("goLive.decision.votingOpen"));
    },
  });
  const withdraw = () => openConfirm({
    title: t("goLive.decision.withdrawTitle"), severity: "warning", message: t("goLive.decision.withdrawMessage", { number: run.runNumber }),
    input: { type: "textarea", label: t("goLive.decision.reason"), required: true }, confirmLabel: t("goLive.decision.withdrawDecision"),
    onConfirm: async (reason) => {
      await goLiveService.withdrawDecision(decision.id, reason);
      changed(t("goLive.decision.withdrawn"));
    },
  });
  const waive = (c) => openConfirm({
    title: t("goLive.decision.waiveTitle", { code: c.code }), severity: "warning", message: c.title,
    input: { type: "textarea", label: t("goLive.decision.waiverReason"), required: true }, confirmLabel: t("goLive.decision.waive"),
    onConfirm: async (waiverReason) => {
      await goLiveService.setCriterion(decision.id, c.code, { status: "waived", waiverReason });
      changed(t("goLive.decision.waived", { code: c.code }));
    },
  });
  const voteGo = () => openConfirm({
    title: t("goLive.decision.goTitle"), severity: "warning", message: t("goLive.decision.goMessage", { number: run.runNumber }),
    input: { type: "textarea", label: t("goLive.decision.remarks"), required: true }, confirmLabel: t("goLive.decision.voteGo"),
    onConfirm: async (remarks) => {
      const d = await goLiveService.vote(decision.id, { vote: "go", remarks });
      changed(d.status === "go" ? t("goLive.decision.decidedGo") : t("goLive.decision.voted"));
    },
  });

  const criterionActions = (c) => {
    if (!draft) return null;
    return (
      <RowActions actions={[
        { icon: "pi pi-pencil", label: t("goLive.decision.record"), onClick: () => setCriterion(c), hidden: !canWrite || c.automatic },
        { icon: "pi pi-shield", label: t("goLive.decision.waive"), onClick: () => waive(c), hidden: !canApprove || !c.waivable || c.status === "met" || c.status === "waived",
          disabled: mine },
      ]} />
    );
  };

  return (
    <SectionCard title={t("goLive.decision.titleOf", { number: run.runNumber })} className="bv-loading-host" actions={(
      <div className="go-live__actions">
        {canWrite && !decision ? <Button type="button" icon="pi pi-plus" label={t("goLive.decision.new")} onClick={() => setCreating(true)} /> : null}
        {canWrite && draft ? <Button type="button" icon="pi pi-refresh" label={t("goLive.decision.refresh")} outlined
          onClick={act(() => goLiveService.refreshDecision(decision.id), t("goLive.decision.refreshed"))} /> : null}
        {canWrite && draft ? <Button type="button" icon="pi pi-users" label={t("goLive.decision.openVoting")} onClick={openVoting} disabled={!allMet} /> : null}
        {canWrite && decision && OPEN.includes(decision.status) ? <Button type="button" icon="pi pi-times" label={t("goLive.decision.withdrawDecision")} outlined onClick={withdraw} /> : null}
        {canApprove && decision?.status === "voting" && myVote && !myVote.vote ? (
          <>
            <Button type="button" icon="pi pi-thumbs-down" label={t("goLive.decision.voteNoGo")} severity="danger" outlined onClick={() => setNoGo(true)} />
            <Button type="button" icon="pi pi-thumbs-up" label={t("goLive.decision.voteGo")} onClick={voteGo} />
          </>
        ) : null}
      </div>
    )}>
      <LoadingBar active={refreshing} />
      {decision ? (
        <div className="go-live__stack">
          <KeyValueGrid columns={4} items={[
            { label: t("goLive.loads.status"), value: <Chip kind="decision" code={decision.status} /> },
            { label: t("goLive.decision.meetingAt"), value: decision.meetingAt, type: "datetime" },
            { label: t("goLive.decision.createdBy"), value: `${decision.createdBy} · ${dateTimeOf(decision.createdAt)}` },
            { label: t("goLive.decision.decidedAt"), value: decision.decidedAt, type: "datetime" },
            { label: t("goLive.decision.reason"), value: decision.reason, hidden: decision.status !== "no-go", span: 2 },
            { label: t("goLive.decision.actions"), value: decision.actions, hidden: decision.status !== "no-go" },
            { label: t("goLive.decision.newDate"), value: decision.newDate, type: "date", hidden: decision.status !== "no-go" },
          ]} />
          <DataTable value={decision.criteria} dataKey="code" size="small">
            <Column field="code" header={t("goLive.decision.code")} />
            <Column field="title" header={t("goLive.decision.criterion")} />
            <Column header={t("goLive.decision.automatic")} body={(c) => (c.automatic ? c.autoResult?.detail || "—" : t("goLive.decision.manual"))} />
            <Column header={t("goLive.decision.evidence")} body={(c) => c.evidence || c.waiverReason || "—"} />
            <Column header={t("goLive.loads.status")} body={(c) => <Chip kind="criterion" code={c.status} />} />
            {canWrite || canApprove ? <Column body={criterionActions} headerClassName="bv-row-actions-head" bodyClassName="bv-row-actions-cell" /> : null}
          </DataTable>
          <DataTable value={decision.approvers} dataKey="userId" size="small">
            <Column field="name" header={t("goLive.decision.approverName")} />
            <Column field="roleLabel" header={t("goLive.decision.role")} />
            <Column header={t("goLive.decision.vote")} body={(a) => (a.vote ? <Chip kind="vote" code={a.vote} /> : "—")} />
            <Column header={t("goLive.decision.remarks")} body={(a) => a.remarks || "—"} />
            <Column header={t("goLive.decision.votedAt")} body={(a) => dateTimeOf(a.votedAt)} />
          </DataTable>
        </div>
      ) : (
        <EmptyState icon="pi-flag" title={t("goLive.decision.none")} />
      )}
      {creating ? <NewDecisionDialog run={run} users={users || []} onHide={() => setCreating(false)}
        onCreated={() => { setCreating(false); changed(t("goLive.decision.created")); }} /> : null}
      {criterion ? <CriterionDialog decision={decision} criterion={criterion} onHide={() => setCriterion(null)}
        onSaved={() => { setCriterion(null); changed(t("goLive.decision.criterionSaved", { code: criterion.code })); }} /> : null}
      {noGo ? <NoGoDialog decision={decision} onHide={() => setNoGo(false)} onSaved={() => { setNoGo(false); changed(t("goLive.decision.decidedNoGo")); }} /> : null}
    </SectionCard>
  );
};

export default DecisionBlock;
