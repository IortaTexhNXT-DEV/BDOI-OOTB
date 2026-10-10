import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { SelectButton } from "primereact/selectbutton";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { addDays } from "./delegations";
import { BaseRolesCheck, useBaseRoles, useDepartmentOptions, useLabels, useRoleOptions } from "./common";

const monthYear = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Side panel to start an access review: name (proposed from the month), due date (today at the earliest, proposed
 * from the review period setting), scope (all active users, departments or roles) and how many users it reviews.
 */
const ReviewStartPanel = ({ visible, directory, onHide, onStarted }) => {
  const k = useLabels();
  const asOf = directory?.asOf;
  const [form, setForm] = useState({ name: "", dueDate: "", kind: "all", departments: [], roles: [] });
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [base, setBase] = useBaseRoles();
  const departments = useDepartmentOptions(directory);
  const roles = useRoleOptions(directory, { base });

  useEffect(() => {
    if (!visible || !asOf) return;
    setForm({ name: k("review.defaultName", "Access review {{period}}", { period: monthYear(asOf) }), dueDate: addDays(asOf, directory?.settings?.reviewDueDays || 14),
      kind: "all", departments: [], roles: [] });
    setTried(false);
  }, [visible, asOf, directory, k]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const scope = useMemo(() => ({ kind: form.kind, departments: form.kind === "departments" ? form.departments : undefined, roles: form.kind === "roles" ? form.roles : undefined }),
    [form.kind, form.departments, form.roles]);
  const scopeReady = form.kind === "all" || (form.kind === "departments" ? form.departments.length > 0 : form.roles.length > 0);
  const loader = useCallback(() => accessControlService.previewReview(scope), [scope]);
  const { data: preview } = useStableLoad(loader, { enabled: visible && scopeReady, debounceMs: 250 });

  const problems = {
    name: String(form.name).trim().length < 3 ? k("review.nameRequired", "Enter the name of the review") : null,
    dueDate: !form.dueDate ? k("review.dueRequired", "Enter the due date") : asOf && form.dueDate < asOf ? k("review.duePast", "The due date cannot be in the past") : null,
    scope: scopeReady ? null : k("review.scopeRequired", "Choose at least one"),
  };
  const show = (field) => (tried ? problems[field] : null);

  const start = async () => {
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    setSaving(true);
    try {
      const r = await accessControlService.startReview({ name: form.name.trim(), dueDate: form.dueDate, scope });
      notifySuccess(r.message);
      onStarted(r.data.id);
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="am-panel__footer">
      <span />
      <span className="rp-actions">
        <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
        <Button label={k("start", "Start")} icon="pi pi-play" onClick={start} loading={saving} />
      </span>
    </div>
  );
  const kinds = [{ value: "all", label: k("review.scopeAll", "All active users") }, { value: "departments", label: k("review.scopeDepartments", "Departments") },
    { value: "roles", label: k("review.scopeRoles", "Roles") }];

  return (
    <Dialog visible={visible} onHide={onHide} modal className="am-panel access-form" style={{ width: "36rem" }} footer={footer} header={k("startReview", "Start a review")}>
      <div className="am-panel__body">
        <div className="admin__field">
          <label htmlFor="rv-name">{k("colReview", "Review")}</label>
          <InputText id="rv-name" value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} className={show("name") ? "p-invalid" : ""} />
          <FieldError error={show("name")} />
        </div>
        <div className="admin__field">
          <label htmlFor="rv-due">{k("colDue", "Due")}</label>
          <DateField id="rv-due" value={form.dueDate} min={asOf} onChange={(e) => set({ dueDate: e.target.value })} invalid={!!show("dueDate")} />
          <FieldError error={show("dueDate")} />
        </div>
        <div className="admin__field">
          <span className="bv-field-label">{k("review.colScope", "Scope")}</span>
          <SelectButton value={form.kind} options={kinds} onChange={(e) => e.value && set({ kind: e.value })} />
        </div>
        {form.kind === "departments" ? (
          <div className="admin__field">
            <label htmlFor="rv-departments">{k("review.scopeDepartments", "Departments")}</label>
            <MultiSelect inputId="rv-departments" value={form.departments} options={departments} onChange={(e) => set({ departments: e.value })} display="chip"
              className={show("scope") ? "p-invalid" : ""} />
            <FieldError error={show("scope")} />
          </div>
        ) : null}
        {form.kind === "roles" ? (
          <div className="admin__field">
            <label htmlFor="rv-roles">{k("review.scopeRoles", "Roles")}</label>
            <MultiSelect inputId="rv-roles" value={form.roles} options={roles} optionGroupLabel="label" optionGroupChildren="items" onChange={(e) => set({ roles: e.value })}
              display="chip" filter className={show("scope") ? "p-invalid" : ""} />
            <FieldError error={show("scope")} />
            <BaseRolesCheck checked={base} onChange={setBase} id="rv-base" />
          </div>
        ) : null}
        {preview && scopeReady ? (
          <p className="am-panel__note" aria-live="polite">
            <i className="pi pi-users" aria-hidden="true" />
            {k("review.willReview", "{{count}} active users will be reviewed", { count: preview.users })}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
};

ReviewStartPanel.propTypes = { visible: PropTypes.bool, directory: PropTypes.object, onHide: PropTypes.func.isRequired, onStarted: PropTypes.func.isRequired };

export default ReviewStartPanel;
