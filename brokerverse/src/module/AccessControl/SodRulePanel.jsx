import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { SelectButton } from "primereact/selectbutton";
import FieldError from "../../components/FieldError";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { PendingBlock } from "./AccessChanges";
import { indexCatalogue } from "./roleAccess";
import { ruleProblems } from "./sod";
import { BaseRolesCheck, useAccessNames, useBaseRoles, useLabels, useRoleOptions } from "./common";

const EMPTY = { code: "", name: "", kind: "roles", roleA: null, roleB: null, accessA: [], accessB: [], action: "warn", reason: "", active: true };

/**
 * Side panel of a segregation-of-duties rule: new (target.rule null), change, or switch on / off (target.rule.toggle).
 * Name, the two roles (grouped by department) or the two sets of access, Block or Warn, the risk, the status, the reason
 * of the change and how many active users hold both sides today. Submit for approval (Save with the approval off).
 */
const SodRulePanel = ({ target, directory, approval = true, technical = false, onHide, onDone }) => {
  const k = useLabels();
  const names = useAccessNames();
  const [form, setForm] = useState(EMPTY);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const rule = target?.rule || null;
  const forced = !!rule && !!directory?.roles.some((r) => r.platform && (r.code === rule.roleA || r.code === rule.roleB));
  const [base, setBase] = useBaseRoles(forced);
  const roleOptions = useRoleOptions(directory, { base, inactive: true });

  useEffect(() => {
    if (!target) return;
    setForm(rule ? { ...EMPTY, ...rule, reason: rule.reason || "", active: rule.toggle ? !rule.active : rule.active } : { ...EMPTY });
    setReason(null);
    setTried(false);
  }, [target, rule]);

  const access = form.kind === "access";
  const catalogueLoader = useCallback(() => accessControlService.roleAccess().then((r) => r.catalogue), []);
  const { data: catalogue } = useStableLoad(catalogueLoader, { enabled: !!target && access });
  const accessOptions = useMemo(() => {
    const idx = indexCatalogue(catalogue);
    return idx.areas.map((a) => ({
      label: names.area(a),
      items: idx.modulesOf(a.code).flatMap((m) => m.levels.map((l) => ({ label: `${names.module(m)} › ${names.level(l)}`, value: idx.code(m.code, l) }))),
    }));
  }, [catalogue, names]);

  const sides = useMemo(() => (access ? { kind: "access", accessA: form.accessA, accessB: form.accessB } : { kind: "roles", roleA: form.roleA, roleB: form.roleB }),
    [access, form.accessA, form.accessB, form.roleA, form.roleB]);
  const problems = ruleProblems(form);
  const sidesReady = !Object.keys(ruleProblems({ ...form, name: "x" })).length;
  const checkLoader = useCallback(() => accessControlService.checkSodRule(sides), [sides]);
  const { data: check } = useStableLoad(checkLoader, { enabled: !!target && sidesReady, debounceMs: 300 });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const show = (field) => {
    if (!tried || !problems[field]) return null;
    return { required: k("sod.required", "Required"), same: k("sod.sameRole", "Pick two different roles"), overlap: k("sod.overlap", "The same access cannot be on both sides") }[problems[field]];
  };

  const submit = async () => {
    setTried(true);
    if (Object.keys(problems).length || reasonProblem(reason)) return;
    setSaving(true);
    try {
      const body = { name: form.name.trim(), action: form.action, reason: form.reason.trim() || null, active: form.active, ...sides, ...reasonPayload(reason) };
      if (rule) body.id = rule.id;
      else if (technical && form.code.trim()) body.code = form.code.trim().toUpperCase();
      const r = await accessControlService.requestSodRule(body);
      notifySuccess(r.message);
      await onDone?.();
      onHide();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };

  let title = k("newRule", "New rule");
  if (rule?.toggle) title = rule.active ? k("sod.switchOffTitle", "Switch off the rule") : k("sod.switchOnTitle", "Switch on the rule");
  else if (rule) title = k("editRule", "Edit rule");
  const footer = rule?.change ? <Button label={k("authority.close", "Close")} text onClick={onHide} /> : (
    <div className="am-panel__footer">
      <span />
      <span className="rp-actions">
        <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
        <Button label={approval ? k("submitForApproval", "Submit for approval") : k("save", "Save")} icon="pi pi-send" onClick={submit} loading={saving} />
      </span>
    </div>
  );
  const kinds = [{ label: k("kindRoles", "Roles held together"), value: "roles" }, { label: k("kindAccess", "Access combined"), value: "access" }];
  const actions = [
    { label: k("actionBlock", "Block"), value: "block", hint: k("sod.blockHint", "The roles cannot be given to the same person") },
    { label: k("actionWarn", "Warn"), value: "warn", hint: k("sod.warnHint", "The roles can be given; the person is listed under Conflicts") },
  ];

  return (
    <Dialog visible={!!target} onHide={onHide} modal className="am-panel access-form" style={{ width: "36rem" }} footer={footer}
      header={(
        <div className="am-panel__title">
          <span>{title}</span>
          {rule ? <span className="am-panel__subtitle">{rule.name}</span> : null}
          {technical && rule ? <span className="rp-code">{rule.code}</span> : null}
        </div>
      )}>
      {rule?.change ? <PendingBlock change={rule.change} onDone={async () => { await onDone?.(); onHide(); }} /> : (
        <div className="am-panel__body">
          {rule?.toggle ? null : (
            <>
              {technical && !rule ? (
                <div className="admin__field">
                  <label htmlFor="sod-code">{k("colCode", "Code")} <span className="rp-muted">{k("authority.optional", "(optional)")}</span></label>
                  <InputText id="sod-code" value={form.code} maxLength={40} onChange={(e) => set({ code: e.target.value })} />
                </div>
              ) : null}
              <div className="admin__field">
                <label htmlFor="sod-name">{k("colRule", "Rule")}</label>
                <InputText id="sod-name" value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} className={show("name") ? "p-invalid" : ""} />
                <FieldError error={show("name")} />
              </div>
              {!rule ? (
                <div className="admin__field">
                  <span className="bv-field-label">{k("colKind", "Rule type")}</span>
                  <SelectButton value={form.kind} options={kinds} onChange={(e) => e.value && set({ kind: e.value })} />
                </div>
              ) : null}
              {access ? (
                <>
                  <div className="admin__field">
                    <label htmlFor="sod-access-a">{k("accessA", "Access")}</label>
                    <MultiSelect inputId="sod-access-a" value={form.accessA} options={accessOptions} optionGroupLabel="label" optionGroupChildren="items" display="chip" filter
                      onChange={(e) => set({ accessA: e.value })} placeholder={k("chooseAccess", "Choose the access")} className={show("accessA") ? "p-invalid" : ""} />
                    <FieldError error={show("accessA")} />
                  </div>
                  <div className="admin__field">
                    <label htmlFor="sod-access-b">{k("accessB", "Not combined with")}</label>
                    <MultiSelect inputId="sod-access-b" value={form.accessB} options={accessOptions} optionGroupLabel="label" optionGroupChildren="items" display="chip" filter
                      onChange={(e) => set({ accessB: e.value })} placeholder={k("chooseAccess", "Choose the access")} className={show("accessB") ? "p-invalid" : ""} />
                    <FieldError error={show("accessB")} />
                  </div>
                </>
              ) : (
                <>
                  <div className="access__two">
                    <div className="admin__field">
                      <label htmlFor="sod-a">{k("roleA", "Role")}</label>
                      <Dropdown inputId="sod-a" value={form.roleA} options={roleOptions} optionGroupLabel="label" optionGroupChildren="items" filter
                        onChange={(e) => set({ roleA: e.value })} className={show("roleA") ? "p-invalid" : ""} />
                      <FieldError error={show("roleA")} />
                    </div>
                    <div className="admin__field">
                      <label htmlFor="sod-b">{k("roleB", "Not together with")}</label>
                      <Dropdown inputId="sod-b" value={form.roleB} filter optionGroupLabel="label" optionGroupChildren="items"
                        options={roleOptions.map((g) => ({ ...g, items: g.items.filter((o) => o.value !== form.roleA) })).filter((g) => g.items.length)}
                        onChange={(e) => set({ roleB: e.value })} className={show("roleB") ? "p-invalid" : ""} />
                      <FieldError error={show("roleB")} />
                    </div>
                  </div>
                  <BaseRolesCheck checked={base} onChange={setBase} id="sod-panel-base" />
                </>
              )}
              <div className="admin__field">
                <span className="bv-field-label">{k("colAction", "When assigned")}</span>
                <SelectButton value={form.action} options={actions} onChange={(e) => e.value && set({ action: e.value })}
                  itemTemplate={(o) => <span title={o.hint}>{o.label}</span>} />
                <span className="rp-muted">{actions.find((a) => a.value === form.action)?.hint}</span>
              </div>
              <div className="admin__field">
                <label htmlFor="sod-risk">{k("sod.risk", "Risk")} <span className="rp-muted">{k("authority.optional", "(optional)")}</span></label>
                <InputTextarea id="sod-risk" rows={2} autoResize maxLength={500} value={form.reason} onChange={(e) => set({ reason: e.target.value })}
                  placeholder={k("sod.riskHint", "Why these duties are kept apart")} />
              </div>
              {rule ? (
                <div className="access-switch">
                  <InputSwitch inputId="sod-active" checked={form.active} onChange={(e) => set({ active: !!e.value })} />
                  <label htmlFor="sod-active">{form.active ? k("on", "On") : k("off", "Off")}</label>
                </div>
              ) : null}
            </>
          )}
          {check && sidesReady ? (
            <p className="am-panel__note" aria-live="polite">
              <i className="pi pi-users" aria-hidden="true" />
              {check.users ? k("sod.checkUsers", "{{count}} active users hold both today: they are listed under Conflicts", { count: check.users })
                : k("sod.checkNone", "No active user holds both today")}
              {check.users && form.action === "block" ? ` ${k("sod.blockKeeps", "They keep their roles; Block applies to new assignments.")}` : ""}
            </p>
          ) : null}
          <ReasonPicker context="access_change" value={reason} onChange={setReason} showErrors={tried} label={k("sod.changeReason", "Reason for the change")} />
        </div>
      )}
    </Dialog>
  );
};

SodRulePanel.propTypes = {
  target: PropTypes.shape({ rule: PropTypes.object }),
  directory: PropTypes.object,
  approval: PropTypes.bool,
  technical: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func,
};

export default SodRulePanel;
