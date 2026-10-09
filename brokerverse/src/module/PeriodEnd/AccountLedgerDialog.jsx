import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
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
    [t("financialStatements.ledger.account"), `${account.accountCode} ${account.accountName}`],
    [t("financialStatements.ledger.period"), `${date(from)} – ${date(to)}`],
    [t("financialStatements.ledger.opening"), data ? sidedAmount(opening, side) : "-"],
    [t("financialStatements.ledger.debits"), data ? money(sum(postings, "debit")) : "-"],
    [t("financialStatements.ledger.credits"), data ? money(sum(postings, "credit")) : "-"],
    [t("financialStatements.ledger.closing"), data ? sidedAmount(data.summary?.closingBalance, side) : "-"],
  ];
  const open = (r) => setJournal({ journalNumber: r.journalNumber, date: r.date, period: r.period, description: r.description });
  return (
    <Dialog header={t("financialStatements.ledger.title")} visible onHide={onHide} className="pe-dialog fs-ledger" style={{ width: "min(1080px, 96vw)" }}
      footer={<Button label={t("financialStatements.ledger.close")} outlined onClick={onHide} />}>
      <dl className="fs-facts">
        {facts.map(([label, value], i) => (
          <div key={label} className={i === 0 ? "fs-fact--wide" : undefined}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
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
    </Dialog>
  );
};

AccountLedgerDialog.propTypes = {
  account: PropTypes.shape({ accountCode: PropTypes.string.isRequired, accountName: PropTypes.string }).isRequired,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default AccountLedgerDialog;
