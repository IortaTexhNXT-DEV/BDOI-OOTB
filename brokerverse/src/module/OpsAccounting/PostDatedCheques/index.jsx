import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import DateField from "../../../components/DateField";
import LoadingBar from "../../../components/LoadingBar";
import PageActions from "../../../components/PageActions";
import RowActions from "../../../components/RowActions";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import { openConfirm } from "../../../components/ConfirmDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import service from "../../../services/opsAccountingService";
import { hasPermission } from "../../../utils/canOpen";
import { PageHeader, date, money, numericColumn, showError, showSuccess } from "../common";
import ActionDialog from "./ActionDialog";
import ChequeDetail from "./ChequeDetail";
import EncodeDialog from "./EncodeDialog";
import TransmittalDetail from "./TransmittalDetail";
import { TABS, chequeActions, clearable, forwardable } from "./model";
import "./pdc.scss";

const LIST_TABS = TABS.filter((tab) => !["follow-up", "transmittals"].includes(tab));

/**
 * Accounts > Post-Dated Cheques, the PDC tracking log (TIS-BRD-COLL-05): every cheque with its set, instalment,
 * Insurance Partner, custody, status, ageing and AR, by status tab and filter; Encode PDCs, Forward to Insurance
 * Partner, the partner's receipt and maturity advices, cancellation with a second user's approval, replacement and
 * return; deposit, cleared and bounced for cheques payable to TISPH.
 */
const PostDatedCheques = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(TABS.includes(params.get("tab")) ? params.get("tab") : "open");
  const [filters, setFilters] = useState({ insurerId: null, payee: null, chequeFrom: "", chequeTo: "", search: "" });
  const [selected, setSelected] = useState([]);
  const [banks, setBanks] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [encoding, setEncoding] = useState(false);
  const [action, setAction] = useState(null);
  const [chequeId, setChequeId] = useState(params.get("cheque"));
  const [transmittalId, setTransmittalId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const write = hasPermission("write:pdc");

  const loader = useCallback(async () => {
    const base = { insurerId: filters.insurerId || undefined, payee: filters.payee || undefined, chequeFrom: filters.chequeFrom || undefined,
      chequeTo: filters.chequeTo || undefined, search: filters.search || undefined };
    const [log, followUp, transmittals] = await Promise.all([
      service.pdcs({ ...base, tab: LIST_TABS.includes(tab) ? tab : "open" }),
      tab === "follow-up" ? service.pdcFollowUp() : Promise.resolve(null),
      tab === "transmittals" ? service.pdcTransmittals({ insurerId: filters.insurerId || undefined }) : Promise.resolve(null),
    ]);
    return { log, followUp, transmittals };
  }, [tab, filters]);
  const { data, loading, refreshing, reload } = useStableLoad(loader, { debounceMs: 300 });

  useEffect(() => {
    Promise.all([service.banks(), service.insurers()]).then(([b, i]) => { setBanks(b); setInsurers(i); }).catch(() => {});
  }, []);
  useEffect(() => setSelected([]), [tab, filters]);

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    reload();
  };
  const done = (message) => {
    showSuccess(toast, message);
    setAction(null);
    setSelected([]);
    refresh();
  };
  const openCheque = (id) => {
    setChequeId(id);
    if (id) params.set("cheque", id); else params.delete("cheque");
    setParams(params, { replace: true });
  };

  const facts = (c) => [
    { label: t("opsAcc.pdc.number"), value: c.pdcNumber },
    { label: t("opsAcc.client"), value: c.clientName },
    { label: t("opsAcc.pdc.bankCheque"), value: `${c.bankName || ""} ${c.chequeNumber}`.trim() },
    { label: t("opsAcc.pdc.chequeDate"), value: c.chequeDate, type: "date" },
    { label: t("opsAcc.amount"), value: c.amount, type: "amount", emphasis: true },
  ];
  const run = async (code, c) => {
    try {
      if (code === "view") return openCheque(c.id);
      if (code === "request-cancellation") {
        const reason = await openConfirm({
          title: t("opsAcc.pdc.cancelTitle", { number: c.pdcNumber }), severity: "danger", facts: facts(c),
          message: c.custody === "partner" || c.custody === "in-transit" ? t("opsAcc.pdc.pullOutNote", { partner: c.insurerName }) : t("opsAcc.pdc.cancelMessage"),
          reason: { context: "pdc_cancel", label: t("opsAcc.pdc.cancelReason") }, confirmLabel: t("opsAcc.pdc.sendForApproval"), cancelLabel: t("opsAcc.confirmations.pdc.keep"),
          onConfirm: (value) => service.pdcAction(c.id, "cancellation", value),
        });
        if (reason !== null) done(t("opsAcc.pdc.cancelRequested", { number: c.pdcNumber }));
        return undefined;
      }
      if (code === "approve-cancellation") {
        let pullOut = false;
        const ok = await openConfirm({
          title: t("opsAcc.pdc.approveTitle", { number: c.pdcNumber }), facts: [...facts(c), { label: t("opsAcc.pdc.cancelReason"), value: c.cancellation?.reason }],
          message: ["forwarded", "warehoused"].includes(c.cancellation?.priorStatus) ? t("opsAcc.pdc.pullOutNote", { partner: c.insurerName }) : t("opsAcc.pdc.cancelMessage"),
          confirmLabel: t("opsAcc.pdc.approveCancellation"), cancelLabel: t("opsAcc.cancel"),
          onConfirm: () => service.pdcAction(c.id, "cancellation/decision", { action: "approve" }).then((r) => { pullOut = r.pullOut; }),
        });
        if (ok) done(pullOut ? t("opsAcc.pdc.pullOutRequestedDone", { partner: c.insurerName }) : t("opsAcc.pdc.cancelledDone", { number: c.pdcNumber }));
        return undefined;
      }
      if (code === "return-cancellation") {
        const remark = await openConfirm({
          title: t("opsAcc.pdc.returnRequestTitle", { number: c.pdcNumber }), severity: "danger", facts: facts(c),
          input: { type: "textarea", label: t("opsAcc.pdc.returnRemark"), required: true, minLength: 3, maxLength: 500 },
          confirmLabel: t("opsAcc.pdc.returnRequest"), cancelLabel: t("opsAcc.cancel"),
          onConfirm: (value) => service.pdcAction(c.id, "cancellation/decision", { action: "return", remark: value }),
        });
        if (remark !== null) done(t("opsAcc.pdc.requestReturned", { number: c.pdcNumber }));
        return undefined;
      }
      if (code === "clear") {
        const ok = await openConfirm({
          title: t("opsAcc.confirmations.pdc.clearTitle", { number: c.pdcNumber }), facts: [...facts(c), { label: t("opsAcc.pdc.ar"), value: c.receiptNumber }],
          confirmLabel: t("opsAcc.confirmations.pdc.clear"), onConfirm: () => service.pdcAction(c.id, "clear"),
        });
        if (ok) done(t("opsAcc.pdc.clearedDone"));
        return undefined;
      }
      return setAction({ kind: code, cheques: [c] });
    } catch (e) {
      showError(toast, e);
      return undefined;
    }
  };
  const pullOutsFor = (insurerId) => (data?.log.rows || []).filter((r) => r.insurerId === insurerId && r.cancellation?.pullOutRequested && !r.cancellation.pullOutTransmittalNumber);

  const log = data?.log;
  const rows = useMemo(() => {
    if (tab === "follow-up") return data?.followUp?.rows || [];
    return log?.rows || [];
  }, [tab, data, log]);
  const ageing = log?.ageing;
  const bucketLabels = ageing ? [t("opsAcc.pdc.current"), `1-${ageing.buckets[0]}`, `${ageing.buckets[0] + 1}-${ageing.buckets[1]}`,
    `${ageing.buckets[1] + 1}-${ageing.buckets[2]}`, t("opsAcc.pdc.over", { days: ageing.buckets[2] })] : [];

  const tabLabel = (key) => {
    const n = key === "follow-up" ? data?.followUp?.rows.length : log?.counts?.[key];
    return n === undefined || n === null || key === "transmittals" ? t(`opsAcc.pdc.tabs.${key}`) : `${t(`opsAcc.pdc.tabs.${key}`)} (${n})`;
  };

  const table = (
    <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("opsAcc.none")}
      selection={write ? selected : undefined} onSelectionChange={(e) => setSelected(e.value)} selectionMode={write ? "checkbox" : undefined}>
      {write ? <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} /> : null}
      <Column header={t("opsAcc.pdc.number")} body={(r) => (
        <>
          <Button link className="pdc-link" label={r.pdcNumber} onClick={() => openCheque(r.id)} />
          {r.setNumber ? <div className="pe-muted text-sm">{r.setNumber}</div> : null}
        </>
      )} />
      <Column header={t("opsAcc.pdc.clientPolicy")} body={(r) => <>{r.clientName}<div className="pe-muted text-sm">{r.policyNumber}</div></>} />
      <Column header={t("opsAcc.pdc.inst")} body={(r) => r.instalmentText || "—"} />
      <Column field="insurerName" header={t("opsAcc.pdc.insurancePartner")} />
      <Column header={t("opsAcc.pdc.bankCheque")} body={(r) => <>{r.bankName}<div className="pe-muted text-sm">{r.chequeNumber}</div></>} />
      <Column header={t("opsAcc.pdc.chequeDate")} body={(r) => date(r.chequeDate)} />
      <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
      <Column header={t("opsAcc.pdc.custody")} body={(r) => r.custodyText} />
      <Column header={t("opsAcc.statusLabel")} body={(r) => <StatusChip code={r.status} label={r.statusText} />} />
      {tab === "follow-up" ? <Column field="followUpReason" header={t("opsAcc.pdc.followUpReason")} />
        : <Column header={t("opsAcc.pdc.ageing")} body={(r) => r.ageing?.label || ""} />}
      <Column header={t("opsAcc.pdc.ar")} body={(r) => (r.receiptNumber ? `${r.receiptNumber}${r.receiptCancelled ? ` (${t("opsAcc.status.cancelled")})` : ""}` : "")} />
      <Column body={(r) => (
        <RowActions label={t("opsAcc.pdc.actionsFor", { number: r.pdcNumber })} actions={chequeActions(r).map((a) => ({ ...a, label: t(`opsAcc.pdc.menu.${a.code}`) }))}
          onAction={(a) => run(a.code, r)} />
      )} />
    </DataTable>
  );

  const transmittalTable = (
    <DataTable value={data?.transmittals || []} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("opsAcc.none")}>
      <Column header={t("opsAcc.pdc.transmittal")} body={(r) => <Button link className="pdc-link" label={r.transmittalNumber} onClick={() => setTransmittalId(r.id)} />} />
      <Column field="insurerName" header={t("opsAcc.pdc.insurancePartner")} />
      <Column header={t("opsAcc.pdc.forwardedOn")} body={(r) => date(r.forwardedOn)} />
      <Column header={t("opsAcc.pdc.sentBy")} body={(r) => t(`opsAcc.pdc.sentByOptions.${r.sentBy}`)} />
      <Column field="courierReference" header={t("opsAcc.pdc.courierReference")} />
      <Column header={t("opsAcc.pdc.receivedOn")} body={(r) => (r.receivedOn ? date(r.receivedOn) : "")} />
      <Column header={t("opsAcc.statusLabel")} body={(r) => <StatusChip code={r.status} label={t(`opsAcc.pdc.transmittalStatus.${r.status}`)} />} />
    </DataTable>
  );

  const s = log?.summary;
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.pdc.title")} help={t("opsAcc.pdc.help")}>
        <PageActions onAdd={write ? () => setEncoding(true) : undefined} addLabel={t("opsAcc.pdc.encode")}>
          <Button icon="pi pi-download" label={t("opsAcc.export")} outlined
            onClick={() => service.downloadPdcs({ tab: LIST_TABS.includes(tab) ? tab : "open", ...filters }).catch((e) => showError(toast, e))} />
          {write && clearable(selected) ? (
            <Button icon="pi pi-check-circle" label={t("opsAcc.pdc.menu.partner-cleared")} outlined onClick={() => setAction({ kind: "partner-cleared", cheques: selected })} />
          ) : null}
          {write ? (
            <Button icon="pi pi-send" label={t("opsAcc.pdc.forward")} outlined disabled={!forwardable(selected)}
              tooltip={selected.length && !forwardable(selected) ? t("opsAcc.pdc.forwardHint") : undefined} tooltipOptions={{ showOnDisabled: true, position: "bottom" }}
              onClick={() => setAction({ kind: "forward", cheques: selected })} />
          ) : null}
        </PageActions>
      </PageHeader>
      <StatCards items={[
        { key: "atTis", label: t("opsAcc.pdc.atTis"), value: s ? money(s.atTisAmount) : undefined, note: s ? t("opsAcc.pdc.chequesCount", { count: s.atTis }) : null, onClick: () => setTab("at-tis"), active: tab === "at-tis" },
        { key: "partners", label: t("opsAcc.pdc.withPartners"), value: s ? money(s.withPartnersAmount) : undefined, note: s ? t("opsAcc.pdc.chequesCount", { count: s.withPartners }) : null,
          onClick: () => setTab("with-partners"), active: tab === "with-partners" },
        { key: "week", label: t("opsAcc.pdc.dueThisWeek"), value: s ? money(s.dueThisWeekAmount) : undefined, note: s ? t("opsAcc.pdc.chequesCount", { count: s.dueThisWeek }) : null },
        { key: "awaiting", label: t("opsAcc.pdc.awaiting"), value: s ? money(s.awaitingAmount) : undefined, note: s ? t("opsAcc.pdc.chequesCount", { count: s.awaiting }) : null,
          onClick: () => setTab("awaiting"), active: tab === "awaiting" },
        { key: "bounced", label: t("opsAcc.pdc.bounced"), value: s ? money(s.bouncedAmount) : undefined, note: s ? t("opsAcc.pdc.chequesCount", { count: s.bounced }) : null,
          onClick: () => setTab("bounced"), active: tab === "bounced" },
      ]} />
      <div className="pe-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <TabView activeIndex={TABS.indexOf(tab)} onTabChange={(e) => setTab(TABS[e.index])} scrollable>
          {TABS.map((key) => <TabPanel key={key} header={tabLabel(key)} />)}
        </TabView>
        <div className="pdc-filters">
          <Dropdown value={filters.insurerId} options={insurers} optionLabel="label" optionValue="value" showClear filter placeholder={t("opsAcc.pdc.insurancePartner")}
            onChange={(e) => setFilters({ ...filters, insurerId: e.value })} aria-label={t("opsAcc.pdc.insurancePartner")} />
          {tab !== "transmittals" ? (
            <>
              <Dropdown value={filters.payee} options={["insurance-partner", "tisph"].map((v) => ({ label: t(`opsAcc.pdc.payees.${v}`), value: v }))} showClear
                placeholder={t("opsAcc.pdc.payee")} onChange={(e) => setFilters({ ...filters, payee: e.value })} aria-label={t("opsAcc.pdc.payee")} />
              <DateField id="pdc-from" value={filters.chequeFrom} placeholder={t("opsAcc.pdc.chequeFrom")} onChange={(e) => setFilters({ ...filters, chequeFrom: e.target.value })} />
              <DateField id="pdc-to" value={filters.chequeTo} placeholder={t("opsAcc.pdc.chequeTo")} onChange={(e) => setFilters({ ...filters, chequeTo: e.target.value })} />
              <InputText className="pdc-filters__search" value={filters.search} placeholder={t("opsAcc.pdc.searchHint")} aria-label={t("opsAcc.search")}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </>
          ) : null}
        </div>
        {tab !== "transmittals" && ageing ? (
          <div className="pdc-ageing" aria-label={t("opsAcc.pdc.ageing")}>
            {["current", "b1", "b2", "b3", "b4"].map((k, i) => <span key={k}>{bucketLabels[i]}<b>{money(ageing.amounts[k])}</b></span>)}
          </div>
        ) : null}
        {tab === "transmittals" ? transmittalTable : table}
      </div>

      <EncodeDialog visible={encoding} onHide={() => setEncoding(false)} banks={banks}
        onSaved={(r) => { setEncoding(false); done(t("opsAcc.pdc.setSaved", { set: r.set.setNumber, count: r.cheques.length, amount: money(r.set.total) })); }} />
      <ActionDialog action={action} onHide={() => setAction(null)} onDone={done} banks={banks} depositAccount={log?.depositAccount}
        pullOuts={action?.kind === "forward" ? pullOutsFor(action.cheques[0]?.insurerId) : []} />
      <ChequeDetail chequeId={chequeId} refreshKey={refreshKey} onHide={() => openCheque(null)} onAction={(code, c) => run(code, c)} />
      <TransmittalDetail transmittalId={transmittalId} refreshKey={refreshKey} toast={toast} onHide={() => setTransmittalId(null)}
        onAction={(kind, cheques, tr) => setAction({ kind, cheques, transmittal: tr })} />
    </div>
  );
};

export default PostDatedCheques;
