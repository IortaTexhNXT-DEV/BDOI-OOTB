import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import remittanceService from "../../../services/remittanceService";
import { REMITTANCE_ROUTES, calendarDateFormat, downloadCsv, formatDate, isoDate, loadInsurerOptions, loadSettings, showError, showSuccess, statusSeverity } from "../shared";
import SvgDot from "../../../assets/icons/SvgDot";
import "./index.scss";

const RemittanceTracking = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [dateRange, setDateRange] = useState([null, null]);
  const [insurerCode, setInsurerCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalCount: 0,
    pendingAmount: 0,
    completedToday: 0,
    requiresAction: 0
  });
  const [remittances, setRemittances] = useState([]);
  const [statusLabels, setStatusLabels] = useState({});
  const [insurers, setInsurers] = useState([]);
  const toast = useRef(null);

  const statusOptions = [
    { label: t("remittance.all"), value: "All" },
    ...Object.entries(statusLabels).map(([code, label]) => ({ label, value: code }))
  ];

  const insurerOptions = [{ label: "All Insurers", value: null }, ...insurers];

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.tracking"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadSettings().then((s) => setStatusLabels(s["remittance.status_labels"] || {})).catch((e) => showError(toast, e));
    loadInsurerOptions().then(setInsurers).catch((e) => showError(toast, e));
    loadRemittances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateDashboard = (data) => {
    const today = isoDate(new Date());
    setDashboardData({
      totalCount: data.length,
      pendingAmount: data.filter(r => r.statusCode === 'for-approval').reduce((sum, r) => sum + Number(r.netAmount || 0), 0),
      completedToday: data.filter(r => r.statusCode === 'settled' && isoDate(r.settledAt) === today).length,
      requiresAction: data.filter(r => ['draft', 'for-approval'].includes(r.statusCode)).length
    });
  };

  const loadRemittances = async (filters = {}) => {
    setLoading(true);
    try {
      const res = await remittanceService.listRemittances({ perPage: 500, ...filters });
      setRemittances(res.data || []);
      calculateDashboard(res.data || []);
      return res.data || [];
    } catch (error) {
      showError(toast, error, 'Failed to load remittance data');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const currentFilters = (overrides = {}) => {
    const f = { search, status, insurerCode, dateRange, ...overrides };
    return {
      search: f.search || undefined,
      status: f.status !== 'All' ? f.status : undefined,
      insurer: f.insurerCode || undefined,
      from: isoDate(f.dateRange?.[0]),
      to: isoDate(f.dateRange?.[1])
    };
  };

  const handleSearch = async () => {
    // the list itself shows the result: no pop-up
    await loadRemittances(currentFilters());
  };

  const handleClear = () => {
    setSearch("");
    setStatus("All");
    setDateRange([null, null]);
    setInsurerCode(null);
    loadRemittances();
  };

  const handleStatusCard = (code) => {
    setStatus(code);
    loadRemittances(currentFilters({ status: code }));
  };

  // the record page replaces the details pop-up of earlier releases
  const handleView = (rowData) => navigate(REMITTANCE_ROUTES.record(rowData.id));

  const handleProcess = async (rowData) => {
    confirmDialog({
      message: (
        <div>
          <p>Submit remittance {rowData.remittanceNo} for approval?</p>
          <p><strong>Amount: {formatCurrency(rowData.netAmount)}</strong></p>
        </div>
      ),
      header: 'Confirm Processing',
      icon: 'pi pi-play',
      accept: async () => {
        setLoading(true);
        try {
          const result = await remittanceService.processRemittances([rowData.id]);
          showSuccess(toast, `${rowData.remittanceNo} submitted for approval (batch ${result.batchId})`, 'Processing Started');
          await loadRemittances(currentFilters());
        } catch (error) {
          showError(toast, error, 'Processing Failed');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const statusBodyTemplate = (rowData) => {
    return <Tag value={rowData.status} severity={statusSeverity(rowData.statusCode)} />;
  };

  const dateBodyTemplate = (rowData) => {
    return formatDate(rowData.remittanceDate);
  };

  const amountBodyTemplate = (rowData, field) => {
    return formatCurrency(rowData[field]);
  };

  const handleExport = () => {
    downloadCsv(`remittances_${isoDate(new Date())}.csv`, remittances, [
      { field: 'remittanceNo', header: 'Remittance No' },
      { field: 'remittanceDate', header: 'Date' },
      { field: 'insurerCode', header: 'Insurer Code' },
      { field: 'insurerName', header: 'Insurer Name' },
      { field: 'policyCount', header: 'Policies' },
      { field: 'grossAmount', header: 'Gross Amount' },
      { field: 'commission', header: 'Commission' },
      { field: 'netAmount', header: 'Net Amount' },
      { field: 'status', header: 'Status' }
    ]);
    showSuccess(toast, `${remittances.length} remittances exported`, 'Export Complete');
  };

  const handleRefresh = async () => {
    await loadRemittances(currentFilters());
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-text"
          onClick={() => handleView(rowData)}
          tooltip="View Details" aria-label="View Details"
        />
        {rowData.statusCode === 'draft' && (
          <Button
            icon="pi pi-play"
            className="p-button-text"
            onClick={() => handleProcess(rowData)}
            tooltip="Process" aria-label="Process"
          />
        )}
      </div>
    );
  };

  const linkBodyTemplate = (rowData) => {
    return (
      <a href={REMITTANCE_ROUTES.record(rowData.id)} className="remittance-link" onClick={(e) => {
        e.preventDefault();
        handleView(rowData);
      }}>
        {rowData.remittanceNo}
      </a>
    );
  };

  return (
    <div className="container__remittance__tracking__master">
        <Toast ref={toast} />
        <ConfirmDialog />
        <div className="top__container">
          <h1 className="page__title">Remittance Tracking</h1>
          <BreadCrumb model={items} home={home} />
        </div>

        <div className="content-container">
          <div className="search-section">
          <Card>
            <div className="search-grid">
              <div className="search-field">
                <label>Remittance No</label>
                <InputText
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Enter remittance number"
                />
              </div>

              <div className="search-field">
                <label>Insurer</label>
                <Dropdown
                  value={insurerCode}
                  onChange={(e) => setInsurerCode(e.value)}
                  options={insurerOptions}
                  placeholder="Select insurer"
                />
              </div>

              <div className="search-field">
                <label>Date Range</label>
                <Calendar
                  value={dateRange}
                  onChange={(e) => setDateRange(e.value)}
                  selectionMode="range"
                  dateFormat={calendarDateFormat()}
                  placeholder="Select date range"
                />
              </div>

              <div className="search-field">
                <label>Status</label>
                <Dropdown
                  value={status}
                  onChange={(e) => setStatus(e.value)}
                  options={statusOptions}
                  placeholder="Select status"
                />
              </div>

              <div className="search-actions">
                <Button label="Search" icon="pi pi-search" onClick={handleSearch} />
                <Button label="Clear" className="p-button-secondary" onClick={handleClear} />
              </div>
            </div>
          </Card>
        </div>


        <div className="dashboard-cards">
          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-file-o card-icon blue"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.totalCount}</span>
                <span className="card-label">Total Remittances</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-clock card-icon orange"></i>
              <div className="card-info">
                <span className="card-value">
                  {formatCurrency(dashboardData.pendingAmount)}
                </span>
                <span className="card-label">Pending Processing</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-check card-icon green"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.completedToday}</span>
                <span className="card-label">Completed Today</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => handleStatusCard('for-approval')}>
            <div className="card-content">
              <i className="pi pi-exclamation-triangle card-icon red"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.requiresAction}</span>
                <span className="card-label">Requires Action</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="table-section">
          <Card>
            <div className="table-header">
              <h3>Remittance List</h3>
              <div className="table-actions">
                <Button
                  icon="pi pi-refresh"
                  className="p-button-text"
                  onClick={handleRefresh}
                  tooltip="Refresh" aria-label="Refresh"
                />
                <Button
                  icon="pi pi-file-excel"
                  className="p-button-text"
                  onClick={handleExport}
                  tooltip="Export to CSV" aria-label="Export to CSV"
                />
              </div>
            </div>
            <DataTable
              value={remittances}
              className="remittance-table"
              stripedRows
              paginator
              rows={20}
              loading={loading}
              emptyMessage="No remittances found"
            >
              <Column body={linkBodyTemplate} header="Remittance No" style={{ width: '12%' }} />
              <Column body={dateBodyTemplate} header="Date" style={{ width: '10%' }} />
              <Column field="insurerCode" header="Insurer Code" style={{ width: '10%' }} />
              <Column field="insurerName" header="Insurer Name" style={{ width: '18%' }} />
              <Column field="policyCount" header="Policies" style={{ width: '8%', textAlign: 'center' }} />
              <Column body={(data) => amountBodyTemplate(data, 'grossAmount')} header="Gross Amount" style={{ width: '12%', textAlign: 'right' }} />
              <Column body={(data) => amountBodyTemplate(data, 'commission')} header="Commission" style={{ width: '10%', textAlign: 'right' }} />
              <Column body={(data) => amountBodyTemplate(data, 'netAmount')} header="Net Amount" style={{ width: '12%', textAlign: 'right' }} />
              <Column body={statusBodyTemplate} header="Status" style={{ width: '8%' }} />
              <Column body={actionBodyTemplate} header="Actions" style={{ width: '10%' }} />
            </DataTable>
          </Card>
        </div>
        </div>
      </div>
  );
};

export default RemittanceTracking;