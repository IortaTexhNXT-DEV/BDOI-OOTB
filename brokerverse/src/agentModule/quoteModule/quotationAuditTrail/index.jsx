import React from "react";
import PropTypes from "prop-types";
import { useParams } from "react-router-dom";
import { AuditTimeline } from "../../../components/AuditTimeline";
import "./index.scss";

/** Audit trail tab of a quotation: its business events as a timeline, newest first, with the fields each one changed. */
const QuotationAuditTrail = ({ quotationId: propQuotationId }) => {
  const { quotationId: urlQuotationId } = useParams();
  const quotationId = propQuotationId || urlQuotationId;
  return (
    <div className="quotation-audit">
      <AuditTimeline entity="quotation" recordId={quotationId} />
    </div>
  );
};

QuotationAuditTrail.propTypes = { quotationId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };
QuotationAuditTrail.defaultProps = { quotationId: null };

export default QuotationAuditTrail;
