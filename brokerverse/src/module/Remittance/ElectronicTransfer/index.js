import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import remittanceService from "../../../services/remittanceService";
import { dateBody, downloadCsv, isoDate, loadInsurerOptions, showError, showSuccess, statusSeverity } from "../shared";
import "./index.scss";
import { promptText } from "../../../utility/dialogs";

const emptyTransfer = { method: null, amount: 0, beneficiary: null, accountNumber: "", bankName: "", purpose: "" };
const total = (rows) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);

const ElectronicTransfer = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const toast = useRef(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [form, setForm] = useState(emptyTransfer);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);
  const [transferMethods, setTransferMethods] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const [pending, history, queue] = await Promise.all([
        remittanceService.listTransfers({ status: "Pending,Approved", perPage: 200 }),
        remittanceService.listTransfers({ status: "Completed,Failed,Rejected", perPage: 200 }),
        remittanceService.listApprovals({ transactionType: "Electronic Transfer" })
      ]);
      setPendingTransfers(pending || []);
      setTransferHistory(history || []);
      setApprovals(queue || []);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
    remittanceService.transferMethods().then(setTransferMethods).catch((e) => showError(toast, e));
    loadInsurerOptions().then((rows) => setInsurers(rows.map((r) => ({ label: r.label, value: r.label, code: r.value })))).catch((e) => showError(toast, e));
  }, []);

  const today = isoDate(new Date());
  const all = [...pendingTransfers, ...transferHistory];
  const todays = all.filter((r) => isoDate(r.createdAt) === today);
  const awaitingApproval = pendingTransfers.filter((r) => r.status === "Pending");
  const processing = pendingTransfers.filter((r) => r.status === "Approved");
  const usedToday = total(todays.filter((r) => !["Failed", "Rejected"].includes(r.status)));

  const statusBodyTemplate = (rowData) => <Tag value={rowData.status} severity={statusSeverity(rowData.status)} />;

  const run = async (action, message) => {
    try {
      await action();
      showSuccess(toast, message);
      await loadTransfers();
    } catch (e) {
      showError(toast, e);
    }
  };

  const approvalFor = (row) => approvals.find((a) => a.entityId === row.id);

  const handleApprove = async (row) => {
    if (row.status === "Approved") {
      const bankReference = await promptText(t("remittance.reference"), "");
      if (bankReference === null) return;
      run(() => remittanceService.executeTransfer(row.id, { status: "Completed", bankReference }), `${row.reference} completed`);
      return;
    }
    const approval = approvalFor(row);
    if (!approval) return showError(toast, new Error(`No pending approval found for ${row.reference}`));
    run(() => remittanceService.approve(approval.id), `${row.reference} approved`);
  };

  const handleReject = async (row) => {
    const reason = await promptText(t("remittance.reason"), "");
    if (!reason) return;
    if (row.status === "Approved") {
      run(() => remittanceService.executeTransfer(row.id, { status: "Failed", failureReason: reason }), `${row.reference} marked as failed`);
      return;
    }
    const approval = approvalFor(row);
    if (!approval) return showError(toast, new Error(`No pending approval found for ${row.reference}`));
    run(() => remittanceService.reject(approval.id, reason), `${row.reference} rejected`);
  };

  const handleView = (row) => {
    toast.current.show({
      severity: "info",
      summary: row.reference,
      detail: [row.beneficiary, row.bankName, row.accountNumber, row.purpose].filter(Boolean).join(" | "),
      life: 6000
    });
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button icon="pi pi-check" className="p-button-rounded p-button-text" tooltip={t("remittance.approve", "Approve")} onClick={() => handleApprove(rowData)} aria-label={t("remittance.approve", "Approve")} />
        <Button icon="pi pi-times" className="p-button-rounded p-button-danger p-button-text" tooltip={t("common.reject", "Reject")} onClick={() => handleReject(rowData)} aria-label={t("common.reject", "Reject")} />
        <Button icon="pi pi-eye" className="p-button-rounded p-button-text" tooltip={t("remittance.view", "View")} onClick={() => handleView(rowData)} aria-label={t("remittance.view", "View")} />
      </div>
    );
  };

  const handleBatchProcess = async () => {
    if (!processing.length) {
      toast.current.show({ severity: "info", summary: t("remittance.batchProcess"), detail: "No approved transfers to process", life: 3000 });
      return;
    }
    run(() => Promise.all(processing.map((r) => remittanceService.executeTransfer(r.id, { status: "Completed" }))), `${processing.length} transfer(s) completed`);
  };

  const handleExport = () => {
    downloadCsv(`transfers_${today}.csv`, all, [
      { field: "reference", header: "Reference" },
      { field: "beneficiary", header: "Beneficiary" },
      { field: "amount", header: "Amount" },
      { field: "method", header: "Method" },
      { field: "date", header: "Date" },
      { field: "status", header: "Status" }
    ]);
  };

  const getMethodLimit = () => {
    const method = transferMethods.find(m => m.value === form.method);
    return method ? method.limit : 0;
  };

  const handleCreate = async () => {
    try {
      await remittanceService.createTransfer({ ...form, insurerCode: insurers.find((i) => i.value === form.beneficiary)?.code });
      showSuccess(toast, t("remittance.createTransfer"));
      setShowTransferDialog(false);
      setForm(emptyTransfer);
      loadTransfers();
    } catch (e) {
      showError(toast, e);
    }
  };

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const transferDialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" onClick={() => setShowTransferDialog(false)} className="p-button-text" />
      <Button label={t("remittance.createTransfer")} icon="pi pi-check" onClick={handleCreate} autoFocus
        disabled={!form.method || !form.beneficiary || !form.amount} />
    </div>
  );

  return (
    <div className="electronic-transfer">
      <Toast ref={toast} />
      <h2>{t("remittance.electronicTransferManagement")}</h2>

      <div className="summary-cards">
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.todaysTransfers")}</div>
            <div className="card-value">{todays.length}</div>
            <div className="card-detail">{t("remittance.total")}: {formatCurrency(total(todays))}</div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.pendingApproval", "Pending Approval")}</div>
            <div className="card-value">{awaitingApproval.length}</div>
            <div className="card-detail">{t("remittance.amount")}: {formatCurrency(total(awaitingApproval))}</div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.processing", "Processing")}</div>
            <div className="card-value">{processing.length}</div>
            <div className="card-detail">{t("remittance.amount")}: {formatCurrency(total(processing))}</div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.transferredToday")}</div>
            <div className="card-value">{formatCurrency(usedToday)}</div>
            <div className="card-detail">{t("remittance.transferLimitsNote")}</div>
          </div>
        </Card>
      </div>

      <Card title={t("remittance.pendingTransfers")} className="mt-4">
        <div className="toolbar mb-3">
          <Button label={t("remittance.newTransfer")} icon="pi pi-plus" onClick={() => setShowTransferDialog(true)} />
          <Button label={t("remittance.batchProcess")} icon="pi pi-forward" className="ml-2" onClick={handleBatchProcess} />
          <Button label={t("remittance.export")} icon="pi pi-download" className="p-button-secondary ml-2" onClick={handleExport} />
        </div>
        <DataTable value={pendingTransfers} stripedRows loading={loading}>
          <Column field="beneficiary" header={t("remittance.beneficiary")} />
          <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
          <Column field="method" header={t("remittance.method")} />
          <Column field="date" body={dateBody("date")} header={t("remittance.date")} />
          <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
          <Column header={t("remittance.actions")} body={actionBodyTemplate} style={{ width: '150px' }} />
        </DataTable>
      </Card>

      <Card title={t("remittance.transferHistory")} className="mt-4">
        <DataTable value={transferHistory} stripedRows loading={loading}>
          <Column field="reference" header={t("remittance.reference")} />
          <Column field="beneficiary" header={t("remittance.beneficiary")} />
          <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
          <Column field="method" header={t("remittance.method")} />
          <Column field="date" body={dateBody("date")} header={t("remittance.date")} />
          <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
        </DataTable>
      </Card>

      <Dialog
        header={t("remittance.createElectronicTransfer")}
        visible={showTransferDialog}
        style={{ width: '50vw' }}
        footer={transferDialogFooter}
        onHide={() => setShowTransferDialog(false)}
      >
        <div className="transfer-form">
          <div className="form-field">
            <label>{t("remittance.beneficiary")}</label>
            <Dropdown
              value={form.beneficiary}
              options={insurers}
              onChange={(e) => setField("beneficiary", e.value)}
              filter
              className="w-full"
            />
          </div>
          <div className="form-field">
            <label>{t("remittance.transferMethod")}</label>
            <Dropdown
              value={form.method}
              options={transferMethods}
              onChange={(e) => setField("method", e.value)}
              placeholder={t("remittance.selectMethod")}
              className="w-full"
            />
          </div>
          <div className="form-field">
            <label>{t("remittance.amount")}</label>
            <InputNumber
              value={form.amount}
              onValueChange={(e) => setField("amount", e.value)}
              mode="currency"
              currency={currencyCode}
              className="w-full"
            />
          </div>
          <div className="form-field">
            <label>Bank Name</label>
            <InputText value={form.bankName} onChange={(e) => setField("bankName", e.target.value)} className="w-full" />
          </div>
          <div className="form-field">
            <label>Account Number</label>
            <InputText value={form.accountNumber} onChange={(e) => setField("accountNumber", e.target.value)} className="w-full" />
          </div>
          <div className="form-field">
            <label>{t("remittance.description", "Purpose")}</label>
            <InputText value={form.purpose} onChange={(e) => setField("purpose", e.target.value)} className="w-full" />
          </div>
          {form.method && (
            <div className="method-info">
              <p>{t("remittance.dailyLimit")}: {formatCurrency(getMethodLimit())}</p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default ElectronicTransfer;
