import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AutoComplete } from "primereact/autocomplete";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import accessControlService from "../../services/accessControlService";
import userService from "../../services/userService";
import { confirmAction, notifyError, notifySuccess } from "../../utility/dialogs";
import { formFor, formProblems, lineOf, limitValue } from "./authorityFormat";
import { PendingActions } from "./AuthorityPendingTab";
import { dateTime, shortDate, useLabels } from "./common";

/** Text of a field problem (formProblems). */
const useProblemText = () => {
  const k = useLabels();
  return (field, problem) => {
    if (!problem) return null;
    const texts = {
      required: {
        maxAmount: k("authority.limitRequired", "Enter the limit, or switch on No limit"),
        referenceNo: k("authority.referenceRequired", "Enter the authority reference"),
        referenceDate: k("authority.referenceDateRequired", "Enter the date of the reference"),
        userId: k("authority.personRequired", "Choose the person"),
        transactionType: k("authority.transactionRequired", "Choose the transaction"),
        effectiveFrom: k("authority.effectiveRequired", "Enter the effective date"),
      }[field],
      negative: k("authority.limitNegative", "The limit cannot be negative"),
      percent: k("authority.limitPercentMax", "A percent limit cannot be over 100"),
      past: k("authority.effectivePast", "The effective date cannot be in the past"),
      future: k("authority.referenceFuture", "The reference date cannot be in the future"),
    };
    return texts[problem] || null;
  };
};

/** The limit in effect of a cell: value, dates, reference, approval; or Not set with what it means today. */
const InEffect = ({ cell, measure, withoutLimit }) => {
  const k = useLabels();
  const noLimit = k("noLimit", "No limit");
  if (!cell?.set) {
    return (
      <div className="am-panel__state">
        <span className="am-notset">{k("notSet", "Not set")}</span>
        <span className="rp-muted">{withoutLimit === "refuse" ? k("authority.notSetRefuse", "Approvals of this role are refused")
          : k("authority.notSetAllow", "Approvals of this role are not restricted by a limit")}</span>
      </div>
    );
  }
  return (
    <KeyValueGrid columns={2} items={[
      { label: k("authority.limit", "Approval limit"), value: limitValue(measure, cell.maxAmount, cell.unlimited, noLimit), key: "limit" },
      { label: k("authority.effectiveFrom", "Effective from"), value: shortDate(cell.effectiveFrom), key: "from" },
      { label: k("authority.endsOn", "Ends on"), value: cell.endsOn ? shortDate(cell.endsOn) : null, hidden: !cell.endsOn, key: "ends" },
      { label: k("authority.reference", "Authority reference"), value: [cell.referenceNo, cell.referenceDate ? shortDate(cell.referenceDate) : null].filter(Boolean).join(" · ") || null, key: "ref" },
      { label: k("authority.approvedBy", "Approved by"), value: cell.approvedBy ? `${cell.approvedBy} · ${dateTime(cell.approvedAt)}` : null, key: "by" },
      { label: k("colRemarks", "Remarks"), value: cell.remarks, hidden: !cell.remarks, span: "full", key: "remarks" },
    ]} />
  );
};

InEffect.propTypes = { cell: PropTypes.object, measure: PropTypes.string, withoutLimit: PropTypes.string };

/** The change waiting for approval of a cell, with the actions this user may take. */
export const PendingBlock = ({ pending, measure, onDone }) => {
  const k = useLabels();
  const proposed = pending.removes ? k("authority.removal", "Remove the limit") : limitValue(measure, pending.maxAmount, pending.unlimited, k("noLimit", "No limit"));
  return (
    <section className="am-panel__pending" aria-label={k("authority.pendingApproval", "Pending approval")}>
      <div className="am-panel__pending-head">
        <i className="pi pi-clock" aria-hidden="true" />
        <strong>{k("authority.pendingApproval", "Pending approval")}</strong>
        <span className="rp-muted">{pending.lines > 1 ? k("authority.inChange", "{{ref}} · {{count}} limits", { ref: pending.ref, count: pending.lines }) : pending.ref}</span>
      </div>
      <KeyValueGrid columns={2} items={[
        { label: k("authority.proposed", "Proposed"), value: proposed, key: "value" },
        { label: k("authority.effectiveFrom", "Effective from"), value: shortDate(pending.effectiveFrom), key: "from" },
        { label: k("authority.reference", "Authority reference"), value: [pending.referenceNo, pending.referenceDate ? shortDate(pending.referenceDate) : null].filter(Boolean).join(" · ") || null, key: "ref" },
        { label: k("authority.proposedBy", "Proposed by"), value: `${pending.requestedBy || ""} · ${dateTime(pending.requestedAt)}`, key: "by" },
        { label: k("colRemarks", "Remarks"), value: pending.remarks, hidden: !pending.remarks, span: "full", key: "remarks" },
      ]} />
      <PendingActions item={pending} title={proposed} onDone={onDone} />
      {!pending.canDecide && !pending.canWithdraw ? <span className="rp-muted">{k("authority.waitingOther", "Waiting for another administrator")}</span> : null}
    </section>
  );
};

PendingBlock.propTypes = { pending: PropTypes.object.isRequired, measure: PropTypes.string, onDone: PropTypes.func };

/**
 * Side panel of the Authority Matrix: the limit of a role (a cell) or of a person for a transaction. Shows the limit
 * in effect, a change waiting for approval with its actions, or the form: the limit by measure (percent 0-100 or a
 * peso amount) with No limit beside it, the effective date, the authority reference and its date, remarks. Submit
 * sends one change for approval; Remove limit sends its removal for approval.
 *
 * target: { row (transaction type of the matrix), role } for a cell, { person: { userId, userName }, row } for a
 * personal limit, or { person: null } to add a personal limit.
 */
const AuthorityLimitPanel = ({ target: opened, data, technical, onHide, onDone }) => {
  const k = useLabels();
  // The panel keeps its last target while the dialog closes, so the content stays whole until it is gone.
  const last = useRef(null);
  if (opened) last.current = opened;
  const target = opened || last.current;
  const problemText = useProblemText();
  const today = data?.asOf;
  const types = useMemo(() => (data?.rows || []).filter((r) => r.checked || target?.row?.code === r.code), [data, target]);
  const [form, setForm] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState([]);
  const [person, setPerson] = useState(null);

  const personal = !!target && !target.role;
  const row = target?.row || types.find((t) => t.code === form?.transactionType) || null;
  const measure = row?.measure || "amount";
  const cell = useMemo(() => {
    if (!target) return null;
    if (target.role) return row?.cells[target.role.code] || null;
    if (!form?.userId || !form?.transactionType) return null;
    return (data?.userLimits || []).find((p) => p.userId === form.userId && p.transactionType === form.transactionType) || null;
  }, [target, row, form, data]);

  useEffect(() => {
    if (!opened) return;
    setForm(formFor({ transactionType: opened.row?.code || null, roleCode: opened.role?.code || null, userId: opened.person?.userId || null,
      cell: opened.role ? opened.row.cells[opened.role.code] : opened.cell, today }));
    setPerson(opened.person ? { userId: opened.person.userId, name: opened.person.userName } : null);
    setTried(false);
  }, [opened, today]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const problems = form ? formProblems(form, { measure, referenceRequired: data?.referenceRequired, today }) : {};
  const show = (field) => (tried ? problemText(field, problems[field]) : null);
  const edit = !!data?.abilities?.edit;
  const pending = cell?.pending || null;

  const findPeople = async (e) => {
    try {
      setPeople(await userService.lookupUsers(e.query));
    } catch (err) {
      notifyError(err.message);
    }
  };

  const send = async (line, message) => {
    setSaving(true);
    try {
      const r = await accessControlService.proposeAuthorityChange({ lines: [line] });
      notifySuccess(message || r.message);
      await onDone?.();
      onHide();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const submit = () => {
    setTried(true);
    if (Object.keys(problems).length) return;
    send(lineOf(form));
  };
  const remove = async () => {
    setTried(true);
    if (problems.referenceNo || problems.referenceDate || problems.effectiveFrom) return;
    if (!(await confirmAction(k("authority.removeConfirm", "Send the removal of this limit for approval? It stays in effect until another administrator approves it."),
      { header: k("authority.removeLimit", "Remove limit"), acceptLabel: k("authority.removeLimit", "Remove limit"), rejectLabel: k("cancel", "Cancel"), danger: true }))) return;
    const line = lineOf(form);
    send({ ...line, removes: true, unlimited: false, maxAmount: null });
  };

  const who = target?.role ? target.role.name : person?.name;
  const subtitle = [row?.name, who].filter(Boolean).join(" · ");
  const canForm = edit && !pending;
  const footer = canForm ? (
    <div className="am-panel__footer">
      {cell?.set ? <Button label={k("authority.removeLimit", "Remove limit")} text severity="danger" onClick={remove} disabled={saving} /> : <span />}
      <span className="rp-actions">
        <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
        <Button label={k("submitForApproval", "Submit for approval")} icon="pi pi-send" onClick={submit} loading={saving} />
      </span>
    </div>
  ) : <Button label={k("authority.close", "Close")} text onClick={onHide} />;

  return (
    <Dialog visible={!!opened} onHide={onHide} modal className="am-panel" style={{ width: "32rem" }} footer={footer}
      header={(
        <div className="am-panel__title">
          <span>{personal ? k("authority.personalLimit", "Personal approval limit") : k("authority.panelTitle", "Approval limit")}</span>
          {subtitle ? <span className="am-panel__subtitle">{subtitle}</span> : null}
          {technical && (row || target?.role) ? <span className="rp-code">{[row?.code, target?.role?.code].filter(Boolean).join(" · ")}</span> : null}
        </div>
      )}>
      {form ? (
        <div className="am-panel__body">
          {personal && !target.person ? (
            <div className="am-panel__grid">
              <div className="admin__field">
                <label htmlFor="am-person">{k("colPerson", "Person")}</label>
                <AutoComplete inputId="am-person" value={person} suggestions={people} completeMethod={findPeople} field="name" dropdown forceSelection
                  onChange={(e) => { setPerson(e.value); set({ userId: e.value?.userId || null }); }} className={show("userId") ? "p-invalid" : ""} />
                <FieldError error={show("userId")} />
              </div>
              <div className="admin__field">
                <label htmlFor="am-type">{k("colTransaction", "Transaction")}</label>
                <Dropdown inputId="am-type" value={form.transactionType} options={types} optionLabel="name" optionValue="code"
                  onChange={(e) => set({ transactionType: e.value })} placeholder={k("authority.chooseTransaction", "Choose the transaction")}
                  className={show("transactionType") ? "p-invalid" : ""} />
                <FieldError error={show("transactionType")} />
              </div>
            </div>
          ) : null}

          {row && (target?.role || form.userId) ? (
            <section className="am-panel__section">
              <h3>{k("authority.inEffect", "In effect")}</h3>
              <InEffect cell={cell} measure={measure} withoutLimit={data.withoutLimit} />
              {cell?.scheduled ? (
                <p className="am-panel__note">
                  <i className="pi pi-calendar" aria-hidden="true" />
                  {k("authority.scheduledNote", "{{value}} from {{date}}", { value: limitValue(measure, cell.scheduled.maxAmount, cell.scheduled.unlimited, k("noLimit", "No limit")),
                    date: shortDate(cell.scheduled.effectiveFrom) })}
                </p>
              ) : null}
            </section>
          ) : null}

          {pending ? <PendingBlock pending={pending} measure={measure} onDone={async () => { await onDone?.(); onHide(); }} /> : null}

          {canForm ? (
            <section className="am-panel__section">
              <h3>{cell?.set ? k("authority.change", "Change") : k("authority.set", "Set a limit")}</h3>
              <div className="admin__field">
                <label htmlFor="am-limit">{measure === "percent" ? k("authority.limitPercent", "Approval limit (% of premium)") : k("authority.limitAmount", "Approval limit (PHP)")}</label>
                <div className="am-limit-row">
                  {measure === "percent" ? (
                    <InputNumber inputId="am-limit" value={form.unlimited ? null : form.maxAmount} onValueChange={(e) => set({ maxAmount: e.value })} disabled={form.unlimited}
                      min={0} maxFractionDigits={2} suffix="%" placeholder={form.unlimited ? k("noLimit", "No limit") : undefined}
                      className={show("maxAmount") ? "p-invalid" : ""} />
                  ) : (
                    <InputNumber inputId="am-limit" value={form.unlimited ? null : form.maxAmount} onValueChange={(e) => set({ maxAmount: e.value })} disabled={form.unlimited}
                      mode="currency" currency="PHP" locale="en-PH" min={0} minFractionDigits={2} maxFractionDigits={2}
                      placeholder={form.unlimited ? k("noLimit", "No limit") : undefined} className={show("maxAmount") ? "p-invalid" : ""} />
                  )}
                  <span className="am-switch">
                    <InputSwitch inputId="am-unlimited" checked={form.unlimited} onChange={(e) => set({ unlimited: !!e.value, maxAmount: e.value ? null : form.maxAmount })} />
                    <label htmlFor="am-unlimited">{k("noLimit", "No limit")}</label>
                  </span>
                </div>
                <FieldError error={show("maxAmount")} />
              </div>
              <div className="admin__field">
                <label htmlFor="am-from">{k("authority.effectiveFrom", "Effective from")}</label>
                <DateField id="am-from" value={form.effectiveFrom} min={today} onChange={(e) => set({ effectiveFrom: e.target.value })} invalid={!!show("effectiveFrom")} />
                <FieldError error={show("effectiveFrom")} />
              </div>
              <div className="access__two">
                <div className="admin__field">
                  <label htmlFor="am-ref">{k("authority.reference", "Authority reference")}{data.referenceRequired ? null : <span className="rp-muted"> {k("authority.optional", "(optional)")}</span>}</label>
                  <InputText id="am-ref" value={form.referenceNo} maxLength={60} onChange={(e) => set({ referenceNo: e.target.value })} className={show("referenceNo") ? "p-invalid" : ""} />
                  <FieldError error={show("referenceNo")} />
                </div>
                <div className="admin__field">
                  <label htmlFor="am-refdate">{k("authority.referenceDate", "Reference date")}</label>
                  <DateField id="am-refdate" value={form.referenceDate} max={today} onChange={(e) => set({ referenceDate: e.target.value })} invalid={!!show("referenceDate")} />
                  <FieldError error={show("referenceDate")} />
                </div>
              </div>
              <div className="admin__field">
                <label htmlFor="am-remarks">{k("colRemarks", "Remarks")} <span className="rp-muted">{k("authority.optional", "(optional)")}</span></label>
                <InputTextarea id="am-remarks" rows={2} maxLength={500} autoResize value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} />
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
};

AuthorityLimitPanel.propTypes = {
  target: PropTypes.shape({ row: PropTypes.object, role: PropTypes.object, person: PropTypes.object, cell: PropTypes.object }),
  data: PropTypes.object,
  technical: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func,
};

export default AuthorityLimitPanel;
