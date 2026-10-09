import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import myWorkService, { errorMessage } from "../../services/myWorkService";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";

const PRIORITIES = ["low", "normal", "high", "urgent"];

/**
 * New My Work task on a record (a renewal, a client, a claim...): the title comes from the action chosen on the screen,
 * the user sets the due date, priority, the person (themselves or someone in their team) and a note.
 */
const RecordTaskDialog = ({ visible, entity, entityId, reference, title, dueDate, priority, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ title: "", dueDate: "", priority: "normal", assignedTo: "", notes: "" });
  const [people, setPeople] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (change) => setForm((f) => ({ ...f, ...change }));

  useEffect(() => {
    if (!visible) return;
    setError("");
    setForm({ title: title || "", dueDate: dueDate || toIsoDate(new Date()), priority: priority || "normal", assignedTo: "", notes: "" });
    myWorkService.assignees().then(setPeople).catch(() => setPeople([]));
  }, [visible, title, dueDate, priority]);

  const save = async () => {
    if (form.title.trim().length < 2 || !form.dueDate) {
      setError(t("recordPage.task.required"));
      return;
    }
    setSaving(true);
    try {
      const saved = await myWorkService.createTask({
        title: form.title.trim(), dueDate: form.dueDate, priority: form.priority, notes: form.notes.trim() || null, entity, entityId,
        ...(form.assignedTo ? { assignedTo: form.assignedTo } : {}),
      });
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e, t("recordPage.task.failed")));
    } finally {
      setSaving(false);
    }
  };

  const self = people.find((u) => u.self);
  return (
    <Dialog header={t("recordPage.task.header")} visible={visible} onHide={onHide} style={{ width: "36rem" }} breakpoints={{ "768px": "95vw" }}
      footer={(
        <div>
          <Button label={t("common.cancel", "Cancel")} text onClick={onHide} />
          <Button label={t("recordPage.task.create")} icon="pi pi-check" onClick={save} loading={saving} />
        </div>
      )}>
      <div className="grid">
        {reference ? (
          <div className="col-12">
            <label>{t("recordPage.task.record")}</label>
            <div className="bv-task-record">{reference}</div>
          </div>
        ) : null}
        <div className="col-12">
          <label htmlFor="rt-title">{t("recordPage.task.title")} *</label>
          <InputText id="rt-title" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} className="w-full" />
        </div>
        <div className="col-12 md:col-6">
          <label htmlFor="rt-due">{t("recordPage.task.dueDate")} *</label>
          <Calendar inputId="rt-due" value={toDate(form.dueDate)} onChange={(e) => set({ dueDate: toIsoDate(e.value) })} dateFormat={calendarDateFormat()} showIcon className="w-full" />
        </div>
        <div className="col-12 md:col-6">
          <label htmlFor="rt-priority">{t("recordPage.task.priority")}</label>
          <Dropdown inputId="rt-priority" value={form.priority} onChange={(e) => set({ priority: e.value })} className="w-full"
            options={PRIORITIES.map((p) => ({ label: t(`recordPage.priority.${p}`), value: p }))} />
        </div>
        {people.length > 1 ? (
          <div className="col-12">
            <label htmlFor="rt-assignee">{t("recordPage.task.assignTo")}</label>
            <Dropdown inputId="rt-assignee" value={form.assignedTo || self?.id} onChange={(e) => set({ assignedTo: e.value })} filter className="w-full"
              options={people.map((u) => ({ label: u.self ? t("recordPage.task.me", { name: u.displayName }) : u.displayName, value: u.id }))} />
          </div>
        ) : null}
        <div className="col-12">
          <label htmlFor="rt-notes">{t("recordPage.task.notes")}</label>
          <InputTextarea id="rt-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} autoResize maxLength={4000} className="w-full" />
        </div>
        {error ? <div className="col-12"><small className="p-error">{error}</small></div> : null}
      </div>
    </Dialog>
  );
};

RecordTaskDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  entity: PropTypes.string.isRequired,
  entityId: PropTypes.string,
  reference: PropTypes.node,
  title: PropTypes.string,
  dueDate: PropTypes.string,
  priority: PropTypes.string,
  onHide: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
RecordTaskDialog.defaultProps = { entityId: null, reference: null, title: "", dueDate: "", priority: "normal" };

export default RecordTaskDialog;
