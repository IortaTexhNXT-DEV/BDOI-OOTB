import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { InputNumber } from "primereact/inputnumber";
import { FileUpload } from "primereact/fileupload";
import "./index.scss";

const RemittanceExceptions = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const [selectedException, setSelectedException] = useState(null);
  const [resolutionData, setResolutionData] = useState({
    resolutionType: "",
    resolutionAmount: 0,
    resolutionNotes: ""
  });

  const exceptions = [
    { id: 1, severity: "Critical", exceptionId: "EXC001", type: "Amount Mismatch", remittanceNo: "REM20250926001", amount: 25000, age: 2, assignedTo: "John Smith", status: "New" },
    { id: 2, severity: "High", exceptionId: "EXC002", type: "Missing Document", remittanceNo: "REM20250926002", amount: 15000, age: 5, assignedTo: "Sarah Johnson", status: "In Progress" },
    { id: 3, severity: "Medium", exceptionId: "EXC003", type: "Duplicate Entry", remittanceNo: "REM20250925003", amount: 8500, age: 1, assignedTo: "", status: "New" },
    { id: 4, severity: "Low", exceptionId: "EXC004", type: "Date Discrepancy", remittanceNo: "REM20250925004", amount: 3200, age: 3, assignedTo: "Mike Wilson", status: "Resolved" }
  ];

  const severityBodyTemplate = (rowData) => {
    const getSeverity = (severity) => {
      switch (severity) {
        case 'Critical': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        case 'Low': return 'success';
        default: return null;
      }
    };
    return <Tag value={rowData.severity} severity={getSeverity(rowData.severity)} />;
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Resolved': return 'success';
        case 'In Progress': return 'warning';
        case 'New': return 'danger';
        case 'Escalated': return 'info';
        default: return null;
      }
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button icon="pi pi-play" className="p-button-rounded p-button-text" tooltip={t("remittance.start")} disabled={rowData.status !== 'New'} />
        <Button icon="pi pi-check" className="p-button-rounded p-button-success p-button-text" tooltip={t("remittance.resolve")} disabled={rowData.status !== 'In Progress'} />
        <Button icon="pi pi-arrow-up" className="p-button-rounded p-button-warning p-button-text" tooltip={t("remittance.escalate")} />
      </div>
    );
  };

  return (
    <div className="remittance-exceptions">
      <h2>{t("remittance.remittanceExceptions")}</h2>

      <div className="summary-bar">
        <div className="summary-item">
          <i className="pi pi-exclamation-triangle" />
          <div>
            <div className="value">15</div>
            <div className="label">{t("remittance.totalExceptions")}</div>
          </div>
        </div>
        <div className="summary-item red">
          <i className="pi pi-clock" />
          <div>
            <div className="value">8</div>
            <div className="label">{t("remittance.unresolved")}</div>
          </div>
        </div>
        <div className="summary-item orange">
          <i className="pi pi-spin pi-spinner" />
          <div>
            <div className="value">4</div>
            <div className="label">{t("remittance.processing")}</div>
          </div>
        </div>
        <div className="summary-item green">
          <i className="pi pi-check-circle" />
          <div>
            <div className="value">3</div>
            <div className="label">{t("remittance.resolvedToday")}</div>
          </div>
        </div>
        <div className="summary-item highlight">
          <i className="pi pi-dollar" />
          <div>
            <div className="value">{formatCurrency(51700)}</div>
            <div className="label">{t("remittance.totalValueAtRisk")}</div>
          </div>
        </div>
      </div>

      <div className="split-view">
        <Card title={t("remittance.exceptionList")} className="left-panel">
          <div className="filter-section mb-3">
            <Dropdown placeholder={t("remittance.exceptionType")} options={[
              { label: "All", value: "All" },
              { label: "Amount Mismatch", value: "Amount Mismatch" },
              { label: "Missing Document", value: "Missing Document" },
              { label: "Duplicate Entry", value: "Duplicate Entry" },
              { label: "Date Discrepancy", value: "Date Discrepancy" }
            ]} className="mr-2" />
            <Dropdown placeholder={t("remittance.severity")} options={[
              { label: "All", value: "All" },
              { label: "Critical", value: "Critical" },
              { label: "High", value: "High" },
              { label: "Medium", value: "Medium" },
              { label: "Low", value: "Low" }
            ]} className="mr-2" />
            <Dropdown placeholder={t("remittance.status")} options={[
              { label: "All", value: "All" },
              { label: "New", value: "New" },
              { label: "In Progress", value: "In Progress" },
              { label: "Resolved", value: "Resolved" },
              { label: "Escalated", value: "Escalated" }
            ]} />
          </div>

          <DataTable
            value={exceptions}
            selection={selectedException}
            onSelectionChange={(e) => setSelectedException(e.value)}
            selectionMode="single"
            dataKey="id"
            stripedRows
          >
            <Column field="severity" header="" body={severityBodyTemplate} style={{ width: '5%' }} />
            <Column field="exceptionId" header="ID" />
            <Column field="type" header={t("remittance.type")} />
            <Column field="remittanceNo" header={t("remittance.referenceNo")} />
            <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
            <Column field="age" header={t("remittance.age")} body={(data) => `${data.age}d`} />
            <Column field="assignedTo" header={t("remittance.delegatedTo")} />
            <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
            <Column header="" body={actionsBodyTemplate} style={{ width: '10%' }} />
          </DataTable>
        </Card>

        <Card title={t("remittance.exceptionDetails")} className="right-panel">
          {selectedException ? (
            <div className="exception-details">
              <div className="detail-section">
                <h4>{t("remittance.exceptionInformation")}</h4>
                <div className="detail-item">
                  <label>Exception ID:</label>
                  <span>{selectedException.exceptionId}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.type")}:</label>
                  <span>{selectedException.type}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.severity")}:</label>
                  <Tag value={selectedException.severity} severity={selectedException.severity.toLowerCase()} />
                </div>
                <div className="detail-item">
                  <label>{t("remittance.created")}:</label>
                  <span>2025-09-24 10:30</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.dueBy")}:</label>
                  <span className="highlight">2025-09-28 10:30</span>
                </div>
              </div>

              <div className="detail-section">
                <h4>{t("remittance.transactionDetails")}</h4>
                <div className="detail-item">
                  <label>{t("remittance.referenceNo")}:</label>
                  <span>{selectedException.remittanceNo}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.expectedAmount")}:</label>
                  <span>{formatCurrency(selectedException.amount)}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.actualAmount")}:</label>
                  <span>{formatCurrency(selectedException.amount * 0.95)}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.difference")}:</label>
                  <span className="highlight">{formatCurrency(selectedException.amount * 0.05)}</span>
                </div>
              </div>

              <div className="detail-section">
                <h4>{t("remittance.resolution")}</h4>
                <div className="p-fluid">
                  <div className="p-field">
                    <label>{t("remittance.resolutionType")} *</label>
                    <Dropdown
                      value={resolutionData.resolutionType}
                      options={[
                        { label: "Manual Adjustment", value: "Manual Adjustment" },
                        { label: "Write-off", value: "Write-off" },
                        { label: "Create Credit Note", value: "Create Credit Note" },
                        { label: "Create Debit Note", value: "Create Debit Note" },
                        { label: "Reverse Transaction", value: "Reverse Transaction" }
                      ]}
                      onChange={(e) => setResolutionData({ ...resolutionData, resolutionType: e.value })}
                      placeholder={t("remittance.selectResolutionType")}
                    />
                  </div>
                  <div className="p-field">
                    <label>{t("remittance.resolutionAmount")} *</label>
                    <InputNumber
                      value={resolutionData.resolutionAmount}
                      onValueChange={(e) => setResolutionData({ ...resolutionData, resolutionAmount: e.value })}
                      mode="currency"
                      currency={currencyCode}
                    />
                  </div>
                  <div className="p-field">
                    <label>{t("remittance.resolutionNotes")} *</label>
                    <InputTextarea
                      value={resolutionData.resolutionNotes}
                      onChange={(e) => setResolutionData({ ...resolutionData, resolutionNotes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="p-field">
                    <label>{t("remittance.attachments")}</label>
                    <FileUpload mode="basic" multiple accept=".pdf,.jpg,.png,.doc" />
                  </div>
                </div>

                <div className="action-buttons mt-3">
                  <Button label={t("remittance.saveProgress")} className="p-button-secondary mr-2" />
                  <Button label={t("remittance.resolveException")} className="p-button-success mr-2" />
                  <Button label={t("remittance.escalate")} className="p-button-warning" />
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>{t("remittance.selectExceptionToView")}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="action-bar">
        <Button label={t("remittance.exportExceptions")} icon="pi pi-download" className="p-button-secondary mr-2" />
        <Button label={t("remittance.bulkAssign")} icon="pi pi-users" className="p-button-secondary mr-2" disabled={!selectedException} />
        <Button label={t("remittance.createReport")} icon="pi pi-file" className="p-button-primary" />
      </div>
    </div>
  );
};

export default RemittanceExceptions;