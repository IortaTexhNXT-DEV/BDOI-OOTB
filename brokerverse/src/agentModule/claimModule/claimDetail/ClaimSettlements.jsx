import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { StatusChip } from "../../../components/RecordPage";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { formatDate } from "../../../utility/dateFormat";

const STATUS_SEVERITY = { pending: "warning", approved: "success", returned: "secondary" };

/** Settlements of a claim, partial and final, in order: amount asked and approved, who asked and who decided (by name). */
const ClaimSettlements = ({ settlements }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  if (!settlements?.length) return <p className="claim-journey__hint">{t("claimSettlements.none")}</p>;
  return (
    <table className="bv-detail-table">
      <thead>
        <tr>
          <th>{t("claimSettlements.seq")}</th>
          <th>{t("claimSettlements.kind")}</th>
          <th>{t("claimJourney.settlementType")}</th>
          <th className="bv-num">{t("claimSettlements.requested")}</th>
          <th className="bv-num">{t("claimSettlements.approved")}</th>
          <th>{t("claimSettlements.status")}</th>
          <th>{t("claimSettlements.requestedBy")}</th>
          <th>{t("claimSettlements.decidedBy")}</th>
        </tr>
      </thead>
      <tbody>
        {settlements.map((s) => (
          <tr key={s.id}>
            <td>{s.seq}</td>
            <td>{t(`claimSettlements.kinds.${s.kind}`)}</td>
            <td>{s.settlementType || "—"}</td>
            <td className="bv-num">{formatCurrency(s.amount)}</td>
            <td className="bv-num">{s.approvedAmount !== null && s.approvedAmount !== undefined ? formatCurrency(s.approvedAmount) : "—"}</td>
            <td><StatusChip label={t(`claimSettlements.statuses.${s.status}`)} severity={STATUS_SEVERITY[s.status] || "info"} /></td>
            <td>{s.requestedBy || "—"}</td>
            <td>{s.decidedBy ? `${s.decidedBy} · ${formatDate(s.decidedAt)}` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

ClaimSettlements.propTypes = { settlements: PropTypes.arrayOf(PropTypes.object) };
ClaimSettlements.defaultProps = { settlements: [] };

export default ClaimSettlements;
