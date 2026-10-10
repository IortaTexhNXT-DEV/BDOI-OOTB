import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import authService from "../../services/authService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { PendingBlock } from "./AccessChanges";
import { limitValue } from "./authorityFormat";
import { DELEGATION_WORDS, addDays, approverGroups, coverGroups, delegationProblems, periodDays } from "./delegations";
import { BaseRolesCheck, StatusTag, dateTime, shortDate, useBaseRoles, useLabels } from "./common";

const EMPTY = { delegatorId: null, delegateId: null, transactionTypes: [], dateFrom: null, dateTo: null };

/** "Up to ₱750,000.00", "No limit", "No limit set: not restricted". */
const useAuthorityText = () => {
  const k = useLabels();
  return (a, measure) => {
    if (!a?.set) return k("delegation.notRestricted", "No limit set: not restricted");
    if (a.unlimited) return k("noLimit", "No limit");
    return k("delegation.upTo", "Up to {{value}}", { value: limitValue(measure, a.limit, false, "") });
  };
};

/** The effect of a delegation on the authority of the person covering, per transaction (server preview). */
const Effect = ({ form, options }) => {
  const k = useLabels();
  const text = useAuthorityText();
  const ready = !!(form.delegatorId && form.delegateId && form.transactionTypes.length);
  const loader = useCallback(() => accessControlService.previewDelegation({ delegatorId: form.delegatorId, delegateId: form.delegateId,
    transactionTypes: form.transactionTypes, dateFrom: form.dateFrom || undefined }), [form.delegatorId, form.delegateId, form.transactionTypes, form.dateFrom]);
  const { data } = useStableLoad(loader, { enabled: ready, debounceMs: 300 });
  if (!ready || !data) return null;
  const cover = options.people.find((p) => p.id === form.delegateId)?.name || "";
  return (
    <section className="am-panel__section" aria-live="polite">
      <h3>{k("delegation.effect", "Effect")}</h3>
      <ul className="access-lines">
        {data.lines.map((l) => (
          <li key={l.transactionType}>
            {l.changes
              ? k("delegation.effectLine", "{{name}} will approve {{transaction}}: {{after}} (today: {{before}})", { name: cover, transaction: l.name, after: text(l.after, l.measure),
                before: text(l.before, l.measure) })
              : k("delegation.noChange", "{{transaction}}: no change ({{before}})", { transaction: l.name, before: text(l.before, l.measure) })}
          </li>
        ))}
      </ul>
    </section>
  );
};

Effect.propTypes = { form: PropTypes.object.isRequired, options: PropTypes.object.isRequired };

/** The authority of the person covering on a date (see it apply), with the delegations in effect then. */
const AuthorityOn = ({ delegation }) => {
  const k = useLabels();
  const text = useAuthorityText();
  const [day, setDay] = useState(delegation.dateFrom);
  const loader = useCallback(() => accessControlService.userAuthority(delegation.delegateId, day), [delegation.delegateId, day]);
  const { data } = useStableLoad(loader, { enabled: !!day });
  const lines = (data?.lines || []).filter((l) => !delegation.transactionTypes.length || delegation.transactionTypes.includes(l.transactionType));
  return (
    <section className="am-panel__section">
      <h3>{k("delegation.authorityOn", "Authority of {{name}} on", { name: delegation.delegateName })}</h3>
      <DateField id="dlg-on" value={day} onChange={(e) => setDay(e.target.value)} aria-label={k("delegation.onDate", "Date")} />
      <table className="access-panel__levels">
        <tbody>
          {lines.map((l) => (
            <tr key={l.transactionType}>
              <th scope="row">{l.name}</th>
              <td><span className="rp-cell-stack"><span>{text(l, l.measure)}</span>{l.source ? <span className="rp-muted">{l.source}</span> : null}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

AuthorityOn.propTypes = { delegation: PropTypes.object.isRequired };

/**
 * Side panel of Delegations. `target` { mode: "new" } is the form: approver away (people who can approve), the
 * transactions he or she can approve with the authority today, the person covering (people who cannot reach a chosen
 * step are disabled with the reason), the dates (from today, at most the longest delegation), the reason and the
 * effect; Submit for approval (Save with the approval off). `target` { mode: "view", row } shows a delegation, its
 * approval waiting, its history and its effect on a date, and ends it early (reason).
 */
const DelegationPanel = ({ target, onHide, onDone }) => {
  const k = useLabels();
  const text = useAuthorityText();
  const isNew = target?.mode === "new";
  const loader = useCallback(() => accessControlService.delegationOptions(), []);
  const { data: options } = useStableLoad(loader, { enabled: isNew });
  const [form, setForm] = useState(EMPTY);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endReason, setEndReason] = useState(null);
  const [base, setBase] = useBaseRoles();
  const me = authService.getUser()?.userId;

  useEffect(() => {
    if (!target) return;
    setForm(EMPTY);
    setReason(null);
    setTried(false);
    setEnding(false);
    setEndReason(null);
  }, [target]);
  useEffect(() => {
    if (options?.asOf) setForm((f) => (f.dateFrom ? f : { ...f, dateFrom: options.asOf }));
  }, [options?.asOf, target]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const types = useMemo(() => options?.types || [], [options]);
  const away = options?.people.find((p) => p.id === form.delegatorId) || null;
  const other = k("otherRoles", "Other roles");
  const approvers = useMemo(() => approverGroups(options?.people, options?.departments, { base, other }), [options, base, other]);
  const covers = useMemo(() => coverGroups(options?.people, options?.departments, { delegatorId: form.delegatorId, types: form.transactionTypes, me,
    approval: options?.approval !== false, base, other }), [options, form.delegatorId, form.transactionTypes, me, base, other]);
  const problems = options ? delegationProblems(form, { asOf: options.asOf, maxDays: options.maxDays }) : {};
  const reasonMissing = reasonProblem(reason);
  const typeName = (code) => types.find((t) => t.code === code)?.name || code;
  const problemText = (field) => {
    if (!tried || !problems[field]) return null;
    return {
      required: { delegatorId: k("delegation.chooseAway", "Choose the approver who is away"), delegateId: k("delegation.chooseCover", "Choose the person who covers"),
        transactionTypes: k("delegation.chooseTransactions", "Choose at least one transaction"), dateFrom: k("delegation.firstDay", "Enter the first day"),
        dateTo: k("delegation.lastDay", "Enter the last day") }[field],
      self: k("delegation.self", "A person cannot cover for himself or herself"),
      past: k("delegation.past", "A delegation cannot start in the past"),
      beforeStart: k("delegation.beforeStart", "The last day is before the first day"),
      tooLong: k("delegation.tooLong", "A delegation lasts at most {{days}} days", { days: options?.maxDays }),
    }[problems[field]];
  };

  const chooseAway = (id) => {
    const p = options.people.find((x) => x.id === id);
    set({ delegatorId: id, transactionTypes: p ? [...p.approves] : [], delegateId: form.delegateId === id ? null : form.delegateId });
  };
  const toggleType = (code, on) => set({ transactionTypes: on ? [...form.transactionTypes, code] : form.transactionTypes.filter((x) => x !== code) });

  const submit = async () => {
    setTried(true);
    if (Object.keys(problems).length || reasonMissing) return;
    setSaving(true);
    try {
      const r = await accessControlService.requestDelegation({ ...form, ...reasonPayload(reason) });
      notifySuccess(r.message);
      await onDone?.(r.data?.change ? "pending" : "current");
      onHide();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const endEarly = async () => {
    if (reasonProblem(endReason)) {
      setEnding("tried");
      return;
    }
    setSaving(true);
    try {
      const r = await accessControlService.endDelegation(target.row.id, reasonPayload(endReason));
      notifySuccess(r.message);
      await onDone?.();
      onHide();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const row = target?.mode === "view" ? target.row : null;
  const status = (s) => k(`delegation.status.${s}`, DELEGATION_WORDS[s] || s);
  let footer = <Button label={k("authority.close", "Close")} text onClick={onHide} />;
  if (isNew) {
    footer = (
      <div className="am-panel__footer">
        <span />
        <span className="rp-actions">
          <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
          <Button label={options?.approval === false ? k("save", "Save") : k("submitForApproval", "Submit for approval")} icon="pi pi-send" onClick={submit} loading={saving}
            disabled={!options} />
        </span>
      </div>
    );
  } else if (row?.canEnd) {
    footer = (
      <div className="am-panel__footer">
        {ending ? <Button label={k("delegation.endEarly", "End early")} severity="danger" icon="pi pi-stop-circle" onClick={endEarly} loading={saving} />
          : <Button label={k("delegation.endEarly", "End early")} severity="danger" text onClick={() => setEnding(true)} />}
        <Button label={k("authority.close", "Close")} text onClick={onHide} disabled={saving} />
      </div>
    );
  }

  return (
    <Dialog visible={!!target} onHide={onHide} modal className="am-panel access-form" style={{ width: "36rem" }} footer={footer}
      header={(
        <div className="am-panel__title">
          <span>{isNew ? k("newDelegation", "New delegation") : k("delegation.title", "Delegation {{ref}}", { ref: row?.ref || "" })}</span>
          {row ? <span className="am-panel__subtitle">{`${row.delegatorName} · ${row.delegateName}`}</span> : null}
        </div>
      )}>
      {isNew && !options ? <span className="rp-muted">{k("delegation.loading", "Loading the approvers")}</span> : null}
      {isNew && options ? (
        <div className="am-panel__body">
          <div className="admin__field">
            <label htmlFor="dlg-away">{k("colDelegator", "Approver away")}</label>
            <Dropdown inputId="dlg-away" value={form.delegatorId} options={approvers} optionGroupLabel="label" optionGroupChildren="items" filter
              onChange={(e) => chooseAway(e.value)} placeholder={k("delegation.chooseAway", "Choose the approver who is away")} className={problemText("delegatorId") ? "p-invalid" : ""}
              itemTemplate={(o) => <span className="rp-cell-stack"><span>{o.label}</span><span className="rp-muted">{o.person.roleNames.join(", ")}</span></span>} />
            <FieldError error={problemText("delegatorId")} />
            <BaseRolesCheck checked={base} onChange={setBase} id="dlg-base" />
          </div>
          {away ? (
            <fieldset className="access-checklist">
              <legend>{k("colTransactions", "Transactions")}</legend>
              {away.approves.map((code) => {
                const t = types.find((x) => x.code === code);
                return (
                  <div key={code} className="access-checklist__item">
                    <Checkbox inputId={`dlg-type-${code}`} checked={form.transactionTypes.includes(code)} onChange={(e) => toggleType(code, e.checked)} />
                    <label htmlFor={`dlg-type-${code}`} className="rp-cell-stack">
                      <span>{typeName(code)}</span>
                      <span className="rp-muted">{text(away.authority[code], t?.measure)}{away.authority[code]?.source ? ` · ${away.authority[code].source}` : ""}</span>
                    </label>
                  </div>
                );
              })}
              <FieldError error={problemText("transactionTypes")} />
            </fieldset>
          ) : null}
          <div className="admin__field">
            <label htmlFor="dlg-cover">{k("colDelegate", "Covered by")}</label>
            <Dropdown inputId="dlg-cover" value={form.delegateId} options={covers} optionGroupLabel="label" optionGroupChildren="items" filter optionDisabled="disabled"
              onChange={(e) => set({ delegateId: e.value })} placeholder={k("delegation.chooseCover", "Choose the person who covers")} className={problemText("delegateId") ? "p-invalid" : ""}
              itemTemplate={(o) => (
                <span className="rp-cell-stack">
                  <span>{o.label}</span>
                  <span className="rp-muted">{o.disabled ? k("delegation.cannotApprove", "Cannot approve {{transactions}}", { transactions: o.missing.map(typeName).join(", ") })
                    : o.person.roleNames.join(", ")}</span>
                </span>
              )} />
            <FieldError error={problemText("delegateId")} />
          </div>
          <div className="access__two">
            <div className="admin__field">
              <label htmlFor="dlg-from">{k("delegation.from", "From")}</label>
              <DateField id="dlg-from" value={form.dateFrom} min={options.asOf} onChange={(e) => set({ dateFrom: e.target.value })} invalid={!!problemText("dateFrom")} />
              <FieldError error={problemText("dateFrom")} />
            </div>
            <div className="admin__field">
              <label htmlFor="dlg-to">{k("delegation.to", "To")}</label>
              <DateField id="dlg-to" value={form.dateTo} min={form.dateFrom || options.asOf} max={form.dateFrom ? addDays(form.dateFrom, options.maxDays - 1) : undefined}
                onChange={(e) => set({ dateTo: e.target.value })} invalid={!!problemText("dateTo")} />
              <FieldError error={problemText("dateTo")} />
            </div>
          </div>
          {periodDays(form.dateFrom, form.dateTo) ? <span className="rp-muted">{k("delegation.days", "{{count}} days", { count: periodDays(form.dateFrom, form.dateTo) })}</span> : null}
          <ReasonPicker context="delegation" value={reason} onChange={setReason} showErrors={tried} />
          <Effect form={form} options={options} />
        </div>
      ) : null}
      {row ? (
        <div className="am-panel__body">
          <StatusTag status={row.status} label={status(row.status)} />
          {row.change && row.status === "pending" ? <PendingBlock change={row.change} onDone={async () => { await onDone?.(); onHide(); }} /> : null}
          <KeyValueGrid columns={2} items={[
            { key: "away", label: k("colDelegator", "Approver away"), value: [row.delegatorName, row.delegatorDepartment].filter(Boolean).join(" · ") },
            { key: "cover", label: k("colDelegate", "Covered by"), value: [row.delegateName, row.delegateDepartment].filter(Boolean).join(" · ") },
            { key: "types", label: k("colTransactions", "Transactions"), value: row.transactionNames.join(", "), span: "full" },
            { key: "period", label: k("colPeriod", "Period"), value: `${shortDate(row.dateFrom)} – ${shortDate(row.dateTo)} · ${k("delegation.days", "{{count}} days", { count: row.days })}`, span: "full" },
            { key: "reason", label: k("colReason", "Reason"), value: row.reason, span: "full" },
            { key: "requested", label: k("changes.colRequested", "Requested by"), value: row.requestedBy ? `${row.requestedBy} · ${dateTime(row.requestedAt)}` : null },
            { key: "approved", label: k("authority.approvedBy", "Approved by"), value: row.approvedBy ? `${row.approvedBy} · ${dateTime(row.approvedAt)}` : null, hidden: !row.approvedBy },
            { key: "ended", label: row.status === "ended-early" ? k("delegation.endedBy", "Ended by") : k("delegation.decidedBy", "Decided by"),
              value: row.endedBy ? `${row.endedBy} · ${dateTime(row.endedAt)}` : null, hidden: !row.endedBy },
            { key: "endReason", label: k("delegation.endReason", "Reason for ending"), value: row.endReason, hidden: !row.endReason, span: "full" },
          ]} />
          {["scheduled", "in-effect"].includes(row.status) ? <AuthorityOn delegation={row} /> : null}
          {ending ? (
            <section className="am-panel__section">
              <h3>{k("delegation.endEarly", "End early")}</h3>
              <ReasonPicker context="delegation_end" value={endReason} onChange={setEndReason} showErrors={ending === "tried"} />
            </section>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
};

DelegationPanel.propTypes = {
  target: PropTypes.shape({ mode: PropTypes.oneOf(["new", "view"]).isRequired, row: PropTypes.object }),
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func,
};

export default DelegationPanel;
