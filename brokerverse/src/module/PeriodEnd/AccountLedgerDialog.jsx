import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import DetailDialog from "../../components/DetailDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import useStableLoad from "../../hooks/useStableLoad";
import periodEndService from "../../services/periodEndService";
import { statusLabel } from "../../utils/statusSeverity";
import { JournalDialog, JournalLink, date, money } from "./common";
import { sidedAmount } from "./statementHelpers";

const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);

/**
 * General ledger of one account for a date range, opened from an account line of a financial statement: the opening
 * balance, the postings with their journals and the running balance, and the closing balance.
 */
const AccountLedgerDialog = ({ account, from, to, onHide }) => {
  const { t } = useTranslation();
  const [journal, setJournal] = useState(null);
  const loader = useCallback(() => periodEndService.statement("gl-detail", { Account: account.accountCode, FromDate: from, ToDate: to }), [account, from, to]);
  const { data, loading, refreshing, error } = useStableLoad(loader);
  const rows = data?.rows || [];
  const postings = rows.filter((r) => r.journalNumber);
  const opening = rows.filter((r) => !r.journalNumber).reduce((s, r) => s + Number(r.openingBalance || 0), 0);
  const side = { dr: t("financialStatements.ledger.dr"), cr: t("financialStatements.ledger.cr") };
  const facts = [
    { label: t("financialStatements.ledger.account"), value: `${account.accountCode} ${account.accountName}`, span: 2 },
    { label: t("financialStatements.ledger.period"), value: `${date(from)} – ${date(to)}` },
    { label: t("financialStatements.ledger.opening"), value: data ? sidedAmount(opening, side) : null },
    { label: t("financialStatements.ledger.debits"), value: data ? money(sum(postings, "debit")) : null },
    { label: t("financialStatements.ledger.credits"), value: data ? money(sum(postings, "credit")) : null },
    { label: t("financialStatements.ledger.closing"), value: data ? sidedAmount(data.summary?.closingBalance, side) : null },
  ];
  const open = (r) => setJournal({ journalNumber: r.journalNumber, date: r.date, period: r.period, description: r.description });
  return (
    <DetailDialog visible onHide={onHide} header={t("financialStatements.ledger.title")} size="xl" className="fs-ledger">
      <KeyValueGrid columns={4} items={facts} className="mb-3" />
      {error && <div className="pe-error" role="alert">{error}</div>}
      <div className="bv-loading-host">
        <LoadingBar active={refreshing} />
        <DataTable value={postings} loading={loading} size="small" stripedRows scrollable scrollHeight="50vh"
          emptyMessage={t("financialStatements.ledger.none")}>
          <Column header={t("financialStatements.ledger.date")} body={(r) => date(r.date)} style={{ width: "7.5rem" }} />
          <Column header={t("financialStatements.ledger.journal")} body={(r) => <JournalLink journal={r} onOpen={open} />} style={{ width: "10rem" }} />
          <Column field="description" header={t("financialStatements.ledger.description")} />
          <Column header={t("financialStatements.ledger.source")} body={(r) => statusLabel(r.source)} style={{ width: "9rem" }} />
          <Column header={t("financialStatements.ledger.debit")} body={(r) => (Number(r.debit) ? money(r.debit) : "")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("financialStatements.ledger.credit")} body={(r) => (Number(r.credit) ? money(r.credit) : "")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("financialStatements.ledger.balance")} body={(r) => sidedAmount(r.runningBalance, side)} className="bv-num" headerClassName="bv-num" />
        </DataTable>
      </div>
      <JournalDialog journal={journal} onHide={() => setJournal(null)} />
    </DetailDialog>
  );
};

AccountLedgerDialog.propTypes = {
  account: PropTypes.shape({ accountCode: PropTypes.string.isRequired, accountName: PropTypes.string }).isRequired,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default AccountLedgerDialog;
