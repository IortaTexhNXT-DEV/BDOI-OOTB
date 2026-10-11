import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import ConfigStatus from "../../../components/ConfigStatus";
import { formatInstant } from "../../../utility/dateFormat";

/** Master > Schedules, where the job is switched on (administrators). */
export const JOBS_PATH = "/master/configuration/schedules";

/** "Checked daily 06:15 (Asia/Manila) · Last check 12/10/2026 06:15 OK" from the automation block of GET /schedules. */
export const automationFacts = (a, t) => [
  a?.checkedDaily ? t("remittance.automation.checkedDaily", { time: a.checkedDaily, zone: a.timeZone }) : null,
  a?.lastCheckAt ? t("remittance.automation.lastCheck", { at: formatInstant(a.lastCheckAt), status: a.lastStatus || "" }).trim() : null,
].filter(Boolean).join(" · ");

/**
 * The Automation chip of the run strip and of Setup > Schedules: "Automation On", or "Automation Off" as a danger chip
 * while the daily job is off. The cron is never shown here (TechnicalDetails, administrators only).
 */
const AutomationChip = ({ automation }) => {
  const { t } = useTranslation();
  const on = !!automation?.jobEnabled;
  return (
    <ConfigStatus feature={t("remittance.automation.name")} state={on ? "ready" : "off"} label={on ? t("remittance.automation.on") : t("remittance.automation.off")}
      tone={on ? undefined : "danger"} to={JOBS_PATH} permission="write:schedules" />
  );
};

AutomationChip.propTypes = {
  /** { jobEnabled, checkedDaily, timeZone, lastCheckAt, lastStatus } */
  automation: PropTypes.shape({ jobEnabled: PropTypes.bool }),
};

AutomationChip.defaultProps = { automation: null };

export default AutomationChip;
