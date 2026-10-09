import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { ProgressBar } from "primereact/progressbar";
import { Card } from "primereact/card";
import { TabView, TabPanel } from "primereact/tabview";
import { Toast } from "primereact/toast";
import { BreadCrumb } from "primereact/breadcrumb";
import remittanceService from "../../../services/remittanceService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { dateBody, downloadCsv, isoDate, loadSettings, showError, showSuccess } from "../shared";
import SvgDot from "../../../assets/icons/SvgDot";
import "./index.scss";
import { progressValue, roundTo } from "../../../utility/numberFormat";
import { confirmAction, promptText } from "../../../utility/dialogs";
import importService from "../../../services/importService";

const emptyRecon = { bankTransactions: [], systemTransactions: [], exceptions: [], summary: { total: 0, matched: 0, unmatched: 0, partial: 0, successRate: 0 } };

/** Parses a bank statement CSV (header row with transDate/date, reference, amount, description). */
const parseBankCsv = (text) => {
  // a CSV saved by Excel as UTF-8 starts with a byte order mark
  const [head, ...lines] = text.replace(/^\ufeff/, "").split(/\r?\n/).filter((l) => l.trim());
  const cols = (head || "").split(",").map((c) => c.trim().toLowerCase());
  const at = (names) => cols.findIndex((c) => names.includes(c));
  const idx = { transDate: at(["transdate", "date", "transaction date"]), reference: at(["reference", "ref"]), amount: at(["amount"]), description: at(["description", "narration"]) };
  return lines.map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    // the amount is sent as written: the server refuses the file when a line has none
    return { transDate: cells[idx.transDate], reference: cells[idx.reference], amount: cells[idx.amount], description: idx.description >= 0 ? cells[idx.description] : "" };
  });
};

const ReconciliationProcess = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const fileInput = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedBank, setSelectedBank] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState([]);
  const [matchCriteria, setMatchCriteria] = useState("Exact");
  const [tolerance, setTolerance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [recon, setRecon] = useState(emptyRecon);

  const { bankTransactions, exceptions } = recon;
  const systemTransactions = unmatchedOnly ? recon.systemTransactions.filter((s) => s.status === "unmatched") : recon.systemTransactions;
  const reconciliationStatus = {
    totalRecords: recon.summary.total,
    matched: recon.summary.matched,
    unmatched: recon.summary.unmatched,
    partialMatch: recon.summary.partial,
    successRate: recon.summary.successRate
  };

  // the tolerance is the remittance.reconciliation_tolerance setting (Master > Configuration); it may be changed per run
  const matchCriteriaOptions = [
    { label: "Exact", value: "Exact" },
    { label: "Within Tolerance", value: "Within Tolerance" }
  ];

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.reconciliationTitle"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const loadReconciliation = async () => {
    setLoading(true);
    try {
      setRecon(await remittanceService.reconciliation());
      setSelectedBank([]);
      setSelectedSystem([]);
    } catch (error) {
      showError(toast, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliation();
    loadSettings()
      .then((s) => setTolerance(Number(s["remittance.reconciliation_tolerance"] ?? 0)))
      .catch((e) => showError(toast, e));
  }, []);

  const toleranceFor = () => {
    if (matchCriteria === "Exact") return 0;
    if (matchCriteria === "Within Tolerance") return tolerance;
    return undefined;
  };

  const run = async (action, summary, detail) => {
    setLoading(true);
    try {
      const result = await action();
      showSuccess(toast, typeof detail === "function" ? detail(result) : detail, summary);
      await loadReconciliation();
    } catch (error) {
      // the summary names the action as done ("Import Complete"); a failure keeps the error heading
      showError(toast, error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = () => run(
    () => remittanceService.autoMatch(toleranceFor()),
    t("remittance.autoMatchComplete"),
    (r) => t("remittance.autoMatchDetail", { count: r.matched, criteria: matchCriteria })
  );

  const pairs = () => selectedBank.slice(0, selectedSystem.length).map((b, i) => [b, selectedSystem[i]]);

  const handleMatchSelected = () => {
    if (selectedBank.length === 0 || selectedSystem.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select items from both bank and system transactions',
        life: 3000
      });
      return;
    }
    run(
      () => Promise.all(pairs().map(([b, s]) => remittanceService.match(b.id, s.id))),
      'Match Successful',
      (results) => `Matched ${results.length} pair(s): ${results.map((r) => r.status).join(", ")}`
    );
  };

  const handleForceMatch = async () => {
    if (!(await confirmAction("Are you sure you want to force match with differences?"))) return;
    run(
      () => Promise.all(pairs().map(([b, s]) => remittanceService.match(b.id, s.id))),
      'Force Match',
      (results) => `Matched ${results.length} pair(s); differences were logged as exceptions`
    );
  };

  const handleResolveException = async (exception) => {
    const resolution = await promptText(`Resolution for ${exception.bankRef}`, "");
    if (!resolution) return;
    run(() => remittanceService.resolveException(exception.id, resolution), 'Exception Resolved', `${exception.type} resolved`);
  };

  const handleResolveAll = async () => {
    if (!exceptions.length) return;
    const resolution = await promptText(`Resolution for ${exceptions.length} exception(s)`, "");
    if (!resolution) return;
    run(() => Promise.all(exceptions.map((e) => remittanceService.resolveException(e.id, resolution))), 'Exceptions Resolved', `${exceptions.length} exception(s) resolved`);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const transactions = parseBankCsv(await file.text());
    run(() => remittanceService.importBankTransactions(transactions), 'Import Complete', (rows) => `${rows.length} bank transaction(s) imported`);
  };

  const handleExportExceptions = () => {
    downloadCsv(`reconciliation_exceptions_${isoDate(new Date())}.csv`, exceptions, [
      { field: "type", header: "Exception Type" },
      { field: "bankRef", header: "Bank Reference" },
      { field: "sysRef", header: "System Reference" },
      { field: "difference", header: "Difference" },
      { field: "action", header: "Suggested Action" },
      { field: "status", header: "Status" }
    ]);
  };

  const handleGenerateReport = () => {
    downloadCsv(`reconciliation_${isoDate(new Date())}.csv`, bankTransactions, [
      { field: "transDate", header: "Date" },
      { field: "reference", header: "Bank Reference" },
      { field: "description", header: "Description" },
      { field: "amount", header: "Amount" },
      { field: "status", header: "Status" },
      { field: "difference", header: "Difference" }
    ]);
    showSuccess(toast, `Match rate ${reconciliationStatus.successRate}%`, 'Report Generated');
  };

  const selectionDifference = selectedBank.reduce((s, b) => s + Number(b.amount || 0), 0) - selectedSystem.reduce((s, r) => s + Number(r.premium || 0), 0);

  const statusBodyTemplate = (rowData) => {
    const severities = { matched: "success", unmatched: "warning", partial: "info" };
    return (
      <Tag
        severity={severities[rowData.status] || "secondary"}
        icon={`pi pi-${rowData.status === 'matched' ? 'check' : rowData.status === 'unmatched' ? 'exclamation-triangle' : 'info-circle'}`}
        value={rowData.status}
      />
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
      <input type="file" accept=".csv" ref={fileInput} style={{ display: "none" }} onChange={handleImport} />
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
            <div className="status-value">{reconciliationStatus.matched}</div>
          </Card>
          <Card className="status-card">
            <div className="status-label">Unmatched</div>
            <div className="status-value">{reconciliationStatus.unmatched}</div>
          </Card>
          <Card className="status-card">
            <div className="status-label">Partial Match</div>
            <div className="status-value">{reconciliationStatus.partialMatch}</div>
          </Card>
          <Card className="status-card">
            <div className="status-label">Success Rate</div>
            <div className="status-value">{reconciliationStatus.successRate}%</div>
            <div className="bv-meter">
              <ProgressBar value={progressValue(reconciliationStatus.successRate)} showValue={false} />
              <span className="bv-meter__value">{`${roundTo(reconciliationStatus.successRate, 1) ?? 0}%`}</span>
            </div>
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
                  <Button icon="pi pi-download" className="p-button-sm" outlined label={t("remittance.downloadTemplate")}
                    onClick={() => importService.downloadTemplate("/remittance/reconciliation/bank-transactions/template", "Remittance_Bank_Transactions_Template.csv").catch((e) => showError(toast, e))} />
                  <Button icon="pi pi-upload" className="p-button-sm" label="Import" onClick={() => fileInput.current?.click()} />
                  <Button icon="pi pi-refresh" className="p-button-sm" outlined onClick={loadReconciliation} aria-label="Refresh" tooltip="Refresh" tooltipOptions={{ position: "top" }} />
                </div>
              </div>
              <DataTable
                value={bankTransactions}
                loading={loading}
                selection={selectedBank}
                onSelectionChange={(e) => setSelectedBank(e.value)}
                dataKey="id"
                size="small"
              >
                <Column selectionMode="multiple" style={{ width: '3em' }} />
                <Column field="transDate" body={dateBody("transDate")} header="Date" />
                <Column field="reference" header="Reference" />
                <Column field="amount" header="Amount" body={(data) => formatCurrency(data.amount)} />
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
                {matchCriteria === 'Within Tolerance' && (
                  <div className="control-field">
                    <label>Tolerance</label>
                    <InputNumber
                      value={tolerance}
                      onValueChange={(e) => setTolerance(e.value)}
                      min={0}
                      minFractionDigits={2}
                      className="w-full"
                    />
                  </div>
                )}
                <Button
                  label="Auto Match"
                  icon="pi pi-sparkles"
                  className="p-button-primary w-full"
                  onClick={handleAutoMatch}
                  loading={loading}
                />
                <div className="selection-info">
                  <div>Selected Bank: {selectedBank.length}</div>
                  <div>Selected System: {selectedSystem.length}</div>
                  <div className="difference">Difference: {formatCurrency(selectionDifference)}</div>
                </div>
                <Button
                  label="Match Selected"
                  icon="pi pi-link"
                  className="w-full"
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
                  <Button icon="pi pi-database" className="p-button-sm" label="Load" onClick={loadReconciliation} />
                  <Button icon="pi pi-filter" className={`p-button-sm ${unmatchedOnly ? "" : "p-button-outlined"}`} onClick={() => setUnmatchedOnly(!unmatchedOnly)} aria-label="Filter" tooltip="Filter" tooltipOptions={{ position: "top" }} />
                </div>
              </div>
              <DataTable
                value={systemTransactions}
                loading={loading}
                selection={selectedSystem}
                onSelectionChange={(e) => setSelectedSystem(e.value)}
                dataKey="id"
                size="small"
              >
                <Column selectionMode="multiple" style={{ width: '3em' }} />
                <Column field="policyNo" header="Policy" />
                <Column field="premium" header="Premium" body={(data) => formatCurrency(data.premium)} />
                <Column field="transDate" body={dateBody("transDate")} header="Date" />
                <Column field="status" header="" body={statusBodyTemplate} style={{ width: '3em' }} />
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Exceptions">
          <div className="exceptions-section">
            <div className="toolbar mb-3">
              <Button label="Export Exceptions" icon="pi pi-download" className="p-button-sm" onClick={handleExportExceptions} />
              <Button label="Resolve All" icon="pi pi-check" className="p-button-sm" onClick={handleResolveAll} disabled={!exceptions.length} />
            </div>
            <DataTable value={exceptions} stripedRows>
              <Column field="type" header="Exception Type" />
              <Column field="bankRef" header="Bank Reference" />
              <Column field="sysRef" header="System Reference" />
              <Column field="difference" header="Difference" body={(data) => data.difference ? formatCurrency(data.difference) : '-'} />
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
              <Column field="date" body={dateBody("date")} header="Date" />
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