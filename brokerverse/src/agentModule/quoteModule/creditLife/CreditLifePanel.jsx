import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";

/** The Credit Life terms of a quotation: the borrower, the loan account, the term and the sum insured at the fixed rate. */
const CreditLifePanel = ({ quotation }) => {
  const { t } = useTranslation();
  const cl = quotation?.creditLife;
  if (!cl) return null;
  return (
    <DetailSection className="mt-3" title={t("creditLifeQuote.panelTitle")}>
      <KeyValueGrid columns={4} items={[
        { label: t("creditLifeQuote.loanAccountNo"), value: cl.loanAccountNo },
        { label: t("creditLifeQuote.borrowerBirthDate"), value: cl.borrowerBirthDate, type: "date" },
        { label: t("creditLifeQuote.borrowerAge"), value: cl.borrowerAge, type: "number" },
        { label: t("creditLifeQuote.accountCount"), value: cl.accountCount, type: "number" },
        { label: t("creditLifeQuote.loanTermYears"), value: cl.loanTermYears, type: "number" },
        { label: t("creditLifeQuote.sumInsured"), value: cl.sumInsured, type: "amount", currency: quotation.currency },
        { label: t("creditLifeQuote.rate"), value: cl.ratePerThousand, type: "number", decimals: 2 },
        { label: t("creditLifeQuote.premium"), value: quotation.netPremium, type: "amount", currency: quotation.currency },
      ]} />
    </DetailSection>
  );
};

CreditLifePanel.propTypes = { quotation: PropTypes.object };
CreditLifePanel.defaultProps = { quotation: null };

export default CreditLifePanel;
