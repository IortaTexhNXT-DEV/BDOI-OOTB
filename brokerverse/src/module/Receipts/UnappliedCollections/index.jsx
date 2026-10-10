import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import LoadState from "../../../components/LoadState";
import DateField from "../../../components/DateField";
import FieldError from "../../../components/FieldError";
import DetailDialog from "../../../components/DetailDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { openConfirm } from "../../../components/ConfirmDialog";
import { RecordActivityLog } from "../../../components/ActivityLog";
import receiptsService from "../../../services/receiptsService";
import { hasPermission } from "../../../utils/canOpen";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import { showErrorMessage, showSuccessMessage } from "../../../utility/toastUtils";
import { allocationProblem, unappliedActions } from "./model";

const STATUS_FILTERS = ["open", "allocated", "refunded", "reversed"];
const KINDS = ["excess", "floating", "advance"];
const SEVERITY = { open: "warning", allocated: "success", refunded: "info", reversed: "secondary" };
const PERMS = ["write:receipts", "reverse:receipts"];
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const errorOf = (e) => e?.response?.data?.errors?.[0]?.message || e?.response?.data?.message || e.message;

/**
 * Accounts > Unapplied Collections: money received that no bill takes yet (an excess payment held On Account, a
 * floating bank credit, an advance before the bill), each to be allocated by its date; allocated to open bills,
 * refunded to the client with a reason, or (a floating or advance payment recorded in error) reversed.
 */
const UnappliedCollections = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: "open", kind: null, search: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [allocating, setAllocating] = useState(null);
  const [recording, setRecording] = useState(null);
  const perms = PERMS.filter((p) => hasPermission(p));

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await receiptsService.listUnapplied({ status: filters.status || undefined, kind: filters.kind || undefined, search: filters.search || undefined }));
    } catch (e) {
      setError(errorOf(e));
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const openItem = useCallback(async (id) => {
    try {
      setViewing(await receiptsService.getUnapplied(id));
    } catch (e) {
      showErrorMessage(errorOf(e));
    }
  }, []);
  const linked = params.get("item");
  useEffect(() => {
    if (linked) openItem(linked);
  }, [linked, openItem]);
  const closeView = () => {
    setViewing(null);
    if (linked) setParams({});
  };

  const done = (message) => {
    showSuccessMessage(message);
    setViewing(null);
    load();
  };

  const startAllocate = async (row) => {
    try {
      const bills = await receiptsService.getOpenReceivables(row.clientCode ? { customerCode: row.clientCode } : { limit: 200 });
      setAllocating({ row, search: "", lines: bills.map((b) => ({ ...b, billBalance: b.balance, amount: null })) });
    } catch (e) {
      showErrorMessage(errorOf(e));
    }
  };
  const searchBills = async () => {
    try {
      const bills = await receiptsService.getOpenReceivables({ search: allocating.search });
      setAllocating({ ...allocating, lines: bills.map((b) => ({ ...b, billBalance: b.balance, amount: null })) });
    } catch (e) {
      showErrorMessage(errorOf(e));
    }
  };
  const allocate = async () => {
    try {
      const r = await receiptsService.allocateUnapplied(allocating.row.id, allocating.lines.filter((l) => Number(l.amount) > 0).map((l) => ({ receivableId: l.receivableId, amount: l.amount })));
      setAllocating(null);
      done(r.message);
    } catch (e) {
      showErrorMessage(errorOf(e));
    }
  };

  const act = async (code, row) => {
    if (code === "view") openItem(row.id);
    if (code === "allocate") startAllocate(row);
    if (code === "refund") {
      const reason = await openConfirm({ title: t("unapplied.refundTitle", { amount: formatCurrency(row.balance) }), severity: "warning", message: t("unapplied.refundMessage"),
        reason: { context: "unapplied_refund", label: t("unapplied.refundReason") }, confirmLabel: t("unapplied.refund") });
      if (reason) receiptsService.refundUnapplied(row.id, reason).then((r) => done(r.message)).catch((e) => showErrorMessage(errorOf(e)));
    }
    if (code === "reverse") {
      const reason = await openConfirm({ title: t("unapplied.reverseTitle"), severity: "danger", message: t("unapplied.reverseMessage"),
        reason: { context: "receipt_reversal", label: t("unapplied.reverseReason") }, confirmLabel: t("unapplied.reverse") });
      if (reason) receiptsService.reverseUnapplied(row.id, reason).then((r) => done(r.message)).catch((e) => showErrorMessage(errorOf(e)));
    }
  };

  const record = async () => {
    try {
      const r = await receiptsService.recordUnapplied({ ...recording, customerCode: recording.customerCode || undefined, payerName: recording.payerName || undefined });
      setRecording(null);
      done(r.message);
    } catch (e) {
      showErrorMessage(errorOf(e));
    }
  };

  const summary = data?.summary;
  const problem = allocating ? allocationProblem(allocating.lines, allocating.row.balance) : null;
  const allocTotal = allocating ? allocating.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0;
  const kindOptions = KINDS.map((k) => ({ value: k, label: t(`unapplied.kinds.${k}`) }));

  return (
    <div className="p-3">
      <PageHeader title={t("unapplied.title")} home={t("sidebar.Accounts", "Accounts")} section={t("sidebar.Receipts", "Receipts")} help={t("unapplied.help")}
        actions={perms.includes("write:receipts") ? (
          <Button label={t("unapplied.record")} icon="pi pi-plus" onClick={() => setRecording({ kind: "floating", amount: null, receivedDate: todayIso(), paymentMode: "bank-transfer", referenceNo: "", customerCode: "", payerName: "", remarks: "" })} />
        ) : null} />
      <StatCards items={[
        { key: "open", label: t("unapplied.kpis.open"), value: summary ? String(summary.open) : null },
        { key: "amount", label: t("unapplied.kpis.amount"), value: summary ? formatCurrency(summary.openAmount) : null },
        { key: "overdue", label: t("unapplied.kpis.overdue"), value: summary ? String(summary.overdue) : null },
      ]} />
      <div className="flex flex-wrap gap-2 align-items-end my-3">
        <Dropdown value={filters.status} options={STATUS_FILTERS.map((s) => ({ value: s, label: t(`unapplied.statuses.${s}`) }))} onChange={(e) => setFilters({ ...filters, status: e.value })}
          showClear placeholder={t("unapplied.allStatuses")} aria-label={t("unapplied.status")} />
        <Dropdown value={filters.kind} options={kindOptions} onChange={(e) => setFilters({ ...filters, kind: e.value })} showClear placeholder={t("unapplied.allKinds")} aria-label={t("unapplied.kind")} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("unapplied.search")} aria-label={t("unapplied.search")}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </span>
      </div>
      <LoadState loading={!data && !error} error={error} onRetry={load}>
        <DataTable value={data?.rows || []} dataKey="id" size="small" paginator rows={20} emptyMessage={t("unapplied.empty")}>
          <Column header={t("unapplied.received")} body={(r) => formatDate(r.receivedDate)} />
          <Column header={t("unapplied.kind")} body={(r) => r.kindText} />
          <Column header={t("unapplied.reference")} body={(r) => r.receiptNumber || r.referenceNo || "—"} />
          <Column header={t("unapplied.client")} body={(r) => r.clientName || "—"} />
          <Column header={t("unapplied.policy")} body={(r) => r.policyNumber || "—"} />
          <Column header={t("unapplied.amount")} body={(r) => formatCurrency(r.amount)} className="text-right" headerClassName="text-right" />
          <Column header={t("unapplied.balance")} body={(r) => formatCurrency(r.balance)} className="text-right" headerClassName="text-right" />
          <Column header={t("unapplied.allocateBy")} body={(r) => (
            <span>
              {formatDate(r.allocateBy)}
              {r.overdue ? <StatusChip label={t("unapplied.overdue")} severity="danger" className="ml-2" /> : null}
            </span>
          )} />
          <Column header={t("unapplied.status")} body={(r) => <StatusChip code={r.status} label={t(`unapplied.statuses.${r.status}`)} severity={SEVERITY[r.status]} />} />
          <Column body={(r) => (
            <RowActions label={t("unapplied.actionsFor", { reference: r.receiptNumber || r.referenceNo || r.kindText })}
              actions={unappliedActions(r, perms).map((a) => ({ ...a, label: t(`unapplied.menu.${a.code}`) }))} onAction={(a) => act(a.code, r)} />
          )} />
        </DataTable>
      </LoadState>

      <DetailDialog visible={!!viewing} onHide={closeView} header={t("unapplied.viewTitle")} size="md">
        {viewing ? (
          <>
            <DetailHeader title={viewing.receiptNumber || viewing.referenceNo || viewing.kindText} subtitle={viewing.clientName}
              status={{ code: viewing.status, label: t(`unapplied.statuses.${viewing.status}`) }}
              meta={[{ label: t("unapplied.amount"), value: viewing.amount, type: "amount" }, { label: t("unapplied.balance"), value: viewing.balance, type: "amount" },
                { label: t("unapplied.allocateBy"), value: viewing.allocateBy, type: "date" }]} />
            <DetailSection title={t("unapplied.details")}>
              <KeyValueGrid columns={3} items={[
                { label: t("unapplied.kind"), value: viewing.kindText }, { label: t("unapplied.received"), value: viewing.receivedDate, type: "date" },
                { label: t("unapplied.policy"), value: viewing.policyNumber }, { label: t("unapplied.reference"), value: viewing.referenceNo },
                { label: t("unapplied.refundReason"), value: viewing.refundReason, hidden: !viewing.refundReason }, { label: t("unapplied.remarks"), value: viewing.remarks, hidden: !viewing.remarks },
              ]} />
            </DetailSection>
            <DetailSection title={t("unapplied.allocations")} flush>
              <DataTable value={viewing.allocations} size="small" emptyMessage={t("unapplied.noAllocations")}>
                <Column field="billNumber" header={t("unapplied.bill")} />
                <Column field="policyNumber" header={t("unapplied.policy")} />
                <Column header={t("unapplied.amount")} body={(a) => formatCurrency(a.amount)} className="text-right" headerClassName="text-right" />
                <Column header={t("unapplied.allocatedOn")} body={(a) => formatDate(a.allocatedAt)} />
                <Column field="allocatedBy" header={t("unapplied.allocatedBy")} />
              </DataTable>
            </DetailSection>
            <DetailSection title={t("unapplied.activity")}><RecordActivityLog entity="unapplied_collection" recordId={viewing.id} /></DetailSection>
          </>
        ) : null}
      </DetailDialog>

      <Dialog header={t("unapplied.allocateTitle", { amount: allocating ? formatCurrency(allocating.row.balance) : "" })} visible={!!allocating} onHide={() => setAllocating(null)}
        style={{ width: "56rem" }} breakpoints={{ "960px": "95vw" }}
        footer={(
          <div className="flex justify-content-between align-items-center">
            <span>{t("unapplied.allocTotal", { total: formatCurrency(allocTotal) })}</span>
            <span className="flex gap-2">
              <Button label={t("unapplied.cancel")} text onClick={() => setAllocating(null)} />
              <Button label={t("unapplied.allocate")} icon="pi pi-check" disabled={!!problem} onClick={allocate} />
            </span>
          </div>
        )}>
        {allocating ? (
          <>
            {!allocating.row.clientCode ? (
              <div className="flex gap-2 mb-2">
                <InputText value={allocating.search} placeholder={t("unapplied.searchBills")} aria-label={t("unapplied.searchBills")} className="flex-1"
                  onChange={(e) => setAllocating({ ...allocating, search: e.target.value })} />
                <Button label={t("unapplied.find")} icon="pi pi-search" outlined onClick={searchBills} />
              </div>
            ) : null}
            <DataTable value={allocating.lines} dataKey="receivableId" size="small" scrollable scrollHeight="22rem" emptyMessage={t("unapplied.noBills")}>
              <Column field="billNumber" header={t("unapplied.bill")} />
              <Column field="policyNumber" header={t("unapplied.policy")} />
              <Column field="customerName" header={t("unapplied.client")} />
              <Column header={t("unapplied.dueDate")} body={(l) => formatDate(l.dueDate)} />
              <Column header={t("unapplied.billBalance")} body={(l) => formatCurrency(l.billBalance)} className="text-right" headerClassName="text-right" />
              <Column header={t("unapplied.allocateAmount")} body={(l, { rowIndex }) => (
                <InputNumber value={l.amount} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} inputClassName="w-8rem text-right"
                  aria-label={t("unapplied.allocateAmountFor", { bill: l.billNumber })}
                  onValueChange={(e) => setAllocating({ ...allocating, lines: allocating.lines.map((x, j) => (j === rowIndex ? { ...x, amount: e.value } : x)) })} />
              )} />
            </DataTable>
            <FieldError error={problem && problem !== "chooseBill" ? t(`unapplied.problems.${problem}`) : null} />
          </>
        ) : null}
      </Dialog>

      <Dialog header={t("unapplied.record")} visible={!!recording} onHide={() => setRecording(null)} style={{ width: "40rem" }} breakpoints={{ "640px": "95vw" }}
        footer={(
          <div className="flex justify-content-end gap-2">
            <Button label={t("unapplied.cancel")} text onClick={() => setRecording(null)} />
            <Button label={t("unapplied.save")} icon="pi pi-check" disabled={!recording?.amount || (recording?.kind === "advance" && !recording?.customerCode)} onClick={record} />
          </div>
        )}>
        {recording ? (
          <div className="grid">
            <div className="col-12 md:col-6">
              <label className="bv-field-label" htmlFor="uac-kind">{t("unapplied.kind")}<span className="required-marker">*</span></label>
              <Dropdown inputId="uac-kind" className="w-full" value={recording.kind} options={kindOptions.filter((o) => o.value !== "excess")}
                onChange={(e) => setRecording({ ...recording, kind: e.value })} />
            </div>
            <div className="col-12 md:col-6">
              <label className="bv-field-label" htmlFor="uac-amount">{t("unapplied.amount")}<span className="required-marker">*</span></label>
              <InputNumber inputId="uac-amount" className="w-full" value={recording.amount} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0}
                onValueChange={(e) => setRecording({ ...recording, amount: e.value })} />
            </div>
            <div className="col-12 md:col-6">
              <label className="bv-field-label" htmlFor="uac-date">{t("unapplied.received")}<span className="required-marker">*</span></label>
              <DateField id="uac-date" value={recording.receivedDate} max={todayIso()} onChange={(e) => setRecording({ ...recording, receivedDate: e.target.value })} />
            </div>
            <div className="col-12 md:col-6">
              <label className="bv-field-label" htmlFor="uac-ref">{t("unapplied.reference")}</label>
              <InputText id="uac-ref" className="w-full" value={recording.referenceNo} onChange={(e) => setRecording({ ...recording, referenceNo: e.target.value })} />
            </div>
            <div className="col-12 md:col-6">
              <label className="bv-field-label" htmlFor="uac-client">{t("unapplied.clientCode")}{recording.kind === "advance" ? <span className="required-marker">*</span> : null}</label>
              <InputText id="uac-client" className="w-full" value={recording.customerCode} onChange={(e) => setRecording({ ...recording, customerCode: e.target.value })} />
            </div>
            <div className="col-12 md:col-6">
              <label className="bv-field-label" htmlFor="uac-payer">{t("unapplied.payer")}</label>
              <InputText id="uac-payer" className="w-full" value={recording.payerName} onChange={(e) => setRecording({ ...recording, payerName: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="bv-field-label" htmlFor="uac-remarks">{t("unapplied.remarks")}</label>
              <InputText id="uac-remarks" className="w-full" value={recording.remarks} onChange={(e) => setRecording({ ...recording, remarks: e.target.value })} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default UnappliedCollections;
