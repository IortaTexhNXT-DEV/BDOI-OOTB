import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Link } from "react-router-dom";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { RadioButton } from "primereact/radiobutton";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import remittanceService from "../../../services/remittanceService";
import authService from "../../../services/authService";
import { calendarDateFormat, dateBody, isoDate, loadSettings, showError, showSuccess, statusSeverity } from "../shared";
import "./index.scss";
import { promptText } from "../../../utility/dialogs";

// Delegating one pending approval to another approver. Standing cover for a period (leave) is given in
// Master > User Management > Delegations, which the approval check (Authority Matrix) follows.
const emptyDelegation = { delegateTo: "", reason: "" };
const AGE_LIMITS = { "1": [0, 24], "3": [24, 72], "7": [72, 168], "7+": [168, Infinity] };
const ageHours = (row) => (Date.now() - new Date(String(row.submissionDate).replace(" ", "T")).getTime()) / 3600000;
const toOptions = (values) => [{ label: "All", value: "All" }, ...values.map((v) => ({ label: v, value: v }))];

const RemittanceApproval = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const currentUserId = authService.getUser()?.userId || localStorage.getItem("USER_ID");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [approvalAction, setApprovalAction] = useState("");
  const [comments, setComments] = useState("");
  const [showDelegationDialog, setShowDelegationDialog] = useState(false);
  const [delegationData, setDelegationData] = useState(emptyDelegation);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [filters, setFilters] = useState({ transactionType: "All", priority: "All", age: "All" });
  const [historyFilters, setHistoryFilters] = useState({ range: null, action: "All" });
  const [loading, setLoading] = useState(false);

  const loadAll = async (f = filters) => {
    setLoading(true);
    try {
      const [queue, history] = await Promise.all([
        remittanceService.listApprovals({
          transactionType: f.transactionType === "All" ? undefined : f.transactionType,
          priority: f.priority === "All" ? undefined : f.priority
        }),
        remittanceService.approvalHistory()
      ]);
      const limits = AGE_LIMITS[f.age];
      setPendingApprovals(limits ? queue.filter((r) => ageHours(r) >= limits[0] && ageHours(r) < limits[1]) : queue);
      setApprovalHistory(history || []);
      setSelectedRows([]);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    loadSettings().then((s) => setPriorities(Object.keys(s["remittance.priority_sla_hours"] || {}))).catch((e) => showError(toast, e));
    // users who may take over an approval (finance reads this without user-administration rights)
    remittanceService.listApprovers()
      .then((users) => setUserOptions((users || []).filter((u) => u.userId !== currentUserId).map((u) => ({ label: u.displayName || u.username, value: u.username }))))
      .catch(() => setUserOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transactionTypes = [...new Set([...pendingApprovals, ...approvalHistory].map((r) => r.transactionType).filter(Boolean))];
  const transactionTypeOptions = toOptions(transactionTypes);
  const priorityOptions = toOptions(priorities);
  const today = isoDate(new Date());
  const summary = {
    mine: pendingApprovals.filter((r) => r.initiatorId !== currentUserId).length,
    total: pendingApprovals.length,
    overdue: pendingApprovals.filter((r) => r.slaRemaining < 0).length,
    approvedToday: approvalHistory.filter((r) => r.action === "Approved" && String(r.actionDate).startsWith(today)).length
  };
  const visibleHistory = approvalHistory.filter((r) => {
    if (historyFilters.action !== "All" && r.action !== historyFilters.action) return false;
    const [from, to] = historyFilters.range || [];
    const day = String(r.actionDate).slice(0, 10);
    return (!from || day >= isoDate(from)) && (!to || day <= isoDate(to));
  });

  const run = async (action, message) => {
    try {
      await action();
      showSuccess(toast, message);
      await loadAll();
      return true;
    } catch (e) {
      showError(toast, e);
      return false;
    }
  };

  const approveRows = (rows, note) => run(() => Promise.all(rows.map((r) => remittanceService.approve(r.id, note))), `${rows.length} approval(s) recorded`);

  const rejectRows = async (rows, note) => {
    const reason = note || await promptText(t("remittance.comments"), "");
    if (!reason) return Promise.resolve(false);
    return run(() => Promise.all(rows.map((r) => remittanceService.reject(r.id, reason))), `${rows.length} transaction(s) rejected`);
  };

  const priorityBodyTemplate = (rowData) => {
    const getSeverity = (priority) => {
      switch (priority) {
        case 'Urgent': return 'danger';
        case 'High': return 'warning';
        case 'Normal': return 'info';
        case 'Low': return 'success';
        default: return null;
      }
    };
    return <Tag value={rowData.priority} severity={getSeverity(rowData.priority)} />;
  };

  const slaBodyTemplate = (rowData) => {
    const remaining = rowData.slaRemaining ?? rowData.slaHours;
    const severity = remaining < 8 ? 'danger' : remaining < 24 ? 'warning' : 'success';
    return <Tag value={remaining < 0 ? `${Math.abs(remaining)}h overdue` : `${remaining}h remaining`} severity={severity} />;
  };

  const actionBodyTemplate = (rowData) => {
    return <Tag value={rowData.action} severity={statusSeverity(rowData.action)} />;
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip={t("remittance.view")}
          onClick={() => {
            setSelectedTransaction(rowData);
            setApprovalAction("");
            setComments("");
            setShowDetailDialog(true);
          }} aria-label={t("remittance.view")}
        />
        <Button
          icon="pi pi-check"
          className="p-button-rounded p-button-text"
          tooltip={t("remittance.approve")}
          onClick={() => approveRows([rowData])} aria-label={t("remittance.approve")}
        />
        <Button
          icon="pi pi-times"
          className="p-button-rounded p-button-danger p-button-text"
          tooltip={t("common.reject")}
          onClick={() => rejectRows([rowData])} aria-label={t("common.reject")}
        />
      </div>
    );
  };

  const handleSubmitDecision = async () => {
    if (!approvalAction) return;
    const done = approvalAction === "approve"
      ? await approveRows([selectedTransaction], comments || undefined)
      : await rejectRows([selectedTransaction], comments);
    if (done) setShowDetailDialog(false);
  };

  const openDelegation = () => {
    setDelegationData(emptyDelegation);
    setShowDelegationDialog(true);
  };

  const handleDelegation = async () => {
    const d = delegationData;
    const done = await run(() => Promise.all(selectedRows.map((r) => remittanceService.delegate(r.id, d.delegateTo, d.reason))), `${selectedRows.length} approval(s) delegated`);
    if (done) setShowDelegationDialog(false);
  };

  const detailDialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" onClick={() => setShowDetailDialog(false)} className="p-button-text" />
      <Button label={t("remittance.submit")} icon="pi pi-check" onClick={handleSubmitDecision} autoFocus
        disabled={!approvalAction || (approvalAction === 'reject' && !comments)} />
    </div>
  );

  const delegationDialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" onClick={() => setShowDelegationDialog(false)} className="p-button-text" />
      <Button label={t("remittance.delegate")} icon="pi pi-check" onClick={handleDelegation} autoFocus
        disabled={!delegationData.delegateTo || !delegationData.reason} />
    </div>
  );

  return (
    <div className="remittance-approval">
      <Toast ref={toast} />
      <h2>{t("remittance.approvalWorkflow")}</h2>
      <p className="approval-authority-note">
        {t("remittance.approvalAuthorityNote")}{" "}
        <Link to="/master/generals/usermanagement/authority-matrix">{t("remittance.authorityMatrix")}</Link>
        {" · "}
        <Link to="/master/generals/usermanagement/delegations">{t("remittance.userDelegations")}</Link>
      </p>

      <div className="summary-cards">
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon orange">
              <i className="pi pi-clock" />
            </div>
            <div className="card-details">
              <div className="card-value">{summary.mine}</div>
              <div className="card-label">{t("remittance.pendingMyApproval")}</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon blue">
              <i className="pi pi-hourglass" />
            </div>
            <div className="card-details">
              <div className="card-value">{summary.total}</div>
              <div className="card-label">{t("remittance.totalPending")}</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon red">
              <i className="pi pi-exclamation-triangle" />
            </div>
            <div className="card-details">
              <div className="card-value">{summary.overdue}</div>
              <div className="card-label">{t("remittance.overdue")}</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon green">
              <i className="pi pi-check" />
            </div>
            <div className="card-details">
              <div className="card-value">{summary.approvedToday}</div>
              <div className="card-label">{t("remittance.approvedToday")}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>{t("remittance.pendingApprovals")} <span className="badge">{pendingApprovals.length}</span></span>}>
            <div className="filter-section mb-3">
              <Dropdown placeholder={t("remittance.transactionType")} options={transactionTypeOptions} className="mr-2"
                value={filters.transactionType} onChange={(e) => setFilters({ ...filters, transactionType: e.value })} />
              <Dropdown placeholder={t("remittance.priority")} options={priorityOptions} className="mr-2"
                value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.value })} />
              <Dropdown placeholder={t("remittance.age")} value={filters.age} onChange={(e) => setFilters({ ...filters, age: e.value })} options={[
                { label: "All", value: "All" },
                { label: "< 1 Day", value: "1" },
                { label: "1-3 Days", value: "3" },
                { label: "3-7 Days", value: "7" },
                { label: "> 7 Days", value: "7+" }
              ]} className="mr-2" />
              <Button label={t("remittance.filter")} icon="pi pi-filter" className="p-button-primary mr-2" onClick={() => loadAll()} />
              <Button label={t("remittance.clear")} icon="pi pi-times" className="p-button-secondary" onClick={() => {
                const cleared = { transactionType: "All", priority: "All", age: "All" };
                setFilters(cleared);
                loadAll(cleared);
              }} />
            </div>

            <DataTable
              value={pendingApprovals}
              loading={loading}
              selection={selectedRows}
              onSelectionChange={(e) => setSelectedRows(e.value)}
              dataKey="id"
              stripedRows
            >
              <Column selectionMode="multiple" style={{ width: '3rem' }} />
              <Column field="priority" header="" body={priorityBodyTemplate} style={{ width: '5rem' }} />
              <Column field="referenceNo" header={t("remittance.referenceNo")} />
              <Column field="transactionType" header={t("remittance.type")} />
              <Column field="initiator" header={t("remittance.initiatedBy")} />
              <Column field="submissionDate" body={dateBody("submissionDate")} header={t("remittance.submitted")} />
              <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
              <Column field="description" header={t("remittance.description")} />
              <Column field="slaHours" header="SLA" body={slaBodyTemplate} />
              <Column field="currentLevel" header={t("remittance.level")} />
              <Column header={t("remittance.actions")} body={actionsBodyTemplate} style={{ width: '150px' }} />
            </DataTable>

            {selectedRows.length > 0 && (
              <div className="bulk-actions mt-3">
                <Button label={t("remittance.bulkApprove")} icon="pi pi-check" className="mr-2" onClick={() => approveRows(selectedRows)} />
                <Button label={t("remittance.bulkReject")} icon="pi pi-times" className="p-button-danger mr-2" onClick={() => rejectRows(selectedRows)} />
                <Button label={t("remittance.delegate")} icon="pi pi-forward" className="p-button-secondary" onClick={openDelegation} />
              </div>
            )}
          </TabPanel>

          <TabPanel header={t("remittance.approvalHistory")}>
            <div className="filter-section mb-3">
              <Calendar dateFormat={calendarDateFormat()} placeholder={t("remittance.dateRange")} selectionMode="range" className="mr-2"
                value={historyFilters.range} onChange={(e) => setHistoryFilters({ ...historyFilters, range: e.value })} />
              <Dropdown placeholder={t("remittance.action")} value={historyFilters.action}
                onChange={(e) => setHistoryFilters({ ...historyFilters, action: e.value })} options={[
                { label: "All", value: "All" },
                { label: "Approved", value: "Approved" },
                { label: "Rejected", value: "Rejected" },
                { label: "Delegated", value: "Delegated" }
              ]} className="mr-2" />
              <Button label={t("remittance.search")} icon="pi pi-search" onClick={() => loadAll()} />
            </div>

            <DataTable value={visibleHistory} stripedRows loading={loading}>
              <Column field="referenceNo" header={t("remittance.referenceNo")} />
              <Column field="transactionType" header={t("remittance.type")} />
              <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
              <Column field="action" header={t("remittance.action")} body={actionBodyTemplate} />
              <Column field="actionDate" body={dateBody("actionDate")} header={t("remittance.actionDate")} />
              <Column field="remarks" header={t("remittance.remarks")} />
            </DataTable>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog
        header={t("remittance.approvalDetails")}
        visible={showDetailDialog}
        style={{ width: '60vw' }}
        footer={detailDialogFooter}
        onHide={() => setShowDetailDialog(false)}
      >
        {selectedTransaction && (
          <div className="approval-details">
            <div className="detail-section">
              <h4>{t("remittance.transactionInformation")}</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>{t("remittance.referenceNo")}:</label>
                  <span>{selectedTransaction.referenceNo}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.type")}:</label>
                  <span>{selectedTransaction.transactionType}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.amount")}:</label>
                  <span>{formatCurrency(selectedTransaction.amount)}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.initiatedBy")}:</label>
                  <span>{selectedTransaction.initiator}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h4>{t("remittance.approvalAction")}</h4>
              <div className="approval-action">
                <div className="p-field-radiobutton field-radiobutton mb-2">
                  <RadioButton
                    inputId="approve"
                    value="approve"
                    onChange={(e) => setApprovalAction(e.value)}
                    checked={approvalAction === 'approve'}
                  />
                  <label htmlFor="approve" className="ml-2">{t("remittance.approve")}</label>
                </div>
                <div className="p-field-radiobutton field-radiobutton mb-2">
                  <RadioButton
                    inputId="reject"
                    value="reject"
                    onChange={(e) => setApprovalAction(e.value)}
                    checked={approvalAction === 'reject'}
                  />
                  <label htmlFor="reject" className="ml-2">{t("common.reject")}</label>
                </div>
              </div>

              {approvalAction && (
                <div className="mt-3">
                  <label>{t("remittance.comments")}{approvalAction === 'reject' ? " *" : ""}</label>
                  <InputTextarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header={t("remittance.delegate")}
        visible={showDelegationDialog}
        style={{ width: '50vw' }}
        footer={delegationDialogFooter}
        onHide={() => setShowDelegationDialog(false)}
      >
        <div className="delegation-form">
          <div className="p-fluid formgrid grid">
            <div className="p-field field col-12 md:col-6">
              <label>{t("remittance.delegateTo")} *</label>
              <Dropdown
                value={delegationData.delegateTo}
                options={userOptions}
                editable
                onChange={(e) => setDelegationData({ ...delegationData, delegateTo: e.value })}
                placeholder={t("remittance.selectUser")}
              />
            </div>
            <div className="p-field field col-12">
              <label>{t("remittance.reason")} *</label>
              <InputTextarea
                value={delegationData.reason}
                onChange={(e) => setDelegationData({ ...delegationData, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default RemittanceApproval;