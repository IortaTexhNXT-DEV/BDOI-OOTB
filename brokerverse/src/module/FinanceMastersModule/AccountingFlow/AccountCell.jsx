import React, { useRef } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { OverlayPanel } from "primereact/overlaypanel";
import StatusChip from "../../../components/StatusChip";
import { canOpen } from "../../../utils/canOpen";

/** A chip with its explanation on hover and keyboard focus (the page's tooltip reads data-pr-tooltip of .af-tip). */
export const TipChip = ({ label, severity, tip }) => (
  <span className="af-tip" data-pr-tooltip={tip || undefined} tabIndex={tip ? 0 : undefined} aria-label={tip ? `${label}: ${tip}` : undefined}>
    <StatusChip label={label} severity={severity} />
  </span>
);

TipChip.propTypes = { label: PropTypes.string.isRequired, severity: PropTypes.string, tip: PropTypes.string };

/** "Mapping pending" (provisional or outside the chart) or "Account inactive". */
export const MappingChip = ({ mapping }) => {
  const { t } = useTranslation();
  if (!mapping) return null;
  const inactive = mapping === "inactive";
  return <TipChip label={t(inactive ? "accountingFlow.mapping.inactive" : "accountingFlow.mapping.pending")} severity={inactive ? "danger" : "warning"}
    tip={t(`accountingFlow.mapping.tip.${mapping}`)} />;
};

MappingChip.propTypes = { mapping: PropTypes.string };

/** "Map the account": the screen where the account is set, for a user whose menu reaches it. */
export const MapLink = ({ to }) => {
  const { t } = useTranslation();
  if (!to || !canOpen(to)) return null;
  return <Link to={to} className="af-link">{t("accountingFlow.mapping.mapAccount")}</Link>;
};

MapLink.propTypes = { to: PropTypes.string };

const accountText = (code, name) => [code, name].filter(Boolean).join(" ");

/** The accounts of a map (payment modes, payee types, write-off reasons) in a small panel. */
const OptionsPanel = ({ options, title }) => {
  const { t } = useTranslation();
  const panel = useRef(null);
  return (
    <>
      <Button type="button" label={t("accountingFlow.account.accounts", { count: options.length })} icon="pi pi-list" text size="small" className="af-options-button"
        aria-haspopup="dialog" onClick={(e) => panel.current?.toggle(e)} />
      <OverlayPanel ref={panel} className="af-options" role="dialog" aria-label={title}>
        <div className="af-options__title">{title}</div>
        <ul className="af-options__list">
          {options.map((o) => (
            <li key={`${o.name}-${o.glCode}`}>
              <span className="af-options__name">{o.name}</span>
              <span className="af-options__account">{accountText(o.glCode, o.glName) || "-"}</span>
              <MappingChip mapping={o.mapping} />
            </li>
          ))}
        </ul>
      </OverlayPanel>
    </>
  );
};

OptionsPanel.propTypes = { options: PropTypes.arrayOf(PropTypes.object).isRequired, title: PropTypes.string.isRequired };

/**
 * The account of a journal line: code and name of the GL account, and under it where the account comes from in
 * business words; for an account decided when posting, the source in its place, with the fallback account and the
 * accounts of its map.
 */
const AccountCell = ({ account }) => {
  const { t } = useTranslation();
  const a = account || {};
  return (
    <div className="af-acct">
      {a.glCode ? (
        <div className="af-acct__main">
          <span className="af-acct__code">{a.glCode}</span>
          <span className="af-acct__name">{a.glName || ""}</span>
        </div>
      ) : (
        <div className="af-acct__main af-acct__name">{a.source}</div>
      )}
      {a.glCode && a.source ? <div className="af-acct__source">{a.source}</div> : null}
      {a.fallback?.glCode ? (
        <div className="af-acct__source">
          {t("accountingFlow.account.else", { account: accountText(a.fallback.glCode, a.fallback.glName) })}
          {" "}
          <MappingChip mapping={a.fallback.mapping} />
        </div>
      ) : null}
      {a.options?.length ? <OptionsPanel options={a.options} title={a.source} /> : null}
    </div>
  );
};

AccountCell.propTypes = { account: PropTypes.object };

export default AccountCell;
