import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import "./index.scss";

const ElectronicTransfer = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [transferAmount, setTransferAmount] = useState(0);

  const pendingTransfers = [
    { id: 1, beneficiary: "ABC Insurance Co.", amount: 125000, method: "Wire", status: "Pending", date: "2025-09-26" },
    { id: 2, beneficiary: "XYZ Life Insurance", amount: 87500, method: "NEFT", status: "Processing", date: "2025-09-26" },
    { id: 3, beneficiary: "Global Health Ltd.", amount: 54300, method: "RTGS", status: "Approved", date: "2025-09-25" },
    { id: 4, beneficiary: "National General", amount: 98700, method: "IMPS", status: "Pending", date: "2025-09-25" },
  ];

  const transferHistory = [
    { id: 1, reference: "TRF20250920001", beneficiary: "Premier Life", amount: 156000, method: "Wire", status: "Completed", date: "2025-09-20" },
    { id: 2, reference: "TRF20250919002", beneficiary: "Safe Insurance", amount: 67800, method: "NEFT", status: "Completed", date: "2025-09-19" },
    { id: 3, reference: "TRF20250918003", beneficiary: "Trust Assurance", amount: 234500, method: "RTGS", status: "Failed", date: "2025-09-18" },
  ];

  const transferMethods = [
    { label: "NEFT", value: "NEFT", limit: 200000 },
    { label: "RTGS", value: "RTGS", limit: 10000000 },
    { label: "IMPS", value: "IMPS", limit: 500000 },
    { label: "Wire Transfer", value: "Wire", limit: 100000000 },
  ];

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Completed': return 'success';
        case 'Pending': return 'warning';
        case 'Processing': return 'info';
        case 'Approved': return 'success';
        case 'Failed': return 'danger';
        default: return null;
      }
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const actionBodyTemplate = () => {
    return (
      <div className="action-buttons">
        <Button icon="pi pi-check" className="p-button-rounded p-button-success p-button-text" tooltip={t("remittance.approve", "Approve")} />
        <Button icon="pi pi-times" className="p-button-rounded p-button-danger p-button-text" tooltip={t("common.reject", "Reject")} />
        <Button icon="pi pi-eye" className="p-button-rounded p-button-text" tooltip={t("remittance.view", "View")} />
      </div>
    );
  };

  const getMethodLimit = () => {
    if (!selectedMethod) return 0;
    const method = transferMethods.find(m => m.value === selectedMethod);
    return method ? method.limit : 0;
  };

  const transferDialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" onClick={() => setShowTransferDialog(false)} className="p-button-text" />
      <Button label={t("remittance.createTransfer")} icon="pi pi-check" onClick={() => setShowTransferDialog(false)} autoFocus />
    </div>
  );

  return (
    <div className="electronic-transfer">
      <h2>{t("remittance.electronicTransferManagement")}</h2>

      <div className="summary-cards">
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.todaysTransfers")}</div>
            <div className="card-value">12</div>
            <div className="card-detail">{t("remittance.total")}: {formatCurrency(567800)}</div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.pendingApproval", "Pending Approval")}</div>
            <div className="card-value">4</div>
            <div className="card-detail">{t("remittance.amount")}: {formatCurrency(312500)}</div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.processing", "Processing")}</div>
            <div className="card-value">2</div>
            <div className="card-detail">{t("remittance.amount")}: {formatCurrency(142300)}</div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-label">{t("remittance.dailyLimitUsed")}</div>
            <div className="card-value">35%</div>
            <div className="card-detail">{formatCurrency(3500000)} of {formatCurrency(10000000)}</div>
          </div>
        </Card>
      </div>

      <Card title={t("remittance.pendingTransfers")} className="mt-4">
        <div className="toolbar mb-3">
          <Button label={t("remittance.newTransfer")} icon="pi pi-plus" onClick={() => setShowTransferDialog(true)} />
          <Button label={t("remittance.batchProcess")} icon="pi pi-forward" className="p-button-success ml-2" />
          <Button label={t("remittance.export")} icon="pi pi-download" className="p-button-secondary ml-2" />
        </div>
        <DataTable value={pendingTransfers} stripedRows>
          <Column field="beneficiary" header={t("remittance.beneficiary")} />
          <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
          <Column field="method" header={t("remittance.method")} />
          <Column field="date" header={t("remittance.date")} />
          <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
          <Column header={t("remittance.actions")} body={actionBodyTemplate} style={{ width: '150px' }} />
        </DataTable>
      </Card>

      <Card title={t("remittance.transferHistory")} className="mt-4">
        <DataTable value={transferHistory} stripedRows>
          <Column field="reference" header={t("remittance.reference")} />
          <Column field="beneficiary" header={t("remittance.beneficiary")} />
          <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
          <Column field="method" header={t("remittance.method")} />
          <Column field="date" header={t("remittance.date")} />
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
            <label>{t("remittance.transferMethod")}</label>
            <Dropdown
              value={selectedMethod}
              options={transferMethods}
              onChange={(e) => setSelectedMethod(e.value)}
              placeholder={t("remittance.selectMethod")}
              className="w-full"
            />
          </div>
          <div className="form-field">
            <label>{t("remittance.amount")}</label>
            <InputNumber
              value={transferAmount}
              onValueChange={(e) => setTransferAmount(e.value)}
              mode="currency"
              currency={currencyCode}
              className="w-full"
            />
          </div>
          {selectedMethod && (
            <div className="method-info">
              <p>{t("remittance.dailyLimit")}: {formatCurrency(getMethodLimit())}</p>
              <p>{t("remittance.processingTime")}: Same Day</p>
              <p>{t("remittance.charges")}: 0.1% (Min {formatCurrency(2.50)})</p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default ElectronicTransfer;