import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { InputTextarea } from "primereact/inputtextarea";
import ConfirmDialog from "../../../components/ConfirmDialog";
import DateField from "../../../components/DateField";
import FieldError from "../../../components/FieldError";
import { businessDate } from "../../../utility/dateFormat";
import talkbotService from "../../../services/talkbotService";

/** Outcomes a user may record by hand (any but Not called). */
export const MANUAL_OUTCOMES = ["willing", "not-willing", "already-renewed", "call-back", "wrong-contact", "uncontacted", "missed-call"];

/**
 * Record outcome (FR-TBT-014): set the Talkbot outcome of an account by hand (the client called back, or the recording
 * shows the result was misread) with its date and a remark; the account shows "Manual" and the renewal timeline the call.
 */
const RecordOutcomeDialog = ({ visible, onHide, listId, line, onDone }) => {
  const { t } = useTranslation();
  const [date, setDate] = useState("");
  const [remark, setRemark] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDate(businessDate());
    setRemark("");
    setTried(false);
  }, [visible]);

  const remarkError = tried && !remark.trim() ? t("talkbot.outcome.remarkRequired") : null;
  const save = async (outcome) => {
    const r = await talkbotService.recordOutcome(listId, line.id, { outcome, date, remark: remark.trim() });
    onDone(r.message);
  };
  return (
    <ConfirmDialog visible={visible} onHide={onHide} title={t("talkbot.outcome.title")} severity="neutral"
      message={line ? t("talkbot.outcome.message", { policy: line.policyNumber, client: line.clientName }) : ""}
      facts={line ? [{ label: t("talkbot.col.outcome"), value: t(`talkbot.outcomes.${line.outcome}`, line.outcomeLabel) }] : []}
      input={{ type: "select", label: t("talkbot.outcome.outcome"), required: true, defaultValue: line?.outcome === "not-called" ? null : line?.outcome,
        options: MANUAL_OUTCOMES.map((o) => ({ label: t(`talkbot.outcomes.${o}`), value: o })) }}
      beforeConfirm={() => { setTried(true); return !!remark.trim() && !!date; }}
      confirmLabel={t("talkbot.outcome.save")} onConfirm={save}>
      <div className="grid">
        <div className="col-12 md:col-5">
          <label htmlFor="tb-outcome-date" className="talkbot-label">{t("talkbot.outcome.date")} *</label>
          <DateField id="tb-outcome-date" value={date} max={businessDate()} onChange={(e) => setDate(e.target.value)} invalid={tried && !date} />
        </div>
        <div className="col-12">
          <label htmlFor="tb-outcome-remark" className="talkbot-label">{t("talkbot.outcome.remark")} *</label>
          <InputTextarea id="tb-outcome-remark" value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} maxLength={500} autoResize className={`w-full ${remarkError ? "p-invalid" : ""}`} />
          <FieldError error={remarkError} />
        </div>
      </div>
    </ConfirmDialog>
  );
};

RecordOutcomeDialog.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  listId: PropTypes.string,
  line: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), policyNumber: PropTypes.string, clientName: PropTypes.string,
    outcome: PropTypes.string, outcomeLabel: PropTypes.string }),
  /** (message) after the outcome is saved */
  onDone: PropTypes.func.isRequired,
};
RecordOutcomeDialog.defaultProps = { visible: false, listId: null, line: null };

export default RecordOutcomeDialog;
