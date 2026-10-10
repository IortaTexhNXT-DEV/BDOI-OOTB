import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import TechnicalDetails from "../../../components/TechnicalDetails";
import { canOpen } from "../../../utils/canOpen";
import { formatDate } from "../../../utility/dateFormat";
import { TipChip } from "./AccountCell";
import EntriesTable from "./EntriesTable";
import ExamplePanel from "./ExamplePanel";

export const POSTING_RULES = "/master/finance/posting-rules";
export const APPROVALS = "/master/finance/configuration-approvals";
export const AUTHORITY_MATRIX = "/master/generals/usermanagement/authority-matrix";

/** The rule, its lines and the settings behind the facts, as finance administrators read them. */
const technicalBlocks = (e, t) => {
  if (e.fixed) return [];
  const rule = e.version
    ? [e.eventCode, `version ${e.version}`, e.effectiveFrom ? `effective ${e.effectiveFrom}` : null, e.approvedAt ? `approved ${String(e.approvedAt).slice(0, 10)}` : null,
      `rule ${e.ruleId}`, `module ${e.module}`].filter(Boolean).join(" · ")
    : `${e.eventCode} · module ${e.module}`;
  const lines = (e.lines || []).map((l) => [l.side, l.accountType, l.accountRef, l.fallbackRole ? `(fallback ${l.fallbackRole})` : null, l.amountKey,
    l.perParticipant ? "per participant" : null, l.narration ? `"${l.narration}"` : null].filter(Boolean).join("  ")).join("\n");
  const settings = (e.settings || []).map((s) => `${s.key} = ${JSON.stringify(s.value)}`).join("\n");
  return [{ label: t("accountingFlow.technical.rule"), text: rule }, lines ? { label: t("accountingFlow.technical.lines"), text: lines } : null,
    settings ? { label: t("accountingFlow.technical.settings"), text: settings } : null].filter(Boolean);
};

/** Chips of the card header: journal, change pending, new rule, mapping pending, no rule in force. */
const Chips = ({ event: e, mayApprove }) => {
  const { t } = useTranslation();
  const chips = [];
  if (e.fixed) chips.push(<TipChip key="fixed" label={t("accountingFlow.chip.fixed")} severity="secondary" tip={t("accountingFlow.chip.fixedTip")} />);
  else if (!e.version) chips.push(<TipChip key="none" label={t("accountingFlow.chip.noRule")} severity="danger" tip={t("accountingFlow.chip.noRuleTip")} />);
  else {
    const tip = e.posting === "parked" ? t("accountingFlow.chip.parkedTip") : e.posting === "pending" ? t("accountingFlow.chip.pendingTip")
      : e.alwaysPosted ? t("accountingFlow.chip.alwaysPostedTip") : null;
    chips.push(<TipChip key="journal" label={t(`accountingFlow.chip.posting.${e.posting}`)} severity={e.posting === "posted" ? "secondary" : "info"} tip={tip} />);
  }
  if (e.pending) {
    const tip = t("accountingFlow.chip.changePendingTip", { by: e.pending.requestedBy || "-", on: formatDate(e.pending.requestedAt),
      from: e.pending.effectiveFrom ? formatDate(e.pending.effectiveFrom) : "-" });
    const chip = <TipChip label={t("accountingFlow.chip.changePending")} severity="warning" tip={tip} />;
    chips.push(mayApprove ? <Link key="pending" to={APPROVALS} className="af-chip-link">{chip}</Link> : <React.Fragment key="pending">{chip}</React.Fragment>);
  }
  if (e.scheduled) chips.push(<TipChip key="scheduled" label={t("accountingFlow.chip.scheduled", { date: formatDate(e.scheduled.effectiveFrom) })} severity="info" />);
  if (e.mappingPending) chips.push(<TipChip key="mapping" label={t("accountingFlow.mapping.pending")} severity="warning" tip={t("accountingFlow.chip.mappingTip")} />);
  return <div className="af-card__chips">{chips}</div>;
};

Chips.propTypes = { event: PropTypes.object.isRequired, mayApprove: PropTypes.bool };

/** A fact of the card: label and value (definition list). */
const Fact = ({ label, children }) => (
  <div className="af-fact">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

Fact.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node };

/**
 * One business event of the accounting reference: header with its chips and actions, the facts (when, where, approval
 * before posting, approval limit, last posted), the entries table, the worked example on demand and, for finance
 * administrators, the technical details.
 */
const EventCard = ({ event: e, where, mayEditRules, mayApprove, highlighted }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [example, setExample] = useState(false);
  const screenLink = e.screen && canOpen(e.screen);
  return (
    <article id={`event-${e.eventCode}`} className={`af-card${highlighted ? " af-card--highlighted" : ""}`} aria-labelledby={`event-${e.eventCode}-title`}>
      <header className="af-card__head">
        <div className="af-card__titles">
          <h3 id={`event-${e.eventCode}-title`} className="af-card__title">{e.label}</h3>
          {e.summary ? <p className="af-card__summary">{e.summary}</p> : null}
        </div>
        <div className="af-card__side">
          <Chips event={e} mayApprove={mayApprove} />
          <div className="af-card__actions">
            {e.version ? (
              <Button type="button" label={t("accountingFlow.example.toggle")} icon="pi pi-calculator" text size="small" aria-expanded={example} onClick={() => setExample((v) => !v)} />
            ) : null}
            {mayEditRules && !e.fixed ? (
              <Button type="button" label={t("accountingFlow.openRule")} icon="pi pi-external-link" text size="small"
                onClick={() => navigate(`${POSTING_RULES}?event=${encodeURIComponent(e.eventCode)}`)} />
            ) : null}
          </div>
        </div>
      </header>
      <dl className="af-facts">
        <Fact label={t("accountingFlow.facts.when")}>{e.when}</Fact>
        <Fact label={t("accountingFlow.facts.where")}>{screenLink ? <Link to={e.screen} className="af-link">{where}</Link> : where}</Fact>
        <Fact label={t("accountingFlow.facts.approval")}>{e.approval}</Fact>
        {e.authority ? (
          <Fact label={t("accountingFlow.facts.limit")}>
            {canOpen(AUTHORITY_MATRIX) ? <Link to={AUTHORITY_MATRIX} className="af-link">{t("accountingFlow.facts.limitText", { name: e.authority.name })}</Link>
              : t("accountingFlow.facts.limitText", { name: e.authority.name })}
          </Fact>
        ) : null}
        {!e.fixed ? <Fact label={t("accountingFlow.facts.lastPosted")}>{e.lastPosted ? formatDate(e.lastPosted) : t("accountingFlow.facts.notPosted")}</Fact> : null}
      </dl>
      <EntriesTable event={e} />
      {example ? <ExamplePanel eventCode={e.eventCode} coInsurable={(e.lines || []).some((l) => l.perParticipant)} /> : null}
      <TechnicalDetails permission="write:posting-rules" blocks={technicalBlocks(e, t)} className="af-card__technical" />
    </article>
  );
};

EventCard.propTypes = {
  event: PropTypes.object.isRequired,
  /** the menu trail of the screen that triggers the event, translated */
  where: PropTypes.string,
  /** the user may change posting rules: shows Open the rule */
  mayEditRules: PropTypes.bool,
  /** the user may approve configuration changes: the pending chip opens Configuration Approvals */
  mayApprove: PropTypes.bool,
  highlighted: PropTypes.bool,
};

export default EventCard;
