import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";

/**
 * Market responses of a Request for Quotation, fitted to its card (no sideways scroll at 1366px): the insurer first
 * with its reference and status, the gross premium with net and taxes under it, rate and line, the deductibles and
 * special terms as one clamped Terms column (full text on hover), Valid until on one line and the row actions as icon
 * buttons in a narrow last column. The best offer keeps its highlight.
 */
const OffersTable = ({ offers, statusOf, money, date, canEdit, onEdit, onPrint, onAttachment }) => {
  const { t } = useTranslation();
  const dash = "-";
  const termsOf = (o) => [o.deductibles, o.terms].filter(Boolean).join(" · ") || o.declineReason || "";
  return (
    <table className="participant-table offers">
      <thead>
        <tr>
          <th>{t("placement.fields.insurer")}</th>
          <th className="num">{t("placement.fields.grossPremium")}</th>
          <th className="num">{t("placement.fields.rate")}</th>
          <th className="num">{t("placement.fields.line")}</th>
          <th>{t("placement.fields.terms")}</th>
          <th>{t("placement.fields.validUntil")}</th>
          <th className="actions-head"><span className="p-hidden-accessible">{t("common.actions", "Actions")}</span></th>
        </tr>
      </thead>
      <tbody>
        {offers.map((o) => {
          const terms = termsOf(o);
          const editLabel = o.status === "pending" ? t("placement.actions.recordResponse") : t("placement.actions.edit");
          return (
            <tr key={o.id} className={o.isBest ? "best-row" : ""}>
              <td className="insurer-cell">
                <div className="insurer-line"><strong>{o.insuranceCompanyName}</strong>{statusOf(o.status)}</div>
                <div className="muted small">{o.insurerReference || o.offerNumber || dash}</div>
              </td>
              <td className="num">
                {o.premiumTotal == null ? dash : <strong>{money(o.premiumTotal)}</strong>}
                {o.premium != null ? <div className="muted small">{`${money(o.premium)} + ${o.taxes == null ? dash : money(o.taxes)}`}</div> : null}
              </td>
              <td className="num">{o.rate == null ? dash : `${o.rate}%`}</td>
              <td className="num">{o.status === "offered" ? `${o.offeredShare}%` : dash}</td>
              <td className="terms-cell"><span className={o.deductibles || o.terms ? "clamp-2" : "clamp-2 muted"} title={terms || undefined}>{terms || dash}</span></td>
              <td className="nowrap">{date(o.validityDate)}</td>
              <td className="actions-cell">
                {canEdit ? <Button icon="pi pi-pencil" text rounded size="small" onClick={() => onEdit(o)} aria-label={editLabel} tooltip={editLabel} tooltipOptions={{ position: "top" }} /> : null}
                {o.attachmentKey ? <Button icon="pi pi-paperclip" text rounded size="small" onClick={() => onAttachment(o)} aria-label={o.attachmentName} tooltip={o.attachmentName} tooltipOptions={{ position: "top" }} /> : null}
                <Button icon="pi pi-print" text rounded size="small" onClick={() => onPrint(o)} aria-label={t("placement.actions.printSlip")} tooltip={t("placement.actions.printSlip")} tooltipOptions={{ position: "top" }} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

OffersTable.propTypes = {
  offers: PropTypes.arrayOf(PropTypes.object).isRequired,
  statusOf: PropTypes.func.isRequired,
  money: PropTypes.func.isRequired,
  date: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  onEdit: PropTypes.func,
  onPrint: PropTypes.func,
  onAttachment: PropTypes.func,
};

OffersTable.defaultProps = { canEdit: false, onEdit: () => {}, onPrint: () => {}, onAttachment: () => {} };

export default OffersTable;
