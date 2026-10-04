import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { AutoComplete } from "primereact/autocomplete";
import myWorkService, { errorMessage } from "../../services/myWorkService";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { PRIORITIES, REMINDER_OPTIONS, dateOfTime, taskPayload, timeOf, validateTask } from "./logic";

const RECORD_TYPES = ["client", "policy", "quote", "claim", "renewal", "endorsement", "placement", "broker_slip", "lead", "collection"];

const blank = (today) => ({ title: "", notes: "", dueDate: today, dueTime: null, priority: "normal", reminderMinutes: 60, assignedTo: "", entity: "", entityId: "", entityRef: "" });

/** Create or change a task: what, when (date and time), priority, reminder, for whom (managers) and the related record. */
const TaskDialog = ({ visible, task, today, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(blank(today));
  const [errors, setErrors] = useState({});
  const [people, setPeople] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (change) => setForm((f) => ({ ...f, ...change }));

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setForm(task ? {
      title: task.title, notes: task.notes || "", dueDate: task.dueDate, dueTime: task.dueTime, priority: task.priority, reminderMinutes: task.reminderMinutes,
      assignedTo: task.assignedTo, entity: task.entity || "", entityId: task.entityId || "", entityRef: task.entityRef || "",
    } : blank(today));
    myWorkService.assignees().then(setPeople).catch(() => setPeople([]));
  }, [visible, task, today]);

  const search = async (e) => {
    if (!form.entity) return setSuggestions([]);
    try {
      setSuggestions(await myWorkService.records(form.entity, e.query));
    } catch {
      setSuggestions([]);
    }
    return null;
  };

  const save = async () => {
    const problems = validateTask(form);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    try {
      const body = taskPayload(form);
      if (task && (body.assignedTo === task.assignedTo || !task.canReassign)) delete body.assignedTo;
      if (task?.automatic) { delete body.entity; delete body.entityId; }
      const saved = task ? await myWorkService.updateTask(task.id, body) : await myWorkService.createTask(body);
      notifySuccess(task ? t("myWork.task.updated", "Task updated") : t("myWork.task.created", "Task created"));
      onSaved(saved);
    } catch (e) {
      notifyError(errorMessage(e, t("myWork.task.saveFailed", "The task could not be saved")));
    } finally {
      setSaving(false);
    }
  };

  const reminderLabel = (m) => {
    if (m === null) return t("myWork.reminder.none", "No reminder");
    if (m === 0) return t("myWork.reminder.atTime", "At the due time");
    if (m < 60) return t("myWork.reminder.minutes", { count: m, defaultValue: "{{count}} minutes before" });
    if (m < 1440) return t("myWork.reminder.hours", { count: m / 60, defaultValue: "{{count}} hour(s) before" });
    return t("myWork.reminder.days", { count: m / 1440, defaultValue: "{{count}} day(s) before" });
  };
  const err = (k) => (errors[k] ? <small className="p-error">{t(errors[k], "Required")}</small> : null);
  const canAssign = people.length > 1 && (!task || task.canReassign);
  const readOnlyRecord = task?.automatic;

  return (
    <Dialog header={task ? t("myWork.task.edit", "Edit task") : t("myWork.task.new", "New task")} visible={visible} onHide={onHide} style={{ width: "40rem" }}
      breakpoints={{ "768px": "95vw" }} className="mw-task-dialog"
      footer={(
        <div>
          <Button label={t("common.cancel", "Cancel")} text onClick={onHide} />
          <Button label={t("common.save", "Save")} icon="pi pi-check" onClick={save} loading={saving} />
        </div>
      )}>
      <div className="mw-form mw-form--grid">
        <div className="mw-form__full">
          <label htmlFor="mw-title">{t("myWork.task.title", "Task")} *</label>
          <InputText id="mw-title" value={form.title} onChange={(e) => set({ title: e.target.value })} className={errors.title ? "p-invalid" : ""} maxLength={200} autoFocus />
          {err("title")}
        </div>
        <div>
          <label htmlFor="mw-due">{t("myWork.task.dueDate", "Due date")} *</label>
          <Calendar inputId="mw-due" value={toDate(form.dueDate)} onChange={(e) => set({ dueDate: toIsoDate(e.value) })} dateFormat={calendarDateFormat()} showIcon
            className={errors.dueDate ? "p-invalid" : ""} />
          {err("dueDate")}
        </div>
        <div>
          <label htmlFor="mw-time">{t("myWork.task.dueTime", "Time")}</label>
          <Calendar inputId="mw-time" value={dateOfTime(form.dueTime)} onChange={(e) => set({ dueTime: timeOf(e.value) })} timeOnly hourFormat="24" showIcon icon="pi pi-clock"
            placeholder={t("myWork.task.allDay", "All day")} />
          {err("dueTime")}
        </div>
        <div>
          <label htmlFor="mw-priority">{t("myWork.col.priority", "Priority")}</label>
          <Dropdown inputId="mw-priority" value={form.priority} onChange={(e) => set({ priority: e.value })}
            options={PRIORITIES.map((p) => ({ label: t(`myWork.priority.${p}`, p), value: p }))} />
        </div>
        <div>
          <label htmlFor="mw-reminder">{t("myWork.task.reminder", "Reminder")}</label>
          <Dropdown inputId="mw-reminder" value={form.reminderMinutes} onChange={(e) => set({ reminderMinutes: e.value })}
            options={REMINDER_OPTIONS.map((m) => ({ label: reminderLabel(m), value: m }))} />
        </div>
        {canAssign && (
          <div className="mw-form__full">
            <label htmlFor="mw-assignee">{t("myWork.task.assignedTo", "Assigned to")}</label>
            <Dropdown inputId="mw-assignee" value={form.assignedTo || people.find((u) => u.self)?.id} onChange={(e) => set({ assignedTo: e.value })} filter
              options={people.map((u) => ({ label: u.self ? `${u.displayName} (${t("myWork.me", "me")})` : u.displayName, value: u.id }))} />
          </div>
        )}
        <div>
          <label htmlFor="mw-rtype">{t("myWork.task.recordType", "Related record")}</label>
          <Dropdown inputId="mw-rtype" value={form.entity} disabled={readOnlyRecord} showClear onChange={(e) => set({ entity: e.value || "", entityId: "", entityRef: "" })}
            options={RECORD_TYPES.map((r) => ({ label: t(`myWork.record.${r}`, r), value: r }))} placeholder={t("myWork.task.none", "None")} />
        </div>
        <div>
          <label htmlFor="mw-record">{t("myWork.task.record", "Record")}</label>
          <AutoComplete inputId="mw-record" value={form.entityRef} suggestions={suggestions} completeMethod={search} disabled={!form.entity || readOnlyRecord}
            field="ref" itemTemplate={(r) => <span>{r.ref}<span className="bv-cell-sub">{r.label}</span></span>}
            onChange={(e) => (typeof e.value === "string" ? set({ entityRef: e.value, entityId: "" }) : set({ entityRef: e.value?.ref || "", entityId: e.value?.id || "" }))}
            placeholder={t("myWork.task.searchRecord", "Number or name")} className={errors.entityId ? "p-invalid" : ""} />
          {err("entityId")}
        </div>
        <div className="mw-form__full">
          <label htmlFor="mw-notes">{t("myWork.task.notes", "Notes")}</label>
          <InputTextarea id="mw-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} autoResize maxLength={4000} />
        </div>
      </div>
    </Dialog>
  );
};

TaskDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  task: PropTypes.object,
  today: PropTypes.string.isRequired,
  onHide: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default TaskDialog;
