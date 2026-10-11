import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import ApprovalActions from "../../components/ApprovalActions";
import DetailDialog from "../../components/DetailDialog";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import StatusChip from "../../components/StatusChip";
import { SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import goLiveService from "../../services/goLiveService";
import { Chip, dateTimeOf, makerOf, myId, useAccess, useWorkspace } from "./shared";
import { settingLabel, settingText } from "./SettingsBlock";

export const REASON_MIN = 5;

/** Time left before an instant, as "2 h 14 min" ("0 min" once passed); null without an instant. */
export const timeLeft = (until, now = Date.now()) => {
  if (!until) return null;
  const min = Math.max(0, Math.ceil((new Date(until).getTime() - now) / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, "0")} min` : `${min} min`;
};

/** What is wrong with an unlock request, by field: imports, hours (1 to the maximum), reason, steering committee reference after the window. */
export const unlockProblems = (f, { maxHours, windowEndsAt }, t, now = Date.now()) => {
  const out = {};
  if (!f.scope.length) out.scope = t("goLive.lock.scopeRequired");
  const hours = Number(f.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > maxHours) out.hours = t("goLive.lock.hoursRange", { max: maxHours });
  if (String(f.reason || "").trim().length < REASON_MIN) out.reason = t("goLive.lock.reasonRequired", { count: REASON_MIN });
  if (windowEndsAt && now > new Date(windowEndsAt).getTime() && !String(f.decisionRef || "").trim()) out.decisionRef = t("goLive.lock.decisionRefRequired");
  return out;
};

/** Unlock request: the imports it reopens, for how many hours, the reason and, after the window, the steering committee reference. */
const UnlockDialog = ({ state, onHide, onDone }) => {
  const { t } = useTranslation();
  const [f, setF] = useState({ scope: [], hours: Math.min(4, state.unlockMaxHours || 4), reason: "", decisionRef: "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const limits = { maxHours: state.unlockMaxHours || 4, windowEndsAt: state.unlockWindowEndsAt };
  const problems = tried ? unlockProblems(f, limits, t) : {};
  const afterWindow = state.unlockWindowEndsAt && Date.now() > new Date(state.unlockWindowEndsAt).getTime();
  const toggle = (key) => setF((x) => ({ ...x, scope: x.scope.includes(key) ? x.scope.filter((s) => s !== key) : [...x.scope, key] }));
  const save = async () => {
    setTried(true);
    if (Object.keys(unlockProblems(f, limits, t)).length) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.requestLock({ action: "unlock", scope: f.scope, hours: Number(f.hours), reason: f.reason.trim(), decisionRef: f.decisionRef.trim() || null });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={t("goLive.lock.unlockTitle")} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.lock.requestUnlock")} severity="warning" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <span className="bv-field-label">{t("goLive.lock.imports")}<span className="required-marker">*</span></span>
        {(state.scopes || []).map((s) => (
          <div key={s.key} className="go-live__radio">
            <Checkbox inputId={`scope-${s.key}`} checked={f.scope.includes(s.key)} onChange={() => toggle(s.key)} />
            <label htmlFor={`scope-${s.key}`}>{t(`goLive.lock.scopes.${s.key}`, { defaultValue: s.label })}</label>
          </div>
        ))}
        <FieldError error={problems.scope} />
        <label htmlFor="unlock-hours" className="bv-field-label">{t("goLive.lock.hours")}<span className="required-marker">*</span></label>
        <InputNumber inputId="unlock-hours" value={f.hours} onValueChange={(e) => setF((x) => ({ ...x, hours: e.value }))} min={1} max={limits.maxHours} showButtons
          className={problems.hours ? "p-invalid" : ""} />
        <FieldError error={problems.hours} />
        <label htmlFor="unlock-reason" className="bv-field-label">{t("goLive.lock.reason")}<span className="required-marker">*</span></label>
        <InputTextarea id="unlock-reason" value={f.reason} onChange={(e) => setF((x) => ({ ...x, reason: e.target.value }))} rows={3} autoResize maxLength={1000}
          className={`w-full${problems.reason ? " p-invalid" : ""}`} />
        <FieldError error={problems.reason} />
        <label htmlFor="unlock-ref" className="bv-field-label">{t("goLive.lock.decisionRef")}{afterWindow ? <span className="required-marker">*</span> : null}</label>
        <InputText id="unlock-ref" value={f.decisionRef} onChange={(e) => setF((x) => ({ ...x, decisionRef: e.target.value }))} maxLength={200}
          className={`w-full${problems.decisionRef ? " p-invalid" : ""}`} />
        <FieldError error={problems.decisionRef} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/**
 * Go-live lock: state, restore point, the conditions of the lock, the request waiting (approved by another user),
 * the unlock in force with the time left before it relocks itself, and the history of the requests.
 */
const LockBlock = ({ state, requests, restorePoint, onChanged }) => {
  const { t } = useTranslation();
  const { notify } = useWorkspace();
  const { canWrite, canApprove } = useAccess();
  const [unlocking, setUnlocking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const pending = state.pendingRequest;
  const unlock = state.unlock;

  useEffect(() => {
    if (!unlock) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [unlock]);

  const label = (r) => t(`goLive.lock.actions.${r.action}`);
  const defOf = (field) => (state.settingDefinitions || []).find((d) => d.field === field) || { field, label: field, type: "text" };
  /** The settings a request changes: "Label: before → after", one per setting. */
  const changesOf = (r) => (r.settings || []).map((c) => `${settingLabel(t, defOf(c.field))}: ${settingText(t, defOf(c.field), c.before)} → ${settingText(t, defOf(c.field), c.after)}`);
  const requestLock = () => openConfirm({
    title: t("goLive.lock.lockTitle"), severity: "warning", message: t("goLive.lock.lockMessage"),
    facts: state.conditions.map((c) => ({ label: t(`goLive.lock.conditions.${c.code}`, { defaultValue: c.label }), value: c.met ? t("goLive.common.yes") : t("goLive.common.no") })),
    input: { type: "textarea", label: t("goLive.lock.reason"), required: true, minLength: REASON_MIN }, confirmLabel: t("goLive.lock.requestLock"),
    onConfirm: async (reason) => {
      await goLiveService.requestLock({ action: "lock", reason });
      onChanged(t("goLive.lock.requested", { what: t("goLive.lock.actions.lock") }));
    },
  });
  const approve = () => openConfirm({
    title: t(`goLive.lock.approveTitle.${pending.action}`), severity: "danger",
    message: pending.action === "lock" ? t("goLive.lock.approveLockMessage")
      : pending.action === "settings" ? t("goLive.settings.approveMessage")
        : t("goLive.lock.approveUnlockMessage", { hours: pending.hours, imports: pending.scopeLabels.join(", ") }),
    facts: [{ label: t("goLive.lock.requestedBy"), value: pending.requestedBy }, { label: t("goLive.lock.reason"), value: pending.reason },
      ...(pending.settings || []).map((c) => ({ label: settingLabel(t, defOf(c.field)),
        value: `${settingText(t, defOf(c.field), c.before)} → ${settingText(t, defOf(c.field), c.after)}` })),
      { label: t("goLive.lock.decisionRef"), value: pending.decisionRef, hidden: !pending.decisionRef }],
    confirmLabel: t(`goLive.lock.approve.${pending.action}`),
    onConfirm: async () => {
      await goLiveService.approveLock(pending.id);
      onChanged(t("goLive.lock.approved", { what: label(pending) }));
    },
  });
  const reject = () => openConfirm({
    title: t("goLive.lock.rejectTitle", { what: label(pending) }), severity: "warning", message: pending.reason,
    input: { type: "textarea", label: t("goLive.lock.remarks"), required: true }, confirmLabel: t("goLive.lock.rejectRequest"),
    onConfirm: async (remarks) => {
      await goLiveService.rejectLock(pending.id, remarks);
      onChanged(t("goLive.lock.rejected", { what: label(pending) }));
    },
  });
  const withdraw = () => openConfirm({
    title: t("goLive.lock.withdrawTitle", { what: label(pending) }), severity: "warning", message: pending.reason, confirmLabel: t("goLive.lock.withdrawRequest"),
    onConfirm: async () => {
      await goLiveService.withdrawLock(pending.id);
      onChanged(t("goLive.lock.withdrawn", { what: label(pending) }));
    },
  });
  const allMet = state.conditions.every((c) => c.met);

  return (
    <SectionCard title={t("goLive.lock.title")} actions={(
      <div className="go-live__actions">
        {canWrite && !state.locked && !pending ? (
          <Button type="button" icon="pi pi-lock" label={t("goLive.lock.requestLock")} onClick={requestLock} disabled={!allMet} />
        ) : null}
        {canWrite && state.locked && !unlock && !pending ? (
          <Button type="button" icon="pi pi-lock-open" label={t("goLive.lock.requestUnlock")} severity="warning" outlined onClick={() => setUnlocking(true)} />
        ) : null}
      </div>
    )}>
      <div className="go-live__stack">
        <KeyValueGrid columns={4} items={[
          { label: t("goLive.lock.state"), value: <StatusChip label={state.locked ? (unlock ? t("goLive.header.unlocked") : t("goLive.header.locked")) : t("goLive.header.open")}
            severity={state.locked ? (unlock ? "warning" : "success") : "info"} /> },
          { label: t("goLive.lock.lockedAt"), value: state.lockedAt, type: "datetime" },
          { label: t("goLive.lock.restorePoint"), value: restorePoint, type: "datetime" },
          { label: t("goLive.lock.windowEnds"), value: state.unlockWindowEndsAt, type: "datetime" },
        ]} />
        {unlock ? (
          <div className="go-live__countdown" role="status">
            <i className="pi pi-clock" aria-hidden="true" />
            <span>{t("goLive.lock.relocksIn", { time: timeLeft(unlock.expiresAt, now), at: dateTimeOf(unlock.expiresAt) })}</span>
            <span className="go-live__muted">{(unlock.scope || []).map((s) => t(`goLive.lock.scopes.${s}`)).join(", ")}</span>
          </div>
        ) : null}
        {!state.locked ? (
          <DataTable value={state.conditions} dataKey="code" size="small">
            <Column header={t("goLive.lock.condition")} body={(c) => t(`goLive.lock.conditions.${c.code}`, { defaultValue: c.label })} />
            <Column header={t("goLive.loads.status")} body={(c) => <StatusChip label={c.met ? t("goLive.status.criterion.met") : t("goLive.status.criterion.not-met")}
              severity={c.met ? "success" : "danger"} />} />
            <Column header={t("goLive.lock.detail")} body={(c) => c.detail || "—"} />
          </DataTable>
        ) : null}
        {pending ? (
          <div className="go-live__pending">
            <KeyValueGrid columns={4} items={[
              { label: t("goLive.lock.request"), value: label(pending) },
              { label: t("goLive.lock.requestedBy"), value: `${pending.requestedBy} · ${dateTimeOf(pending.requestedAt)}` },
              { label: t("goLive.lock.imports"), value: pending.scope.map((s) => t(`goLive.lock.scopes.${s}`)).join(", "), hidden: pending.action !== "unlock" },
              { label: t("goLive.lock.hours"), value: pending.hours, type: "number", hidden: pending.action !== "unlock" },
              { label: t("goLive.settings.changes"), value: changesOf(pending).join("; "), span: 2, hidden: pending.action !== "settings" },
              { label: t("goLive.lock.reason"), value: pending.reason, span: 2 },
              { label: t("goLive.lock.decisionRef"), value: pending.decisionRef, hidden: !pending.decisionRef },
            ]} />
            <div className="go-live__actions">
              {(canWrite || canApprove) && pending.requestedById === myId() ? <Button type="button" label={t("goLive.lock.withdrawRequest")} outlined onClick={withdraw} /> : null}
              {canApprove ? (
                <ApprovalActions initiator={makerOf([pending.requestedById])} approveLabel={t(`goLive.lock.approve.${pending.action}`)} rejectLabel={t("goLive.lock.rejectRequest")}
                  onApprove={approve} onReject={reject} />
              ) : null}
            </div>
          </div>
        ) : null}
        <DataTable value={requests || []} dataKey="id" size="small" emptyMessage={t("goLive.lock.noRequests")} paginator rows={10}>
          <Column header={t("goLive.lock.request")} body={label} />
          <Column header={t("goLive.loads.status")} body={(r) => <Chip kind="lock" code={r.status} />} />
          <Column header={t("goLive.lock.scopeOrSettings")} body={(r) => (r.action === "settings" ? changesOf(r).join("; ")
            : r.scope.length ? r.scope.map((s) => t(`goLive.lock.scopes.${s}`)).join(", ") : "—")} />
          <Column header={t("goLive.lock.requestedBy")} body={(r) => `${r.requestedBy} · ${dateTimeOf(r.requestedAt)}`} />
          <Column header={t("goLive.lock.decidedBy")} body={(r) => (r.decidedBy ? `${r.decidedBy} · ${dateTimeOf(r.decidedAt)}` : "—")} />
          <Column header={t("goLive.lock.relockedAt")} body={(r) => dateTimeOf(r.relockedAt)} />
        </DataTable>
      </div>
      {unlocking ? <UnlockDialog state={state} onHide={() => setUnlocking(false)}
        onDone={() => { setUnlocking(false); notify("success", t("goLive.lock.requested", { what: t("goLive.lock.actions.unlock") })); onChanged(); }} /> : null}
    </SectionCard>
  );
};

export default LockBlock;
