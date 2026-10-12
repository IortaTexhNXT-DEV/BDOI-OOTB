import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabMenu } from "primereact/tabmenu";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import LoadingBar from "../../../components/LoadingBar";
import { useStableLoad } from "../../../hooks/useStableLoad";
import remittanceService from "../../../services/remittanceService";
import opsAccountingService from "../../../services/opsAccountingService";
import { REMITTANCE_ROUTES, formatDate, money } from "../shared";
import "../remittance.scss";

const VIEWS = ["held", "released"];

/**
 * Accounts > Remittance > Held policies (FR-RMT-012): part-paid policies held from remittance on the fully paid basis,
 * with the plan, premium, paid to date, balance, next due date and bounced cheques; and the policies released once fully
 * paid, with the receipt that cleared them (picked by the next weekly run).
 */
const HeldPolicies = () => {
  const { t } = useTranslation();
  const [view, setView] = useState("held");
  const [insurerId, setInsurerId] = useState(null);
  const [q, setQ] = useState("");
  const [insurers, setInsurers] = useState([]);
  const loader = useCallback(() => remittanceService.heldPolicies({ status: view, insurerId: insurerId || undefined, q: q || undefined }), [view, insurerId, q]);
  const { data, loading, refreshing } = useStableLoad(loader, { debounceMs: 300 });

  useEffect(() => {
    opsAccountingService.insurers().then(setInsurers).catch(() => {});
  }, []);

  const totals = data?.totals;
  return (
    <div className="rm-page">
      <PageHeader title={t("remittance.held.title")} home={t("remittance.common.accounts")} section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
        trail={[t("remittance.held.title")]} help={t("remittance.held.help")} />
      <StatCards items={[
        { key: "count", label: t(`remittance.held.kpis.${view}`), value: totals ? totals.count : undefined },
        { key: "premium", label: t("remittance.held.columns.premium"), value: totals ? money(totals.premium) : undefined },
        { key: "paid", label: t("remittance.held.columns.paidToDate"), value: totals ? money(totals.paidToDate) : undefined },
        { key: "balance", label: t("remittance.held.columns.balance"), value: totals ? money(totals.balance) : undefined },
      ]} />
      <div className="rm-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <TabMenu model={VIEWS.map((v) => ({ label: t(`remittance.held.views.${v}`), command: () => setView(v) }))} activeIndex={VIEWS.indexOf(view)} className="rm-tabs" />
        <div className="flex flex-wrap gap-2 my-3">
          <Dropdown value={insurerId} options={insurers} optionLabel="label" optionValue="value" showClear filter placeholder={t("remittance.held.insurer")}
            onChange={(e) => setInsurerId(e.value)} aria-label={t("remittance.held.insurer")} className="w-16rem" />
          <InputText value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("remittance.held.search")} aria-label={t("remittance.held.search")} className="w-18rem" />
        </div>
        <DataTable value={data?.rows || []} dataKey="policyId" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t(`remittance.held.empty.${view}`)}>
          {/* fits at 1366px: policy with its client, insurer with line and plan, one amount column with its parts under it */}
          <Column field="policyNumber" header={t("remittance.held.columns.policy")} body={(r) => (
            <span className="bv-cell-stack"><span className="rm-ref">{r.policyNumber}</span><small>{r.clientName}</small></span>
          )} />
          <Column field="insurerName" header={t("remittance.held.columns.insurer")} body={(r) => (
            <span className="bv-cell-stack"><span>{r.insurerName}</span><small>{[r.productLine, r.plan].filter(Boolean).join(" · ")}</small></span>
          )} />
          {view === "held" ? (
            <Column header={t("remittance.held.columns.balance")} className="bv-num" headerClassName="bv-num" body={(r) => (
              <span className="bv-cell-stack" style={{ alignItems: "flex-end" }}>
                <strong>{money(r.balance)}</strong>
                <small>{t("remittance.held.balanceOf", { total: money(r.premium), paid: money(r.paidToDate), defaultValue: "of {{total}}, paid {{paid}}" })}</small>
              </span>
            )} />
          ) : (
            <Column header={t("remittance.held.columns.premium")} className="bv-num" headerClassName="bv-num" body={(r) => (
              <span className="bv-cell-stack" style={{ alignItems: "flex-end" }}>
                <strong>{money(r.premium)}</strong>
                <small>{t("remittance.held.paidOf", { paid: money(r.paidToDate), defaultValue: "paid {{paid}}" })}</small>
              </span>
            )} />
          )}
          {view === "held" ? (
            <Column header={t("remittance.held.columns.nextDue")} bodyClassName="bv-nowrap" body={(r) => (
              <span className="bv-cell-stack"><span>{formatDate(r.nextDue)}</span><small>{t("remittance.held.heldSinceShort", { date: formatDate(r.heldSince), defaultValue: "held since {{date}}" })}</small></span>
            )} />
          ) : null}
          {view === "held" ? (
            <Column header={t("remittance.held.columns.bounced")} bodyClassName="bv-nowrap" body={(r) => (r.bouncedCheques ? <StatusChip code="bounced" label={t("remittance.held.bouncedCount", { count: r.bouncedCheques })} /> : "—")} />
          ) : null}
          {view === "released" ? <Column header={t("remittance.held.columns.releasedOn")} body={(r) => formatDate(r.releasedOn)} /> : null}
          {view === "released" ? <Column field="releaseReceipt" header={t("remittance.held.columns.releaseReceipt")} /> : null}
        </DataTable>
      </div>
    </div>
  );
};

export default HeldPolicies;
