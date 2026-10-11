import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import StatusChip from "../../../components/StatusChip";
import { formatDate } from "../../../utility/dateFormat";

export const TALKBOT_OUTCOMES = ["willing", "not-willing", "already-renewed", "call-back", "wrong-contact", "uncontacted", "missed-call", "not-called"];
const SEVERITY = { willing: "success", "not-willing": "danger", "already-renewed": "secondary", "call-back": "warning", "wrong-contact": "danger",
  uncontacted: "info", "missed-call": "info", "not-called": "secondary" };

/**
 * The latest Talkbot outcome of a renewal (FR-TBT-023): the outcome, its call list and date, the callback date of a
 * Call back, or the number of calls of a Missed call; "-" without any call list.
 */
export const TalkbotCell = ({ talkbot }) => {
  const { t } = useTranslation();
  if (!talkbot) return "-";
  let note = [talkbot.listNumber, talkbot.outcomeDate ? formatDate(talkbot.outcomeDate) : null].filter(Boolean).join(" · ");
  if (talkbot.outcome === "call-back" && talkbot.callbackDate) note = t("talkbot.callBackOn", { date: formatDate(talkbot.callbackDate) });
  if (talkbot.outcome === "missed-call") note = t("talkbot.callsCount", { count: talkbot.attempts || 0 });
  return (
    <span className="bv-cell-stack">
      <StatusChip code={talkbot.outcome} label={`${t(`talkbot.outcomes.${talkbot.outcome}`, talkbot.label)}${talkbot.manual ? ` (${t("talkbot.manual")})` : ""}`}
        severity={SEVERITY[talkbot.outcome] || "info"} />
      {note ? <small>{note}</small> : null}
    </span>
  );
};
TalkbotCell.propTypes = {
  talkbot: PropTypes.shape({ outcome: PropTypes.string, label: PropTypes.string, listNumber: PropTypes.string, outcomeDate: PropTypes.string,
    callbackDate: PropTypes.string, attempts: PropTypes.number, manual: PropTypes.bool }),
};
TalkbotCell.defaultProps = { talkbot: null };

export default TalkbotCell;
