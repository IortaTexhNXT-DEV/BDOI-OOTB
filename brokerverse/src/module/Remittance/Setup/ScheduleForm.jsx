import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import DateField from "../../../components/DateField";
import FieldError from "../../../components/FieldError";
import { remittanceService } from "../../../services/remittanceService";

export const WEEKLY_WINDOW = "Previous Monday to Friday";
export const CUT_OFF_WINDOW = "Cut-off days";
const FREQUENCIES = ["Weekly", "Monthly"];
const GROUP_BY = ["Insurer", "Insurer and product line"];
// the run times offered: every quarter of an hour
const RUN_TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const CUT_OFF_DAYS = Array.from({ length: 31 }, (_, i) => i);

const EMPTY = { name: "", allInsurers: true, insurers: [], frequency: "Weekly", nextRun: "", runTime: "06:15", paymentWindow: WEEKLY_WINDOW, cutOffDays: 0, groupBy: "Insurer and product line" };

/** The schedule's fields as the form edits them. */
export const formOf = (s) => (s ? {
  name: s.name || "", allInsurers: !!s.allInsurers, insurers: s.insurers || [], frequency: s.frequency || "Weekly", nextRun: s.nextRun || "", runTime: s.runTime || "06:15",
  paymentWindow: s.paymentWindow || CUT_OFF_WINDOW, cutOffDays: s.cutOffDays ?? 0, groupBy: s.groupBy || GROUP_BY[0],
} : { ...EMPTY });

/**
 * What the screen refuses before saving, by field: MSG-RMT-007 under Frequency when the Monday to Friday window is
 * chosen without a weekly frequency (the server checks the same), and the required fields.
 */
export const formProblems = (f, t) => {
  const out = {};
  if (!String(f.name || "").trim()) out.name = t("remittance.schedules.form.required");
  if (!f.allInsurers && !(f.insurers || []).length) out.insurers = t("remittance.schedules.form.chooseInsurers");
  if (f.paymentWindow === WEEKLY_WINDOW && f.frequency !== "Weekly") out.frequency = t("remittance.schedules.msgRmt007");
  else if (f.paymentWindow === WEEKLY_WINDOW && f.nextRun && new Date(`${f.nextRun}T00:00:00Z`).getUTCDay() !== 1) out.nextRun = t("remittance.schedules.form.monday");
  return out;
};

const payloadOf = (f) => ({
  name: f.name.trim(), kind: "Remittance run", allInsurers: f.allInsurers, insurers: f.allInsurers ? [] : f.insurers, frequency: f.frequency, nextRun: f.nextRun || null,
  runTime: f.runTime, paymentWindow: f.paymentWindow, cutOffDays: f.paymentWindow === CUT_OFF_WINDOW ? f.cutOffDays : 0, groupBy: f.groupBy,
});

/**
 * New schedule / Edit (side panel): every field is a list, the verb is Save schedule (Create schedule for a new one).
 * The server's field errors (MSG-RMT-007 under Frequency) are shown under their fields.
 */
const ScheduleForm = ({ visible, onHide, schedule, insurers, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(formOf(schedule));
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(formOf(schedule));
    setTried(false);
    setServerErrors({});
    setError(null);
  }, [visible, schedule]);

  const local = useMemo(() => formProblems(form, t), [form, t]);
  // MSG-RMT-007 shows at once; the other checks once the user tried to save
  const problems = { ...(tried ? local : { frequency: local.frequency }), ...serverErrors };
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setServerErrors({});
  };

  const save = async () => {
    setTried(true);
    if (Object.keys(local).length) return;
    setBusy(true);
    setError(null);
    try {
      const saved = schedule ? await remittanceService.updateSchedule(schedule.id, payloadOf(form)) : await remittanceService.createSchedule(payloadOf(form));
      onSaved(saved);
    } catch (e) {
      const byField = Object.fromEntries((e.errors || []).filter((x) => x?.path).map((x) => [x.path, x.code === "MSG-RMT-007" ? t("remittance.schedules.msgRmt007") : x.message]));
      setServerErrors(byField);
      if (!Object.keys(byField).length) setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const options = (list, prefix) => list.map((v) => ({ value: v, label: t(`remittance.schedules.${prefix}.${v}`, { defaultValue: v }) }));
  const field = (name, label, control) => (
    <div className="rm-field">
      <label htmlFor={`rm-sch-${name}`} className="bv-field-label">{label}</label>
      {control}
      <FieldError id={`rm-sch-${name}-error`} error={problems[name] || null} />
    </div>
  );
  const invalid = (name) => (problems[name] ? " p-invalid" : "");

  const footer = (
    <>
      <Button type="button" label={t("remittance.common.cancel")} text onClick={onHide} disabled={busy} />
      <Button type="button" label={schedule ? t("remittance.schedules.form.save") : t("remittance.schedules.form.create")} onClick={save} loading={busy} />
    </>
  );

  return (
    <Dialog visible={visible} onHide={busy ? () => {} : onHide} footer={footer} modal draggable={false} resizable={false} style={{ width: "36rem" }}
      header={schedule ? t("remittance.schedules.form.editTitle", { code: schedule.code }) : t("remittance.schedules.form.newTitle")} className="rm-panel">
      <div className="rm-form">
        {field("name", t("remittance.schedules.form.name"), (
          <InputText id="rm-sch-name" value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} className={`w-full${invalid("name")}`}
            aria-describedby={problems.name ? "rm-sch-name-error" : undefined} />
        ))}
        <div className="rm-field">
          <span className="bv-field-label">{t("remittance.schedules.form.kind")}</span>
          <span className="rm-readonly">{t("remittance.schedules.kinds.Remittance run")}</span>
        </div>
        {field("insurers", t("remittance.schedules.form.insurers"), (
          <>
            <span className="rm-check">
              <Checkbox inputId="rm-sch-all" checked={form.allInsurers} onChange={(e) => set({ allInsurers: e.checked })} />
              <label htmlFor="rm-sch-all">{t("remittance.schedules.form.allInsurers")}</label>
            </span>
            {!form.allInsurers ? (
              <MultiSelect inputId="rm-sch-insurers" value={form.insurers} options={insurers} optionLabel="label" optionValue="value" filter display="chip"
                onChange={(e) => set({ insurers: e.value })} className={`w-full${invalid("insurers")}`} placeholder={t("remittance.schedules.form.chooseInsurers")} />
            ) : null}
          </>
        ))}
        {field("frequency", t("remittance.schedules.form.frequency"), (
          <Dropdown inputId="rm-sch-frequency" value={form.frequency} options={options(FREQUENCIES, "frequencies")} onChange={(e) => set({ frequency: e.value })}
            className={`w-full${invalid("frequency")}`} aria-describedby={problems.frequency ? "rm-sch-frequency-error" : undefined} />
        ))}
        {field("nextRun", t("remittance.schedules.form.nextRun"), (
          <DateField id="rm-sch-nextRun" value={form.nextRun} onChange={(e) => set({ nextRun: e.target.value })} invalid={!!problems.nextRun} />
        ))}
        {field("runTime", t("remittance.schedules.form.runTime"), (
          <Dropdown inputId="rm-sch-runTime" value={form.runTime} options={RUN_TIMES} onChange={(e) => set({ runTime: e.value })} className="w-full" filter />
        ))}
        {field("paymentWindow", t("remittance.schedules.form.paymentWindow"), (
          <Dropdown inputId="rm-sch-paymentWindow" value={form.paymentWindow} options={options([WEEKLY_WINDOW, CUT_OFF_WINDOW], "windows")}
            onChange={(e) => set({ paymentWindow: e.value })} className={`w-full${invalid("paymentWindow")}`} />
        ))}
        {form.paymentWindow === CUT_OFF_WINDOW ? field("cutOffDays", t("remittance.schedules.form.cutOffDays"), (
          <Dropdown inputId="rm-sch-cutOffDays" value={form.cutOffDays} options={CUT_OFF_DAYS} onChange={(e) => set({ cutOffDays: e.value })} className="w-full" />
        )) : null}
        {field("groupBy", t("remittance.schedules.form.groupBy"), (
          <Dropdown inputId="rm-sch-groupBy" value={form.groupBy} options={options(GROUP_BY, "groupByOptions")} onChange={(e) => set({ groupBy: e.value })} className="w-full" />
        ))}
        {error ? <p className="rm-form__error" role="alert">{error}</p> : null}
      </div>
    </Dialog>
  );
};

ScheduleForm.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  /** the schedule to change; a new schedule when left out */
  schedule: PropTypes.object,
  /** insurer options { label, value: code } */
  insurers: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, value: PropTypes.string })),
  onSaved: PropTypes.func.isRequired,
};

ScheduleForm.defaultProps = { visible: false, schedule: null, insurers: [] };

export default ScheduleForm;
