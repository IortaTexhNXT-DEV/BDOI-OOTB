import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { ProgressBar } from "primereact/progressbar";
import { Card } from "primereact/card";
import { TabView, TabPanel } from "primereact/tabview";
import { Toast } from "primereact/toast";
import { Tag } from "primereact/tag";
import { BreadCrumb } from "primereact/breadcrumb";
import { reconciliationData, mockCrudOperations } from "../../../services/mockData/remittanceMockData";
import SvgDot from "../../../assets/icons/SvgDot";
import { useNavigate } from "react-router-dom";
import "./index.scss";

const ReconciliationProcess = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedBank, setSelectedBank] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState([]);
  const [matchCriteria, setMatchCriteria] = useState("Exact");
  const [tolerance, setTolerance] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load data from mock service
  const [rules, setRules] = useState(reconciliationData.rules);
  const [reconciliationStatus, setReconciliationStatus] = useState(reconciliationData.reconciliationSummary);

  // Mock settings based on reconciliation rules
  const currentRule = rules[0] || {};

  const bankTransactions = [
    { id: 1, transDate: "2025-09-20", reference: "REF001", amount: 5000.00, status: "matched" },
    { id: 2, transDate: "2025-09-21", reference: "REF002", amount: 7500.00, status: "unmatched" },
    { id: 3, transDate: "2025-09-22", reference: "REF003", amount: 3200.00, status: "matched" },
    { id: 4, transDate: "2025-09-23", reference: "REF004", amount: 9800.00, status: "partial" },
    { id: 5, transDate: "2025-09-24", reference: "REF005", amount: 4500.00, status: "unmatched" },
  ];

  const systemTransactions = [
    { id: 1, policyNo: "POL001", premium: 5000.00, transDate: "2025-09-20", reference: "SYS001", status: "matched" },
    { id: 2, policyNo: "POL002", premium: 3200.00, transDate: "2025-09-22", reference: "SYS002", status: "matched" },
    { id: 3, policyNo: "POL003", premium: 6700.00, transDate: "2025-09-23", reference: "SYS003", status: "unmatched" },
    { id: 4, policyNo: "POL004", premium: 4500.00, transDate: "2025-09-24", reference: "SYS004", status: "unmatched" },
    { id: 5, policyNo: "POL005", premium: 8900.00, transDate: "2025-09-25", reference: "SYS005", status: "unmatched" },
  ];

  const exceptions = [
    { id: 1, type: "Amount Mismatch", bankRef: "REF002", sysRef: "SYS003", difference: 800.00, action: "Review" },
    { id: 2, type: "Missing Policy", bankRef: "REF004", sysRef: "-", difference: 9800.00, action: "Hold" },
    { id: 3, type: "Date Mismatch", bankRef: "REF005", sysRef: "SYS004", difference: 0, action: "Auto-Resolve" },
  ];

  const matchCriteriaOptions = currentRule.matchingCriteria ?
    currentRule.matchingCriteria.map(criteria => ({
      label: criteria.matchType,
      value: criteria.matchType
    })) : [
    { label: "Exact", value: "Exact" },
    { label: "Within Tolerance", value: "Within Tolerance" },
    { label: "Within Range", value: "Within Range" }
  ];

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.reconciliationTitle"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const handleAutoMatch = async () => {
    setLoading(true);
    try {
      // Use mock CRUD operation for auto-matching
      const matchResult = await mockCrudOperations.create('auto_match', {
        criteria: matchCriteria,
        tolerance: tolerance,
        ruleCode: currentRule.code,
        timestamp: new Date().toISOString()
      });

      // Update reconciliation status
      const newMatched = reconciliationStatus.matched + selectedBank.length;
      const newUnmatched = reconciliationStatus.unmatched - selectedBank.length;

      setReconciliationStatus(prev => ({
        ...prev,
        matched: newMatched,
        unmatched: newUnmatched,
        successRate: ((newMatched / (newMatched + newUnmatched)) * 100).toFixed(1)
      }));

      toast.current.show({
        severity: 'success',
        summary: t("remittance.autoMatchComplete"),
        detail: t("remittance.autoMatchDetail", { count: selectedBank.length, criteria: matchCriteria }),
        life: 3000
      });

      setSelectedBank([]);
      setSelectedSystem([]);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Auto Match Failed',
        detail: error.message || 'Failed to perform auto matching',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMatchSelected = async () => {
    if (selectedBank.length === 0 || selectedSystem.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select items from both bank and system transactions',
        life: 3000
      });
      return;
    }

    setLoading(true);
    try {
      const matchRecord = {
        bankTransactions: selectedBank,
        systemTransactions: selectedSystem,
        matchType: 'manual',
        matchedBy: 'Current User',
        matchedAt: new Date().toISOString()
      };

      await mockCrudOperations.create('manual_match', matchRecord);

      toast.current.show({
        severity: 'success',
        summary: 'Match Successful',
        detail: `Manually matched ${selectedBank.length} bank and ${selectedSystem.length} system transactions`,
        life: 3000
      });

      setSelectedBank([]);
      setSelectedSystem([]);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Match Failed',
        detail: error.message || 'Failed to match selected transactions',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForceMatch = () => {
    if (window.confirm("Are you sure you want to force match with differences?")) {
      console.log("Force matching");
    }
  };

  const handleResolveException = (exception) => {
    console.log("Resolving exception:", exception);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const reportData = {
        period: new Date().toISOString().split('T')[0],
        totalTransactions: reconciliationStatus.totalRecords,
        matchRate: reconciliationStatus.successRate,
        matched: reconciliationStatus.matched,
        unmatched: reconciliationStatus.unmatched,
        partialMatch: reconciliationStatus.partialMatch,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Current User'
      };

      const result = await mockCrudOperations.create('reconciliation_report', reportData);

      toast.current.show({
        severity: 'success',
        summary: 'Report Generated',
        detail: `Reconciliation report generated with ID: ${result.id}`,
        life: 3000
      });
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Report Generation Failed',
        detail: error.message || 'Failed to generate reconciliation report',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const statusBodyTemplate = (rowData) => {
    const statusColors = {
      matched: "green",
      unmatched: "orange",
      partial: "blue"
    };
    return (
      <span style={{ color: statusColors[rowData.status] }}>
        <i className={`pi pi-${rowData.status === 'matched' ? 'check' : rowData.status === 'unmatched' ? 'exclamation-triangle' : 'info-circle'}`}></i>
      </span>
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <Button
        label="Resolve"
        className="p-button-sm p-button-outlined"
        onClick={() => handleResolveException(rowData)}
      />
    );
  };

  return (
    <div className="reconciliation-process">
      <Toast ref={toast} />
      <div className="header-section">
        <h1 className="page__title">{t("remittance.remittance")} {t("remittance.reconciliationTitle")}</h1>
        <BreadCrumb model={items} home={home} />
        <div className="status-cards">
          <Card className="status-card">
            <div className="status-label">Total Records</div>
            <div className="status-value">{reconciliationStatus.totalRecords}</div>
          </Card>
          <Card className="status-card">
            <div className="status-label">Matched</div>
            <div className="status-value" style={{ color: "green" }}>{reconciliationStatus.matched}</div>
          </Card>
          <Card className="status-card">
            <div className="status-label">Unmatched</div>
            <div className="status-value" style={{ color: "orange" }}>{reconciliationStatus.unmatched}</div>
          </Card>
          <Card className="status-card">
            <div className="status-label">Partial Match</div>
            <div className="status-value" style={{ color: "blue" }}>{reconciliationStatus.partialMatch}</div>
          </Card>
          <Card className="status-card">
            <div className="status-label">Success Rate</div>
            <div className="status-value" style={{ color: "green" }}>{reconciliationStatus.successRate}%</div>
            <ProgressBar value={reconciliationStatus.successRate} showValue={false} className="mt-1" />
          </Card>
        </div>
      </div>

      <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
        <TabPanel header={t("remittance.reconciliationTitle")}>
          <div className="reconciliation-workspace">
            <div className="left-panel">
              <div className="panel-header">
                <h4>Bank Transactions</h4>
                <div className="panel-actions">
                  <Button icon="pi pi-upload" className="p-button-sm" label="Import" />
                  <Button icon="pi pi-refresh" className="p-button-sm" />
                </div>
              </div>
              <DataTable
                value={bankTransactions}
                selection={selectedBank}
                onSelectionChange={(e) => setSelectedBank(e.value)}
                dataKey="id"
                size="small"
              >
                <Column selectionMode="multiple" style={{ width: '3em' }} />
                <Column field="transDate" header="Date" />
                <Column field="reference" header="Reference" />
                <Column field="amount" header="Amount" body={(data) => `\u20B1${data.amount.toFixed(2)}`} />
                <Column field="status" header="" body={statusBodyTemplate} style={{ width: '3em' }} />
              </DataTable>
            </div>

            <div className="center-panel">
              <div className="matching-controls">
                <h4>Matching Controls</h4>
                <div className="control-field">
                  <label>Match Criteria</label>
                  <Dropdown
                    value={matchCriteria}
                    options={matchCriteriaOptions}
                    onChange={(e) => setMatchCriteria(e.value)}
                    className="w-full"
                  />
                </div>
                {matchCriteria === 'Fuzzy' && (
                  <div className="control-field">
                    <label>Tolerance (%)</label>
                    <InputNumber
                      value={tolerance}
                      onValueChange={(e) => setTolerance(e.value)}
                      min={0}
                      max={10}
                      suffix="%"
                      className="w-full"
                    />
                  </div>
                )}
                <Button
                  label="Auto Match"
                  icon="pi pi-sparkles"
                  className="p-button-primary w-full"
                  onClick={handleAutoMatch}
                />
                <div className="selection-info">
                  <div>Selected Bank: {selectedBank.length}</div>
                  <div>Selected System: {selectedSystem.length}</div>
                  <div className="difference">Difference: {"\u20B1"}234.50</div>
                </div>
                <Button
                  label="Match Selected"
                  icon="pi pi-link"
                  className="p-button-success w-full"
                  onClick={handleMatchSelected}
                  disabled={selectedBank.length === 0 || selectedSystem.length === 0}
                />
                <Button
                  label="Force Match"
                  icon="pi pi-exclamation-triangle"
                  className="p-button-warning w-full"
                  onClick={handleForceMatch}
                  disabled={selectedBank.length === 0 || selectedSystem.length === 0}
                />
              </div>
            </div>

            <div className="right-panel">
              <div className="panel-header">
                <h4>System Transactions</h4>
                <div className="panel-actions">
                  <Button icon="pi pi-database" className="p-button-sm" label="Load" />
                  <Button icon="pi pi-filter" className="p-button-sm" />
                </div>
              </div>
              <DataTable
                value={systemTransactions}
                selection={selectedSystem}
                onSelectionChange={(e) => setSelectedSystem(e.value)}
                dataKey="id"
                size="small"
              >
                <Column selectionMode="multiple" style={{ width: '3em' }} />
                <Column field="policyNo" header="Policy" />
                <Column field="premium" header="Premium" body={(data) => `\u20B1${data.premium.toFixed(2)}`} />
                <Column field="transDate" header="Date" />
                <Column field="status" header="" body={statusBodyTemplate} style={{ width: '3em' }} />
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Exceptions">
          <div className="exceptions-section">
            <div className="toolbar mb-3">
              <Button label="Export Exceptions" icon="pi pi-download" className="p-button-sm" />
              <Button label="Resolve All" icon="pi pi-check" className="p-button-sm p-button-success" />
            </div>
            <DataTable value={exceptions} stripedRows>
              <Column field="type" header="Exception Type" />
              <Column field="bankRef" header="Bank Reference" />
              <Column field="sysRef" header="System Reference" />
              <Column field="difference" header="Difference" body={(data) => data.difference ? `\u20B1${data.difference.toFixed(2)}` : '-'} />
              <Column field="action" header="Suggested Action" />
              <Column body={actionBodyTemplate} header="Actions" style={{ width: '10rem' }} />
            </DataTable>
          </div>
        </TabPanel>

        <TabPanel header="History">
          <div className="history-section">
            <div className="toolbar mb-3">
              <Button label="Generate Report" icon="pi pi-file-pdf" className="p-button-sm" onClick={handleGenerateReport} />
            </div>
            <DataTable value={[]} emptyMessage="No reconciliation history available">
              <Column field="date" header="Date" />
              <Column field="period" header="Period" />
              <Column field="totalTransactions" header="Total Transactions" />
              <Column field="matchRate" header="Match Rate" />
              <Column field="exceptions" header="Exceptions" />
              <Column field="status" header="Status" />
            </DataTable>
          </div>
        </TabPanel>
      </TabView>
    </div>
  );
};

export default ReconciliationProcess;