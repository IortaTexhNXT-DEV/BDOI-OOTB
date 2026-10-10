import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import AccountCell, { MapLink, MappingChip, TipChip } from "./AccountCell";
import { journalLines, lineMapping } from "./flowView";

const Side = ({ side }) => {
  const { t } = useTranslation();
  return <span className={`af-side af-side--${side === "Dr" ? "dr" : "cr"}`} aria-label={t(side === "Dr" ? "accountingFlow.entries.debit" : "accountingFlow.entries.credit")}>{side}</span>;
};

Side.propTypes = { side: PropTypes.string.isRequired };

const Amount = ({ line }) => {
  const { t } = useTranslation();
  return (
    <div className="af-amount">
      <span>{line.amount}</span>
      {line.formula ? (
        <i className="pi pi-info-circle af-tip af-amount__formula" data-pr-tooltip={line.formula} tabIndex={0} role="img"
          aria-label={t("accountingFlow.entries.formula", { formula: line.formula })} />
      ) : null}
      {line.perParticipant ? <TipChip label={t("accountingFlow.entries.perInsurer")} severity="secondary" tip={t("accountingFlow.entries.perInsurerTip")} /> : null}
    </div>
  );
};

Amount.propTypes = { line: PropTypes.object.isRequired };

const Notes = ({ line }) => {
  const { t } = useTranslation();
  const a = line.account || {};
  const mapping = lineMapping(a);
  const change = a.pendingChange;
  return (
    <div className="af-notes">
      {line.condition ? (
        line.condition.on
          ? <span className="af-notes__condition">{t("accountingFlow.entries.onlyWhen", { condition: line.condition.name.toLowerCase() })}</span>
          : <TipChip label={t("accountingFlow.entries.notPosted")} severity="secondary" tip={t("accountingFlow.entries.notPostedTip", { condition: line.condition.name.toLowerCase() })} />
      ) : null}
      {mapping ? (
        <span className="af-notes__mapping">
          <MappingChip mapping={mapping} />
          <MapLink to={a.configure} />
        </span>
      ) : null}
      {change ? (
        <TipChip label={t("accountingFlow.entries.changePending")} severity="warning"
          tip={change.glCode ? t("accountingFlow.entries.changePendingTo", { account: [change.glCode, change.glName].filter(Boolean).join(" "), by: change.requestedBy || "-" })
            : t("accountingFlow.entries.changePendingBy", { by: change.requestedBy || "-" })} />
      ) : null}
    </div>
  );
};

Notes.propTypes = { line: PropTypes.object.isRequired };

/** The journal of an event: one table, debits first then credits, with the amount in business words and the notes. */
const EntriesTable = ({ event }) => {
  const { t } = useTranslation();
  return (
    <DataTable value={journalLines(event)} dataKey="lineNo" size="small" className="af-entries" emptyMessage={t("accountingFlow.entries.none")}
      rowClassName={(l) => (l.condition && !l.condition.on ? "af-entries__off" : "")}>
      <Column header={t("accountingFlow.entries.side")} body={(l) => <Side side={l.side} />} style={{ width: "4rem" }} />
      <Column header={t("accountingFlow.entries.account")} body={(l) => <AccountCell account={l.account} />} />
      <Column header={t("accountingFlow.entries.amount")} body={(l) => <Amount line={l} />} />
      <Column header={t("accountingFlow.entries.notes")} body={(l) => <Notes line={l} />} />
    </DataTable>
  );
};

EntriesTable.propTypes = { event: PropTypes.object.isRequired };

export default EntriesTable;
