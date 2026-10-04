import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";

const isoDay = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null);
const addDays = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Number(n || 0));
  return d;
};

/**
 * Log (or change) a sales activity: type, subject, when, duration, contact, location, outcome, notes and the next
 * step with its date. The next step becomes a follow-up task in the account executive's My Work.
 */
const ActivityForm = ({ visible, options, activity, onSave, onHide }) => {
  const { t } = useTranslation();
  const blank = useMemo(() => ({ activityType: null, subject: "", activityAt: new Date(), durationMinutes: null, contactPerson: "", location: "", outcome: null, notes: "",
    nextStep: "", nextStepDate: null }), []);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setForm(activity ? {
      activityType: activity.activityType, subject: activity.subject || "", activityAt: new Date(activity.activityAt), durationMinutes: activity.durationMinutes ?? null,
      contactPerson: activity.contactPerson || "", location: activity.location || "", outcome: activity.outcome || null, notes: activity.notes || "", nextStep: activity.nextStep || "",
      nextStepDate: activity.nextStepDate ? new Date(`${activity.nextStepDate}T00:00:00`) : null,
    } : blank);
  }, [visible, activity, blank]);

  const types = options?.types || [];
  const type = types.find((x) => x.code === form.activityType);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const chooseType = (code) => {
    const tp = types.find((x) => x.code === code);
    setForm((f) => ({ ...f, activityType: code, subject: f.subject || tp?.name || "",
      nextStepDate: f.nextStepDate || (tp?.followUpDays ? addDays(tp.followUpDays) : null) }));
  };
  const valid = form.activityType && form.activityAt && (!form.nextStepDate || form.nextStep.trim()) && (!options?.nextStepRequired || (form.nextStep.trim() && form.nextStepDate));

  const save = async () => {
    setSaving(true);
    try {
      const nextStep = form.nextStep.trim();
      await onSave({ activityType: form.activityType, subject: form.subject.trim() || type?.name, activityAt: form.activityAt.toISOString(), durationMinutes: form.durationMinutes ?? null,
        contactPerson: form.contactPerson.trim() || null, location: form.location.trim() || null, outcome: form.outcome || null, notes: form.notes.trim() || null,
        nextStep: nextStep || null, nextStepDate: nextStep ? isoDay(form.nextStepDate) : null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog className="pe-dialog" header={activity ? t("salesActivities.editActivity") : t("salesActivities.logActivity")} visible={visible} style={{ width: "min(760px, 96vw)" }} onHide={onHide}
      footer={<div><Button label={t("salesActivities.cancel")} text onClick={onHide} /><Button label={t("salesActivities.save")} icon="pi pi-save" disabled={!valid} loading={saving} onClick={save} /></div>}>
      <div className="grid">
        <div className="col-12 md:col-6">
          <label htmlFor="sa-type" className="block mb-1">{t("salesActivities.type")} *</label>
          <Dropdown inputId="sa-type" value={form.activityType} options={types.map((x) => ({ label: x.name, value: x.code }))} onChange={(e) => chooseType(e.value)} className="w-full"
            placeholder={t("salesActivities.chooseType")} />
        </div>
        <div className="col-12 md:col-6">
          <label htmlFor="sa-when" className="block mb-1">{t("salesActivities.when")} *</label>
          <Calendar inputId="sa-when" value={form.activityAt} onChange={(e) => set("activityAt", e.value)} showTime hourFormat="24" showIcon maxDate={new Date()} className="w-full" />
        </div>
        <div className="col-12 md:col-8">
          <label htmlFor="sa-subject" className="block mb-1">{t("salesActivities.subject")}</label>
          <InputText id="sa-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} maxLength={200} className="w-full" />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="sa-duration" className="block mb-1">{t("salesActivities.duration")}</label>
          <InputNumber inputId="sa-duration" value={form.durationMinutes} onValueChange={(e) => set("durationMinutes", e.value)} min={0} max={1440} suffix=" min" className="w-full" />
        </div>
        <div className="col-12 md:col-6">
          <label htmlFor="sa-contact" className="block mb-1">{t("salesActivities.contactPerson")}</label>
          <InputText id="sa-contact" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} maxLength={200} className="w-full" />
        </div>
        <div className="col-12 md:col-6">
          <label htmlFor="sa-location" className="block mb-1">{t("salesActivities.location")}</label>
          <InputText id="sa-location" value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={200} className="w-full" />
        </div>
        <div className="col-12">
          <label htmlFor="sa-outcome" className="block mb-1">{t("salesActivities.outcome")}</label>
          <Dropdown inputId="sa-outcome" value={form.outcome} options={(options?.outcomes || []).map((x) => ({ label: x.name, value: x.code }))} onChange={(e) => set("outcome", e.value)}
            showClear className="w-full" placeholder={t("salesActivities.chooseOutcome")} />
        </div>
        <div className="col-12">
          <label htmlFor="sa-notes" className="block mb-1">{t("salesActivities.notes")}</label>
          <InputTextarea id="sa-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={4000} className="w-full" />
        </div>
        <div className="col-12 md:col-8">
          <label htmlFor="sa-next" className="block mb-1">{t("salesActivities.nextStep")}{options?.nextStepRequired ? " *" : ""}</label>
          <InputText id="sa-next" value={form.nextStep} onChange={(e) => set("nextStep", e.target.value)} maxLength={200} className="w-full" placeholder={t("salesActivities.nextStepPlaceholder")} />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="sa-next-date" className="block mb-1">{t("salesActivities.nextStepDate")}{options?.nextStepRequired ? " *" : ""}</label>
          <Calendar inputId="sa-next-date" value={form.nextStepDate} onChange={(e) => set("nextStepDate", e.value)} showIcon minDate={addDays(0)} className="w-full" />
        </div>
        {form.nextStep.trim() && form.nextStepDate && <div className="col-12"><small>{t("salesActivities.followUpNote")}</small></div>}
      </div>
    </Dialog>
  );
};

ActivityForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  options: PropTypes.object,
  activity: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default ActivityForm;
