import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { ColumnGroup } from "primereact/columngroup";
import { DataTable } from "primereact/datatable";
import { Message } from "primereact/message";
import { Row } from "primereact/row";
import { SelectButton } from "primereact/selectbutton";
import { Skeleton } from "primereact/skeleton";
import LoadingBar from "../../../components/LoadingBar";
import StatusChip from "../../../components/StatusChip";
import { useStableLoad } from "../../../hooks/useStableLoad";
import postingRulesService from "../../../services/postingRulesService";
import { formatNumber } from "../../../utility/currencyConverter";

const money = (v) => (v ? formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

/**
 * Worked example of an event with sample amounts (nothing is posted): the amounts in business words and the journal
 * they build with today's accounts. Co-insurance events offer a single insurer or two insurers (60 / 40); switching
 * keeps the previous example on screen until the next one arrives, and each choice is loaded once.
 */
const ExamplePanel = ({ eventCode, coInsurable }) => {
  const { t } = useTranslation();
  const [coInsurance, setCoInsurance] = useState(false);
  const [cache] = useState(() => new Map());
  const loader = useCallback(async () => {
    const key = coInsurance ? "co" : "single";
    if (!cache.has(key)) cache.set(key, await postingRulesService.flowExample(eventCode, coInsurance));
    return cache.get(key);
  }, [cache, eventCode, coInsurance]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);

  const totals = data ? (
    <ColumnGroup>
      <Row>
        <Column footer={t("accountingFlow.example.total")} colSpan={2} />
        <Column footer={money(data.totalDebit)} className="af-num" />
        <Column footer={money(data.totalCredit)} className="af-num" />
      </Row>
    </ColumnGroup>
  ) : null;

  return (
    <section className="af-example bv-loading-host" aria-label={t("accountingFlow.example.title")}>
      <LoadingBar active={refreshing} />
      <div className="af-example__head">
        <span className="af-example__title">{t("accountingFlow.example.title")}</span>
        {coInsurable ? (
          <SelectButton value={coInsurance} onChange={(e) => setCoInsurance(e.value === null || e.value === undefined ? coInsurance : e.value)} allowEmpty={false}
            options={[{ label: t("accountingFlow.example.single"), value: false }, { label: t("accountingFlow.example.coInsured"), value: true }]} />
        ) : null}
      </div>
      {error ? (
        <div className="af-error">
          <Message severity="error" text={error} />
          <Button label={t("accountingFlow.retry")} text onClick={reload} />
        </div>
      ) : null}
      {!data && loading ? <Skeleton height="6rem" /> : null}
      {data ? (
        <>
          {data.sample.length ? (
            <div className="af-example__sample">
              {data.sample.map((s) => <span key={s.amount}>{s.amount} <strong>{money(s.value)}</strong></span>)}
            </div>
          ) : null}
          <DataTable value={data.lines} size="small" className="af-entries" footerColumnGroup={totals}>
            <Column header={t("accountingFlow.entries.account")} body={(l) => <span className="af-acct__code">{l.accountCode}</span>} />
            <Column header={t("accountingFlow.example.name")} body={(l) => (
              <span>{l.accountName || ""}{l.example ? <span className="af-muted"> · {t("accountingFlow.example.exampleAccount")}</span> : null}</span>
            )} />
            <Column header={t("accountingFlow.entries.debit")} body={(l) => money(l.debit)} className="af-num" />
            <Column header={t("accountingFlow.entries.credit")} body={(l) => money(l.credit)} className="af-num" />
          </DataTable>
          <div className="af-example__foot">
            <StatusChip label={t(data.balanced ? "accountingFlow.example.balanced" : "accountingFlow.example.notBalanced")} severity={data.balanced ? "success" : "danger"} />
            {data.omitted.length ? <span className="af-muted">{t("accountingFlow.example.omitted", { items: data.omitted.join(", ") })}</span> : null}
          </div>
        </>
      ) : null}
    </section>
  );
};

ExamplePanel.propTypes = { eventCode: PropTypes.string.isRequired, coInsurable: PropTypes.bool };

export default ExamplePanel;
