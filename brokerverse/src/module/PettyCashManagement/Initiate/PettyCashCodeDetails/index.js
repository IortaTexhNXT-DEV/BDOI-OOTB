import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import { useSelector } from "react-redux";
import usePettyCashOptions, { describe } from "../../usePettyCashOptions";
import DetailHeader from "../../../../components/DetailHeader";
import DetailSection from "../../../../components/DetailSection";
import KeyValueGrid from "../../../../components/KeyValueGrid";
import { RecordActivityLog } from "../../../../components/ActivityLog";
import { statusLabel } from "../../../../utils/statusSeverity";

// "CODE – Description" when the master knows the code
const named = (code, list) => {
  const text = code ? describe(list, code) : "";
  return [code, text && text !== code ? text : ""].filter(Boolean).join(" – ");
};

/** A petty cash fund, read only: its size and limits, where it is held and what it posts to, and its activity. */
const PettyCashCodeDetails = () => {
  const { t } = useTranslation();
  const { fund } = useSelector(({ pettyCashInitiateReducer }) => ({
    fund: pettyCashInitiateReducer?.InitiateDetails || {},
  }));
  const { currencies, branches, departments } = usePettyCashOptions();
  const navigate = useNavigate();
  const items = [
    { label: t("pettyCash.pettyCashLabel"), command: () => navigate("/accounts/pettycash/pettycashcodeinitiate") },
    { label: t("pettyCash.pettyCashCodeDetails"), to: "/accounts/pettycash/PettyCashCodeDetails" },
  ];
  const home = { label: t("pettyCash.accounts") };
  const amount = (v) => ({ value: v === "" || v === undefined ? null : v, type: "amount", currency: fund.Currency || undefined });

  return (
    <div className="pettycash__form pettycash__details">
      <button type="button" className="pettycash__title" onClick={() => navigate("/accounts/pettycash/pettycashcodeinitiate")}>
        <SvgBackArrow />
        {t("pettyCash.pettyCashCodeDetails")}
      </button>
      <BreadCrumb model={items} home={home} className="breadCrums mt-3" separatorIcon={<SvgDot color="currentColor" />} />

      <DetailHeader
        title={fund.Pettycashcode || ""}
        subtitle={fund.PettyCashdescription}
        status={fund.status ? { code: String(fund.status).toLowerCase(), label: statusLabel(fund.status) } : null}
        meta={[
          { label: t("pettyCash.pettyCashSize"), ...amount(fund.Pettycashsize) },
          { label: t("pettyCash.availableCash"), ...amount(fund.AvailableCash) },
          { label: t("pettyCash.transactionDate"), value: fund.TransactionDate },
        ]}
      />

      <DetailSection title={t("pettyCash.view.fund")}>
        <KeyValueGrid columns={3} items={[
          { label: t("pettyCash.transactionNumber"), value: fund.TransactionNumber },
          { label: t("pettyCash.transactionCode"), value: fund.TransactionCode, hidden: !fund.TransactionCode },
          { label: t("pettyCash.currency"), value: named(fund.Currency, currencies) },
          { label: t("pettyCash.maxLimit"), ...amount(fund.MaxLimit) },
          { label: t("pettyCash.minimumCashbox"), ...amount(fund.MinimumCashbox) },
          { label: t("pettyCash.branchCode"), value: named(fund.Branchcode, branches) },
          { label: t("pettyCash.departmentCode"), value: named(fund.Departmentcode, departments) },
        ]} />
      </DetailSection>

      <DetailSection title={t("pettyCash.view.accounts")}>
        <KeyValueGrid columns={4} items={[
          { label: t("pettyCash.bankCode"), value: fund.BankCode },
          { label: t("pettyCash.bankAccountCode"), value: fund.BankAccountCode },
          { label: t("pettyCash.mainAccountCode"), value: fund.MainAccountCode },
          { label: t("pettyCash.subAccountCode"), value: fund.SubAccountCode },
        ]} />
      </DetailSection>

      {fund.id ? (
        <DetailSection title={t("detailView.activity")}>
          <RecordActivityLog entity="petty_cash_fund" recordId={fund.id} />
        </DetailSection>
      ) : null}
    </div>
  );
};

export default PettyCashCodeDetails;
