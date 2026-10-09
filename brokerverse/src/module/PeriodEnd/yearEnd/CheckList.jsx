import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { SETTINGS_PATH, configurePath, mayConfigure } from "../../../components/ConfigStatus";
import { canOpen } from "../../../utils/canOpen";
import { StatusTag, money } from "../common";

const SHOWN_PERIODS = 6;
const statusWord = (t, s) => t(`periodEnd.status.${s}`, { defaultValue: String(s).replace(/[_-]/g, " ") });
const account = (a) => (a ? [a.code, a.name].filter(Boolean).join(" ") : "-");

/** Name of a check in business words (the server's English label when the screen does not know the check). */
export const checkLabel = (t, c) => {
  const soft = c.code === "periods_closed" && c.data?.required === "soft_closed" ? "Soft" : "";
  return t(`yearEndClose.check.${c.code}.label${soft}`, { defaultValue: c.label });
};

/** What a check found, from its figures (the server's message for a check stored before the figures existed). */
export const checkResult = (t, c) => {
  const d = c.data;
  if (!d) return c.status === "passed" ? "" : c.message;
  switch (c.code) {
    case "periods_closed": {
      const count = t("yearEndClose.check.periods_closed.count", { closed: d.closed, total: d.total });
      if (!d.open?.length) return count;
      const list = d.open.slice(0, SHOWN_PERIODS).map((p) => `${p.period} (${statusWord(t, p.status)})`).join(", ");
      const more = d.open.length > SHOWN_PERIODS ? ` ${t("yearEndClose.more", { count: d.open.length - SHOWN_PERIODS })}` : "";
      return `${count}; ${t("yearEndClose.check.periods_closed.open", { list })}${more}`;
    }
    case "unposted_journals":
      return d.count ? t("yearEndClose.check.unposted_journals.count", { count: d.count }) : t("yearEndClose.none");
    case "suspense_balance":
      if (c.status === "not-applicable") return t("yearEndClose.check.suspense_balance.notSet");
      return `${account(d.account)}: ${d.balance ? money(d.balance) : t("yearEndClose.nil")}`;
    case "trial_balance": {
      const sides = t("yearEndClose.check.trial_balance.result", { debit: money(d.debit), credit: money(d.credit) });
      return d.difference ? `${sides}; ${t("yearEndClose.check.trial_balance.difference", { amount: money(d.difference) })}` : sides;
    }
    case "closing_accounts":
      return c.status === "failed"
        ? t("yearEndClose.check.closing_accounts.failed")
        : t("yearEndClose.check.closing_accounts.result", { currentYearPl: account(d.currentYearPl), retainedEarnings: account(d.retainedEarnings) });
    case "previous_year":
      if (c.status === "not-applicable") return t("yearEndClose.check.previous_year.first");
      return t("yearEndClose.check.previous_year.result", { fiscalYear: d.fiscalYear, status: statusWord(t, d.status) });
    case "adjustment_period":
      return d.status ? `${d.period}: ${statusWord(t, d.status)}` : t("yearEndClose.check.adjustment_period.missing", { period: d.period });
    case "adjustments_posted":
      return d.count ? t("yearEndClose.check.adjustments_posted.count", { count: d.count }) : t("yearEndClose.check.adjustments_posted.none");
    default:
      return c.message;
  }
};

const LINKS = {
  periods_closed: { to: "/accounts/period-end/periods", label: "yearEndClose.link.periods" },
  adjustment_period: { to: "/accounts/period-end/periods", label: "yearEndClose.link.periods" },
  unposted_journals: { to: "/accounts/journalvoucher", label: "yearEndClose.link.journals" },
  suspense_balance: { to: "/agent/accounting/query", label: "yearEndClose.link.accountingQuery" },
  trial_balance: { to: "/accounts/period-end/statements", label: "yearEndClose.link.statements" },
};

/** Where to resolve a failed check: a screen the user may open, the configuration (administrators), another year. */
const Resolve = ({ check, onOpenYear }) => {
  const { t } = useTranslation();
  if (check.status !== "failed") return null;
  if (check.code === "previous_year" && check.data?.fiscalYear) {
    return <Button type="button" link className="ye-check__link" label={t("yearEndClose.link.openYear", { fiscalYear: check.data.fiscalYear })} onClick={() => onOpenYear(check.data.fiscalYear)} />;
  }
  if (check.code === "closing_accounts") {
    const path = configurePath(SETTINGS_PATH, "accounting");
    return mayConfigure(path) ? <Link className="ye-check__link" to={path}>{t("yearEndClose.link.configure")}</Link> : null;
  }
  const link = LINKS[check.code];
  return link && canOpen(link.to) ? <Link className="ye-check__link" to={link.to}>{t(link.label)}</Link> : null;
};

const ICONS = { passed: "pi pi-check-circle", failed: "pi pi-times-circle", "not-applicable": "pi pi-minus-circle" };

/** Checks of a step: state icon, check, what was found, status chip and where to resolve a failure. */
const CheckList = ({ checks, onOpenYear }) => {
  const { t } = useTranslation();
  return (
    <ul className="ye-checks">
      {checks.map((c) => (
        <li key={c.code} className={`ye-check ye-check--${c.status}`}>
          <i className={`ye-check__icon ${ICONS[c.status] || "pi pi-circle"}`} aria-hidden="true" />
          <div className="ye-check__main">
            <div className="ye-check__label">{checkLabel(t, c)}</div>
            <div className="ye-check__result">{checkResult(t, c)}</div>
          </div>
          <div className="ye-check__side">
            <StatusTag status={c.status} />
            <Resolve check={c} onOpenYear={onOpenYear} />
          </div>
        </li>
      ))}
    </ul>
  );
};

CheckList.propTypes = {
  checks: PropTypes.arrayOf(PropTypes.shape({ code: PropTypes.string.isRequired, status: PropTypes.string.isRequired, data: PropTypes.object })).isRequired,
  onOpenYear: PropTypes.func.isRequired,
};

export default CheckList;
