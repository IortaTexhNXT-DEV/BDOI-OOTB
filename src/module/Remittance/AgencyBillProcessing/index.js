import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import "./index.scss";

const AgencyBillProcessing = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAgencies, setSelectedAgencies] = useState([]);
  const [billPeriod, setBillPeriod] = useState(new Date());
  const [billRunDate, setBillRunDate] = useState(new Date());
  const [billType, setBillType] = useState("Regular");

  const agencies = [
    { id: 1, agencyCode: "AG001", agencyName: "Premier Insurance Agency", agencyType: "Direct", policyCount: 125, grossPremium: 250000, commission: 31250, previousBalance: 5000, totalDue: 223750 },
    { id: 2, agencyCode: "AG002", agencyName: "Global Brokers Ltd", agencyType: "Broker", policyCount: 87, grossPremium: 180000, commission: 27000, previousBalance: -2000, totalDue: 155000 },
    { id: 3, agencyCode: "AG003", agencyName: "Corporate Solutions", agencyType: "Corporate", policyCount: 156, grossPremium: 420000, commission: 42000, previousBalance: 0, totalDue: 378000 },
    { id: 4, agencyCode: "AG004", agencyName: "ABC Bank Insurance", agencyType: "Bancassurance", policyCount: 234, grossPremium: 560000, commission: 47600, previousBalance: 12000, totalDue: 524400 }
  ];

  const agencyBills = [
    { agencyCode: "AG001", agencyName: "Premier Insurance Agency", billNumber: "BIL202509001", billDate: "2025-09-26", dueDate: "2025-10-26", billAmount: 223750, status: "Draft" },
    { agencyCode: "AG002", agencyName: "Global Brokers Ltd", billNumber: "BIL202509002", billDate: "2025-09-26", dueDate: "2025-11-10", billAmount: 155000, status: "Draft" },
    { agencyCode: "AG003", agencyName: "Corporate Solutions", billNumber: "BIL202509003", billDate: "2025-09-26", dueDate: "2025-11-25", billAmount: 378000, status: "Draft" }
  ];

  const adjustments = [
    { agencyName: "Premier Insurance Agency", type: "Credit Note", amount: -5000, reason: "Policy cancellation refund" },
    { agencyName: "Global Brokers Ltd", type: "Additional Charge", amount: 2500, reason: "Late payment charge" }
  ];

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Draft': return 'warning';
        case 'Generated': return 'success';
        case 'Sent': return 'info';
        default: return null;
      }
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  return (
    <div className="agency-bill-processing">
      <h2>{t("remittance.agencyBillProcessing")}</h2>

      <div className="header-section">
        <div className="p-fluid p-formgrid p-grid">
          <div className="p-field p-col-12 p-md-3">
            <label>{t("remittance.billPeriod")}</label>
            <Calendar value={billPeriod} onChange={(e) => setBillPeriod(e.value)} view="month" dateFormat="mm/yy" />
          </div>
          <div className="p-field p-col-12 p-md-3">
            <label>{t("remittance.billRunDate")}</label>
            <Calendar value={billRunDate} onChange={(e) => setBillRunDate(e.value)} dateFormat="yy-mm-dd" />
          </div>
          <div className="p-field p-col-12 p-md-3">
            <label>{t("remittance.billType")}</label>
            <Dropdown value={billType} options={[
              { label: t("remittance.regular"), value: "Regular" },
              { label: t("remittance.supplementary"), value: "Supplementary" },
              { label: t("remittance.adjustment"), value: "Adjustment" }
            ]} onChange={(e) => setBillType(e.value)} />
          </div>
          <div className="p-field p-col-12 p-md-3">
            <label>{t("remittance.status")}</label>
            <Tag value="Draft" severity="warning" style={{ marginTop: '1.5rem' }} />
          </div>
        </div>
      </div>

      <Card className="mt-4">
        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={t("remittance.selectAgencies")}>
            <div className="filter-section mb-3">
              <Dropdown placeholder={t("remittance.agencyType")} options={[
                { label: "All", value: "All" },
                { label: "Direct", value: "Direct" },
                { label: "Broker", value: "Broker" },
                { label: "Corporate", value: "Corporate" },
                { label: "Bancassurance", value: "Bancassurance" }
              ]} className="mr-2" />
              <Dropdown placeholder={t("remittance.region")} options={[
                { label: "All Regions", value: "All" },
                { label: "North", value: "North" },
                { label: "South", value: "South" },
                { label: "East", value: "East" },
                { label: "West", value: "West" }
              ]} className="mr-2" />
              <Button label={t("remittance.loadAgencies")} icon="pi pi-refresh" />
            </div>

            <DataTable
              value={agencies}
              selection={selectedAgencies}
              onSelectionChange={(e) => setSelectedAgencies(e.value)}
              dataKey="id"
              stripedRows
            >
              <Column selectionMode="multiple" style={{ width: '3rem' }} />
              <Column field="agencyCode" header={t("remittance.agencyCode")} />
              <Column field="agencyName" header={t("remittance.agencyName")} />
              <Column field="agencyType" header={t("remittance.type")} />
              <Column field="policyCount" header={t("remittance.policies")} />
              <Column field="grossPremium" header={t("remittance.grossPremium")} body={(data) => formatCurrency(data.grossPremium)} />
              <Column field="commission" header={t("remittance.commission")} body={(data) => formatCurrency(data.commission)} />
              <Column field="previousBalance" header={t("remittance.previousBalance")} body={(data) => formatCurrency(data.previousBalance)} />
              <Column field="totalDue" header={t("remittance.totalDue")} body={(data) => <strong>{formatCurrency(data.totalDue)}</strong>} />
            </DataTable>
          </TabPanel>

          <TabPanel header={t("remittance.billDetails")}>
            <div className="summary-cards mb-4">
              <Card className="summary-card">
                <div className="card-content">
                  <i className="pi pi-building" />
                  <div>
                    <div className="value">{selectedAgencies.length}</div>
                    <div className="label">{t("remittance.totalAgencies")}</div>
                  </div>
                </div>
              </Card>
              <Card className="summary-card">
                <div className="card-content">
                  <i className="pi pi-dollar" />
                  <div>
                    <div className="value">{formatCurrency(1410000)}</div>
                    <div className="label">{t("remittance.totalPremium")}</div>
                  </div>
                </div>
              </Card>
              <Card className="summary-card">
                <div className="card-content">
                  <i className="pi pi-percentage" />
                  <div>
                    <div className="value">{formatCurrency(147850)}</div>
                    <div className="label">{t("remittance.totalCommission")}</div>
                  </div>
                </div>
              </Card>
              <Card className="summary-card highlight">
                <div className="card-content">
                  <i className="pi pi-calculator" />
                  <div>
                    <div className="value">{formatCurrency(1280650)}</div>
                    <div className="label">{t("remittance.netPayable")}</div>
                  </div>
                </div>
              </Card>
            </div>

            <DataTable value={agencyBills} stripedRows>
              <Column field="agencyCode" header={t("remittance.agencyCode")} />
              <Column field="agencyName" header={t("remittance.agencyName")} />
              <Column field="billNumber" header={t("remittance.billNumber")} />
              <Column field="billDate" header={t("remittance.billDate")} />
              <Column field="dueDate" header={t("remittance.dueDate")} />
              <Column field="billAmount" header={t("remittance.billAmount")} body={(data) => formatCurrency(data.billAmount)} />
              <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
              <Column header={t("remittance.actions")} body={() => (
                <div className="action-buttons">
                  <Button icon="pi pi-eye" className="p-button-rounded p-button-text" tooltip={t("remittance.view")} />
                  <Button icon="pi pi-pencil" className="p-button-rounded p-button-text" tooltip={t("remittance.edit")} />
                  <Button icon="pi pi-print" className="p-button-rounded p-button-text" tooltip={t("remittance.print")} />
                </div>
              )} />
            </DataTable>
          </TabPanel>

          <TabPanel header={t("remittance.remittanceAdjustments")}>
            <div className="adjustment-form mb-4">
              <h4>{t("remittance.addAdjustment")}</h4>
              <div className="p-fluid p-formgrid p-grid">
                <div className="p-field p-col-12 p-md-6">
                  <label>{t("remittance.agencyName")}</label>
                  <Dropdown placeholder={t("remittance.selectAgency")} options={selectedAgencies.map(a => ({ label: a.agencyName, value: a.agencyCode }))} />
                </div>
                <div className="p-field p-col-12 p-md-6">
                  <label>{t("remittance.adjustmentType")}</label>
                  <Dropdown placeholder={t("remittance.selectType")} options={[
                    { label: "Credit Note", value: "Credit Note" },
                    { label: "Debit Note", value: "Debit Note" },
                    { label: "Refund", value: "Refund" },
                    { label: "Additional Charge", value: "Additional Charge" }
                  ]} />
                </div>
                <div className="p-field p-col-12 p-md-6">
                  <label>{t("remittance.amount")}</label>
                  <InputNumber mode="currency" currency={currencyCode} />
                </div>
                <div className="p-field p-col-12 p-md-6">
                  <label>{t("remittance.reason")}</label>
                  <InputTextarea rows={2} />
                </div>
              </div>
              <Button label={t("remittance.addAdjustmentButton")} icon="pi pi-plus" className="p-button-secondary" />
            </div>

            <DataTable value={adjustments} stripedRows>
              <Column field="agencyName" header={t("remittance.agency")} />
              <Column field="type" header={t("remittance.type")} />
              <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(Math.abs(data.amount))} />
              <Column field="reason" header={t("remittance.reason")} />
              <Column header="" body={() => <Button icon="pi pi-trash" className="p-button-rounded p-button-danger p-button-text" />} style={{ width: '60px' }} />
            </DataTable>
          </TabPanel>

          <TabPanel header={t("remittance.finalize")}>
            <div className="final-summary">
              <Card title={t("remittance.finalBillSummary")}>
                <table className="summary-table">
                  <tbody>
                    <tr>
                      <td>{t("remittance.totalGrossPremium")}</td>
                      <td className="text-right">{formatCurrency(1410000)}</td>
                    </tr>
                    <tr>
                      <td>{t("remittance.totalCommissionEarned")}</td>
                      <td className="text-right">-{formatCurrency(147850)}</td>
                    </tr>
                    <tr>
                      <td>{t("remittance.serviceTax")}</td>
                      <td className="text-right">-{formatCurrency(26613)}</td>
                    </tr>
                    <tr>
                      <td>{t("remittance.previousBalance")}</td>
                      <td className="text-right">{formatCurrency(15000)}</td>
                    </tr>
                    <tr>
                      <td>{t("remittance.adjustments")}</td>
                      <td className="text-right">-{formatCurrency(2500)}</td>
                    </tr>
                    <tr className="total-row">
                      <td><strong>{t("remittance.netAmountPayable")}</strong></td>
                      <td className="text-right"><strong>{formatCurrency(1248037)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </Card>

              <div className="processing-options mt-4">
                <h4>{t("remittance.processingOptions")}</h4>
                <div className="p-fluid p-formgrid p-grid">
                  <div className="p-field p-col-12 p-md-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={true} />
                      <label>{t("remittance.generateBills")}</label>
                    </div>
                  </div>
                  <div className="p-field p-col-12 p-md-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={false} />
                      <label>{t("remittance.sendToAgencies")}</label>
                    </div>
                  </div>
                  <div className="p-field p-col-12 p-md-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={true} />
                      <label>{t("remittance.createGLEntries")}</label>
                    </div>
                  </div>
                  <div className="p-field p-col-12 p-md-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={false} />
                      <label>{t("remittance.postToAccounts")}</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>

        <div className="action-bar mt-4">
          <Button label={t("remittance.saveDraft")} className="p-button-secondary mr-2" />
          <Button label={t("remittance.validate")} icon="pi pi-check" className="p-button-secondary mr-2" />
          <Button label={t("remittance.processBills")} icon="pi pi-forward" className="p-button-primary mr-2" />
          <Button label={t("common.cancel")} className="p-button-text" />
        </div>
      </Card>
    </div>
  );
};

export default AgencyBillProcessing;
