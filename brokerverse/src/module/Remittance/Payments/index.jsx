import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabMenu } from "primereact/tabmenu";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import LoadingBar from "../../../components/LoadingBar";
import DateField from "../../../components/DateField";
import BankBatchDialog from "../../../components/BankBatchDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { canOpen, hasPermission } from "../../../utils/canOpen";
import { remittanceService } from "../../../services/remittanceService";
import { REMITTANCE_ROUTES, formatDate, loadInsurerOptions, money, useUrlState } from "../shared";
import { LEGACY, METHODS, PER_PAGE, batchable, segmentOf, segmentsShown, selectedIds, severityOf } from "./paymentsModel";
import PaymentPanel, { AppLink } from "./PaymentPanel";
import TransferPanel, { ReversalCell } from "./TransferPanel";
import "../remittance.scss";

const BANK_PAYMENT_FILES = "/accounts/bank-payment-files";
const batchLink = (id) => `${BANK_PAYMENT_FILES}?batch=${encodeURIComponent(id)}`;
const KPI_SEGMENT = { toPay: "to-pay", inPayment: "in-payment", paidThisWeek: "paid", failed: "failed" };

/**
 * Accounts > Remittance > Insurer payments (/finance/remittance/payments): the payment vouchers raised for approved
 * remittances, with their batch or cheque and the bank's result. It pays and posts nothing itself: Create Metrobank
 * batch (n) opens the batch dialog of Bank Payment Files with the ticked vouchers, and Pay by cheque opens the voucher
 * in Disbursement. Four KPI cards, the segments To pay, In payment, Paid, Failed and All (Legacy transfers only when
 * TRF- items exist), the filters, the table with the total of the filtered set and a row menu built from the server's
 * actions, View payment first. ?payment=PV-... opens the payment record; ?transfer=TRF-... a legacy transfer,
 * read-only. A read-only user sees "View only", no tick box and no primary button. There is no transfer to create.
 */
const Payments = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [state, update] = useUrlState({});
  const [search, setSearch] = useState(state.q || "");
  const [insurers, setInsurers] = useState([]);
  const [selection, setSelection] = useState([]);
  const [batching, setBatching] = useState(false);
  const [created, setCreated] = useState(null);
  const segment = segmentOf(state.segment);
  const legacy = segment === LEGACY;
  const page = Math.max(1, Number(state.page) || 1);

  const filters = useMemo(() => ({
    insurerId: state.insurerId || undefined, from: state.from || undefined, to: state.to || undefined, method: state.method || undefined, q: state.q || undefined,
  }), [state.insurerId, state.from, state.to, state.method, state.q]);
  const params = useMemo(() => (legacy ? { ...filters, segment: "all", perPage: 1 } : { ...filters, segment, page, perPage: PER_PAGE }), [filters, segment, legacy, page]);
  const loader = useCallback(() => remittanceService.listPayments(params), [params]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const legacyLoader = useCallback(() => remittanceService.legacyTransfers({ q: state.q || undefined, page, perPage: PER_PAGE }), [state.q, page]);
  const transfers = useStableLoad(legacyLoader, { enabled: legacy });

  const rows = legacy ? [] : data?.data || [];
  const kpis = data?.kpis || null;
  const batchState = data?.batching || null;
  const readOnly = batchState ? batchState.code === "NO_PERMISSION" : !hasPermission("write:disbursements");
  const canBatch = !!batchState?.allowed;

  useEffect(() => {
    loadInsurerOptions().then(setInsurers).catch(() => setInsurers([]));
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q === (state.q || "")) return undefined;
    const timer = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(timer);
  }, [search, state.q, update]);

  useEffect(() => {
    setSelection([]);
  }, [params]);

  const setSegment = (key) => update({ segment: key });
  const tabs = segmentsShown(data?.legacyTransfers || 0, segment).map((key) => ({
    key, label: key === LEGACY ? t("remittance.payments.segments.legacy", { count: data?.legacyTransfers ?? 0 }) : t(`remittance.payments.segments.${key}`, { count: data?.segments?.[key] ?? 0 }),
  }));
  const activeIndex = Math.max(0, tabs.findIndex((s) => s.key === segment));

  const card = (key, figure) => ({
    key, label: t(`remittance.payments.kpis.${key}`), value: figure ? figure.count : null, note: figure ? money(figure.amount) : " ",
    active: !legacy && segment === KPI_SEGMENT[key], onClick: () => setSegment(KPI_SEGMENT[key]),
  });
  const cards = ["toPay", "inPayment", "paidThisWeek", "failed"].map((key) => card(key, kpis?.[key]));

  const download = (path, name) => remittanceService.download(path, name)
    .catch((e) => toast.current?.show({ severity: "error", summary: t("remittance.record.downloadFailed"), detail: e.message, life: 6000 }));

  const overflow = [
    { code: "export", label: t("remittance.payments.overflow.export"), allowed: !legacy },
    { code: "bank-payment-files", label: t("remittance.payments.overflow.bankPaymentFiles"), allowed: canOpen(BANK_PAYMENT_FILES) },
  ].filter((a) => a.allowed);
  const onOverflow = (action) => {
    if (action.code === "export") download(remittanceService.exportPaymentsPath({ ...filters, segment }), `insurer-payments-${segment}.xlsx`);
    if (action.code === "bank-payment-files") navigate(BANK_PAYMENT_FILES);
  };

  const primaryLabel = selection.length ? t("remittance.payments.createBatch", { count: selection.length }) : t("remittance.payments.selectToBatch");
  const headerActions = readOnly ? (
    <div className="rm-header-actions">
      <StatusChip label={t("remittance.common.viewOnly")} severity="secondary" />
      {overflow.length ? <RowActions label={t("remittance.common.moreActions")} actions={overflow} onAction={onOverflow} /> : null}
    </div>
  ) : (
    <div className="rm-header-actions">
      <Button type="button" label={canBatch ? primaryLabel : t("remittance.payments.createBatchPlain")} disabled={!canBatch || !selection.length || legacy}
        onClick={() => setBatching(true)} aria-describedby={batchState && !canBatch ? "rm-batching-reason" : undefined} />
      <RowActions label={t("remittance.common.moreActions")} actions={overflow} onAction={onOverflow} />
    </div>
  );

  const noLayout = !readOnly && batchState && !batchState.allowed && batchState.code === "NO_LAYOUT";

  const ticked = (row) => selection.some((r) => r.id === row.id);
  const tick = (row, on) => setSelection((cur) => (on ? [...cur.filter((r) => r.id !== row.id), row] : cur.filter((r) => r.id !== row.id)));
  const open = batchable(rows);
  const allTicked = open.length > 0 && open.every(ticked);
  const selectColumn = readOnly || legacy ? null : (
    <Column frozen style={{ width: "3rem" }}
      header={open.length ? <Checkbox checked={allTicked} onChange={(e) => setSelection(e.checked ? open : [])} aria-label={t("remittance.payments.selectAll")} /> : null}
      body={(r) => (r.selectable ? <Checkbox checked={ticked(r)} onChange={(e) => tick(r, e.checked)} aria-label={t("remittance.payments.select", { voucher: r.voucherNo })} /> : null)} />
  );

  const rowActions = (row) => (row.actions || []).filter((a) => !a.link || a.code === "view" || a.code === "open-remittance" || canOpen(a.link.split("?")[0]));
  const actionLabel = (a) => t(`remittance.payments.actions.${a.code}`, { defaultValue: a.label });
  const onRowAction = (row) => (action) => {
    if (action.code === "view") update({ payment: row.voucherNo, page: state.page });
    else if (action.code === "rebatch") tick(row, true);
    else if (action.code === "download-advice") download(action.href, `${row.remittance?.remittanceNo || row.voucherNo}-advice.pdf`);
    else if (action.link) navigate(action.link);
  };

  // two lines per cell (voucher and remittance, insurer and payee account, method and value date, batch and its
  // status, paid on and bank reference) keep Next step on screen at a laptop width
  const voucherCell = (r) => (
    <span className="rm-cell-stack">
      <Button type="button" link className="rm-ref rm-link" label={r.voucherNo} onClick={() => update({ payment: r.voucherNo, page: state.page })} />
      {r.remittance ? <Link to={r.remittance.link} className="rm-ref rm-muted">{r.remittance.remittanceNo}</Link> : null}
    </span>
  );
  const payeeCell = (r) => (
    <span className="rm-cell-stack">
      <span>{r.insurer?.shortName || "-"}</span>
      <span className="rm-payee rm-muted">
        {r.payee?.label ? <span className="rm-nowrap">{[r.payee.bank?.code || r.payee.bank?.name, r.payee.accountMasked].filter(Boolean).join(" ")}</span> : null}
        {r.payee?.chip?.code === "none" ? <StatusChip label={r.payee.chip.label} severity="secondary" /> : null}
      </span>
    </span>
  );
  const methodCell = (r) => (
    <span className="rm-cell-stack">
      <span>{r.method?.label || "-"}</span>
      {r.valueDate ? <span className="rm-muted">{formatDate(r.valueDate)}</span> : null}
    </span>
  );
  const batchCell = (r) => (r.batch ? (
    <span className="rm-cell-stack">
      <AppLink to={r.batch.link}>{r.batch.number}</AppLink>
      <StatusChip code={r.batch.status} label={r.batch.statusLabel} severity={severityOf(r.batch.status)} />
    </span>
  ) : "-");
  const paidCell = (r) => (r.paidOn ? (
    <span className="rm-cell-stack">
      <span>{formatDate(r.paidOn)}</span>
      {r.bankReference ? <span className="rm-muted">{r.bankReference}</span> : null}
    </span>
  ) : "-");
  const nextStep = (r) => (
    <span className="rm-next-step">
      <span>{r.nextStep?.label || "-"}</span>
      {r.nextStep?.reason ? <span className="rm-row-result rm-row-result--refused">{r.nextStep.reason}</span> : null}
    </span>
  );

  const empty = <div className="rm-empty">{t(`remittance.payments.empty.${segment}`)}</div>;

  const insurerOptions = [{ label: t("remittance.payments.filters.allInsurers"), value: "" }, ...insurers.map((i) => ({ label: i.label, value: String(i.id) }))];
  const methodOptions = [{ label: t("remittance.payments.filters.allMethods"), value: "" }, ...METHODS.map((m) => ({ label: t(`remittance.payments.methods.${m}`), value: m }))];

  const onCreated = (batch) => {
    setBatching(false);
    setSelection([]);
    setCreated(batch);
    reload();
  };

  const paymentsTable = (
    <div className="rm-card bv-loading-host">
      <LoadingBar active={refreshing} />
      <DataTable value={rows} dataKey="id" size="small" scrollable className="rm-table" loading={loading && !data} emptyMessage={empty}
        lazy paginator={(data?.total || 0) > PER_PAGE} rows={PER_PAGE} first={(page - 1) * PER_PAGE} totalRecords={data?.total || 0}
        onPage={(e) => update({ page: String(e.page + 1) })}>
        {selectColumn}
        <Column header={t("remittance.payments.columns.voucherNo")} frozen style={{ minWidth: "9.5rem" }} body={voucherCell}
          footer={t("remittance.payments.total", { count: data?.totals?.count ?? 0 })} />
        <Column header={t("remittance.payments.columns.insurerPayee")} body={payeeCell} />
        <Column header={t("remittance.payments.columns.amount")} align="right" body={(r) => <span className="rm-num">{money(r.amount)}</span>}
          footer={data ? <span className="rm-num">{money(data.totals?.amount)}</span> : null} />
        <Column header={t("remittance.payments.columns.method")} body={methodCell} />
        <Column header={t("remittance.payments.columns.batch")} body={batchCell} />
        <Column header={t("remittance.payments.columns.paidOn")} body={paidCell} />
        <Column header={t("remittance.payments.columns.nextStep")} body={nextStep} className="rm-col-next" />
        <Column header={<span className="p-sr-only">{t("remittance.payments.columns.actions")}</span>} align="center" style={{ width: "3.5rem" }}
          body={(r) => <RowActions label={t("remittance.payments.actionsFor", { voucher: r.voucherNo })} actions={rowActions(r)} labelOf={actionLabel} onAction={onRowAction(r)} />} />
      </DataTable>
    </div>
  );

  const transferRows = transfers.data?.data || [];
  const legacyTable = (
    <div className="rm-card bv-loading-host">
      <LoadingBar active={transfers.refreshing} />
      <DataTable value={transferRows} dataKey="id" size="small" scrollable className="rm-table" loading={transfers.loading && !transfers.data}
        emptyMessage={<div className="rm-empty">{t("remittance.payments.empty.legacy")}</div>}
        lazy paginator={(transfers.data?.total || 0) > PER_PAGE} rows={PER_PAGE} first={(page - 1) * PER_PAGE} totalRecords={transfers.data?.total || 0}
        onPage={(e) => update({ page: String(e.page + 1) })}>
        <Column header={t("remittance.payments.legacy.columns.reference")} frozen style={{ minWidth: "10rem" }}
          body={(x) => <Button type="button" link className="rm-ref rm-link" label={x.reference} onClick={() => update({ transfer: x.reference, page: state.page })} />}
          footer={t("remittance.payments.total", { count: transfers.data?.totals?.count ?? 0 })} />
        <Column header={t("remittance.payments.legacy.columns.beneficiary")} body={(x) => x.beneficiary || "-"} />
        <Column header={t("remittance.payments.legacy.columns.bank")} body={(x) => x.bank || "-"} />
        <Column header={t("remittance.payments.legacy.columns.account")} body={(x) => x.accountMasked || "-"} />
        <Column header={t("remittance.payments.legacy.columns.method")} body={(x) => x.method || "-"} />
        <Column header={t("remittance.payments.legacy.columns.amount")} align="right" body={(x) => <span className="rm-num">{money(x.amount)}</span>}
          footer={transfers.data ? <span className="rm-num">{money(transfers.data.totals?.amount)}</span> : null} />
        <Column header={t("remittance.payments.legacy.columns.status")} body={(x) => <StatusChip code={x.status} label={x.statusLabel} severity={severityOf(x.status)} />} />
        <Column header={t("remittance.payments.legacy.columns.approvedBy")} body={(x) => x.approvedBy?.name || "-"} />
        <Column header={t("remittance.payments.legacy.columns.journal")} body={(x) => x.journal?.number || "-"} />
        <Column header={t("remittance.payments.legacy.columns.reversal")} body={(x) => (x.journal ? <ReversalCell reversal={x.reversal} /> : "-")} />
        <Column header={<span className="p-sr-only">{t("remittance.payments.columns.actions")}</span>} align="center" style={{ width: "3.5rem" }}
          body={(x) => (
            <RowActions label={t("remittance.payments.actionsFor", { voucher: x.reference })} actions={[{ code: "view", label: t("remittance.payments.actions.view-transfer"), allowed: true }]}
              onAction={() => update({ transfer: x.reference, page: state.page })} />
          )} />
      </DataTable>
    </div>
  );

  const loadError = legacy ? transfers.error : error;
  const retry = legacy ? transfers.reload : reload;

  return (
    <div className="rm-page">
      <Toast ref={toast} />
      <PageHeader title={t("remittance.payments.title")} home={t("remittance.common.accounts")} section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
        trail={[t("remittance.payments.title")]} help={t("remittance.payments.help")} actions={headerActions} />

      {noLayout ? (
        <div className="rm-strip" id="rm-batching-reason" role="note">
          <StatusChip label={t("remittance.payments.noLayoutChip")} severity="warning" />
          <span>{batchState.reason}</span>
          {batchState.setupLink ? <Button type="button" link size="small" label={t("remittance.payments.layoutSetup")} onClick={() => navigate(batchState.setupLink)} /> : null}
        </div>
      ) : null}
      {legacy ? (
        <div className="rm-strip">
          <StatusChip label={t("remittance.payments.legacy.creationDisabled")} severity="secondary" />
        </div>
      ) : null}
      {created ? (
        <div className="rm-banner rm-banner--done" role="status">
          <span>{t("remittance.payments.batchCreated", { batch: created.batchNumber })}</span>
          {canOpen(BANK_PAYMENT_FILES) ? <Button type="button" label={t("remittance.payments.openBatch")} outlined size="small" onClick={() => navigate(batchLink(created.id))} /> : null}
          <Button type="button" icon="pi pi-times" text rounded size="small" aria-label={t("remittance.common.close")} onClick={() => setCreated(null)} />
        </div>
      ) : null}

      <StatCards items={cards} />
      <TabMenu model={tabs.map((s) => ({ label: s.label, command: () => setSegment(s.key) }))} activeIndex={activeIndex} className="rm-tabs" />

      <div className="rm-filters">
        {legacy ? null : (
          <>
            <Dropdown value={state.insurerId || ""} options={insurerOptions} onChange={(e) => update({ insurerId: e.value })} filter aria-label={t("remittance.payments.filters.insurer")} />
            <DateField id="rm-payments-from" value={state.from || ""} onChange={(e) => update({ from: e.target.value })} placeholder={t("remittance.payments.filters.from")}
              aria-label={t("remittance.payments.filters.from")} className="rm-filters__date" />
            <DateField id="rm-payments-to" value={state.to || ""} onChange={(e) => update({ to: e.target.value })} placeholder={t("remittance.payments.filters.to")}
              aria-label={t("remittance.payments.filters.to")} className="rm-filters__date" />
            <Dropdown value={state.method || ""} options={methodOptions} onChange={(e) => update({ method: e.value })} aria-label={t("remittance.payments.filters.method")} />
          </>
        )}
        <span className="p-input-icon-left">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={legacy ? t("remittance.payments.filters.searchLegacy") : t("remittance.payments.filters.search")}
            aria-label={t("remittance.payments.filters.search")} />
        </span>
      </div>

      {loadError ? (
        <div className="rm-inline-error" role="alert">
          <span>{t("remittance.payments.loadError")}</span>
          <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={retry} />
        </div>
      ) : (legacy ? legacyTable : paymentsTable)}

      <PaymentPanel voucherId={state.payment || null} onHide={() => update({ payment: null, page: state.page })} />
      <TransferPanel transferId={state.transfer || null} onHide={() => update({ transfer: null, page: state.page })} />
      <BankBatchDialog visible={batching} preselectedIds={selectedIds(rows, selection)} payeeType="Insurer" bankCode={batchState?.bankCode || null}
        layoutCode={batchState?.layout?.code || null} header={t("remittance.payments.batchDialog")} onHide={() => setBatching(false)} onCreated={onCreated} />
    </div>
  );
};

export default Payments;
