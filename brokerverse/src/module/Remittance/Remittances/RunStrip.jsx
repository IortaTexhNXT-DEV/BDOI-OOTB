import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import ConfigStatus from "../../../components/ConfigStatus";
import { AutomationChip } from "../Runs";
import { REMITTANCE_ROUTES } from "../shared";

/**
 * The run strip of Remittances, chips only: the last run with its counts (or "Last run failed" in danger), the next
 * run and Automation On / Off. The last-run chip opens the run history of its schedule; while Automation is off a
 * user who prepares remittances gets the Schedules link.
 */
const RunStrip = ({ strip, schedules, canWrite, onRunHistory }) => {
  const { t } = useTranslation();
  // the strip keeps its line while the summary loads, so the cards and the table below do not move
  if (!strip) return <div className="rm-strip" aria-hidden="true" />;
  const { lastRun, nextRun, automation } = strip;
  const schedule = lastRun ? (schedules || []).find((s) => s.code === lastRun.scheduleCode) || null : null;
  const openHistory = schedule ? () => onRunHistory(schedule) : undefined;
  const counts = lastRun?.counts || {};
  return (
    <div className="rm-strip" aria-label={t("remittance.list.strip.label")}>
      {lastRun && lastRun.failed ? (
        <ConfigStatus state="off" tone="danger" feature={t("remittance.list.strip.lastFailed")} label={lastRun.text} onClick={openHistory} />
      ) : null}
      {lastRun && !lastRun.failed ? (
        <ConfigStatus state="ready" feature={t("remittance.list.strip.lastRun")} onClick={openHistory}
          label={`${lastRun.text} · ${t("remittance.schedules.lastCounts", { created: counts.created ?? 0, held: counts.held ?? 0, exceptions: counts.exceptions ?? 0 })}`} />
      ) : null}
      {nextRun ? <ConfigStatus state="ready" feature={t("remittance.list.strip.nextRun")} label={nextRun.text} /> : null}
      {automation ? <AutomationChip automation={{ jobEnabled: !!automation.on }} /> : null}
      {automation && !automation.on && canWrite ? <Link to={REMITTANCE_ROUTES.setup("schedules")} className="rm-strip__link">{t("remittance.list.strip.schedules")}</Link> : null}
    </div>
  );
};

RunStrip.propTypes = {
  /** runStrip of GET /remittance/summary: { lastRun, nextRun, automation } */
  strip: PropTypes.shape({ lastRun: PropTypes.object, nextRun: PropTypes.object, automation: PropTypes.object }),
  /** the schedules (GET /remittance/schedules), to open the run history of the last run's schedule */
  schedules: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), code: PropTypes.string })),
  canWrite: PropTypes.bool,
  onRunHistory: PropTypes.func.isRequired,
};

RunStrip.defaultProps = { strip: null, schedules: [], canWrite: false };

export default RunStrip;
