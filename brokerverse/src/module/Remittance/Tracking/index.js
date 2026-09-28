import React, { useState, useEffect, useRef } from "react";
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
import { Dialog } from "primereact/dialog";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { Timeline } from "primereact/timeline";
import { Badge } from "primereact/badge";
import { ProgressSpinner } from "primereact/progressspinner";
import { TabView, TabPanel } from "primereact/tabview";
import mockRemittanceService from "../../../services/mockRemittanceService";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import "./index.scss";

const RemittanceTracking = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [dateRange, setDateRange] = useState([null, null]);
  const [insurerCode, setInsurerCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRemittance, setSelectedRemittance] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [remittanceDetails, setRemittanceDetails] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    totalCount: 0,
    pendingAmount: 0,
    completedToday: 0,
    requiresAction: 0
  });
  const [filteredRemittances, setFilteredRemittances] = useState([]);
  const toast = useRef(null);

  // Initial remittances data
  const [remittances, setRemittances] = useState([
    {
      id: 1,
      remittanceNo: "REM-2025-001",
      remittanceDate: new Date("2025-09-25"),
      insurerCode: "INS001",
      insurerName: "ABC Insurance Co.",
      policyCount: 45,
      grossAmount: 125000.00,
      commission: 12500.00,
      netAmount: 112500.00,
      status: "Completed"
    },
    {
      id: 2,
      remittanceNo: "REM-2025-002",
      remittanceDate: new Date("2025-09-26"),
      insurerCode: "INS002",
      insurerName: "XYZ Life Insurance",
      policyCount: 38,
      grossAmount: 98500.00,
      commission: 9850.00,
      netAmount: 88650.00,
      status: "Pending"
    },
    {
      id: 3,
      remittanceNo: "REM-2025-003",
      remittanceDate: new Date("2025-09-27"),
      insurerCode: "INS003",
      insurerName: "Global Health Insurance",
      policyCount: 22,
      grossAmount: 67300.00,
      commission: 6730.00,
      netAmount: 60570.00,
      status: "Processing"
    },
    {
      id: 4,
      remittanceNo: "REM-2025-004",
      remittanceDate: new Date("2025-09-28"),
      insurerCode: "INS004",
      insurerName: "Premier Auto Insurance",
      policyCount: 15,
      grossAmount: 45200.00,
      commission: 4520.00,
      netAmount: 40680.00,
      status: "Draft"
    }
  ]);

  const statusOptions = [
    { label: t("remittance.all"), value: "All" },
    { label: t("remittance.draft"), value: "Draft" },
    { label: t("remittance.pending"), value: "Pending" },
    { label: t("remittance.processing"), value: "Processing" },
    { label: t("remittance.completed"), value: "Completed" }
  ];

  const insurerOptions = [
    { label: "All Insurers", value: null },
    { label: "ABC Insurance Co.", value: "INS001" },
    { label: "XYZ Life Insurance", value: "INS002" },
    { label: "Global Health Insurance", value: "INS003" },
    { label: "Premier Auto Insurance", value: "INS004" }
  ];

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.tracking"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  // Initialize data on component mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Apply filters when search criteria change
  useEffect(() => {
    applyFilters();
  }, [search, status, dateRange, insurerCode, remittances]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Simulate loading additional remittances
      const additionalData = await mockRemittanceService.searchRemittances({});
      const combinedData = [...remittances, ...additionalData];
      setRemittances(combinedData);
      calculateDashboard(combinedData);
      toast.current.show({
        severity: 'success',
        summary: 'Data Loaded',
        detail: 'Remittance data loaded successfully',
        life: 3000
      });
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load remittance data',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboard = (data) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = data.filter(r => r.status === 'Pending');
    const completedToday = data.filter(r => {
      if (r.status !== 'Completed') return false;
      const remDate = new Date(r.remittanceDate);
      remDate.setHours(0, 0, 0, 0);
      return remDate.getTime() === today.getTime();
    });
    const requiresAction = data.filter(r => ['Pending', 'Draft'].includes(r.status));

    setDashboardData({
      totalCount: data.length,
      pendingAmount: pending.reduce((sum, r) => sum + r.netAmount, 0),
      completedToday: completedToday.length,
      requiresAction: requiresAction.length
    });
  };

  const applyFilters = () => {
    let filtered = [...remittances];

    // Filter by search term
    if (search) {
      filtered = filtered.filter(r =>
        r.remittanceNo.toLowerCase().includes(search.toLowerCase()) ||
        r.insurerName.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Filter by status
    if (status !== 'All') {
      filtered = filtered.filter(r => r.status === status);
    }

    // Filter by insurer
    if (insurerCode) {
      filtered = filtered.filter(r => r.insurerCode === insurerCode);
    }

    // Filter by date range
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(r => {
        const remDate = new Date(r.remittanceDate);
        return remDate >= dateRange[0] && remDate <= dateRange[1];
      });
    }

    setFilteredRemittances(filtered);
    calculateDashboard(filtered);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      // Simulate search with filters
      const results = await mockRemittanceService.searchRemittances({
        search,
        status: status !== 'All' ? status : undefined,
        insurerCode,
        dateRange
      });

      // Merge with existing data (avoiding duplicates)
      const existingIds = remittances.map(r => r.id);
      const newData = results.filter(r => !existingIds.includes(r.id));

      if (newData.length > 0) {
        const combinedData = [...remittances, ...newData];
        setRemittances(combinedData);
        toast.current.show({
          severity: 'info',
          summary: 'Search Complete',
          detail: `Found ${newData.length} new remittances`,
          life: 3000
        });
      } else {
        toast.current.show({
          severity: 'info',
          summary: 'Search Complete',
          detail: 'No new remittances found',
          life: 3000
        });
      }
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Search Failed',
        detail: error.message,
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearch("");
    setStatus("All");
    setDateRange([null, null]);
    setInsurerCode(null);
    toast.current.show({
      severity: 'info',
      summary: 'Filters Cleared',
      detail: 'All filters have been reset',
      life: 2000
    });
  };

  const handleView = async (rowData) => {
    setSelectedRemittance(rowData);
    setLoading(true);
    try {
      const details = await mockRemittanceService.getRemittanceDetails(rowData.id);
      setRemittanceDetails(details);
      setDetailsVisible(true);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load remittance details',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rowData) => {
    confirmDialog({
      message: `Are you sure you want to edit remittance ${rowData.remittanceNo}?`,
      header: 'Confirm Edit',
      icon: 'pi pi-pencil',
      accept: () => {
        toast.current.show({
          severity: 'info',
          summary: 'Edit Mode',
          detail: `Editing ${rowData.remittanceNo}`,
          life: 3000
        });
        // In real app, would navigate to edit form
      }
    });
  };

  const handleProcess = async (rowData) => {
    confirmDialog({
      message: (
        <div>
          <p>Process remittance {rowData.remittanceNo}?</p>
          <p><strong>Amount: {formatCurrency(rowData.netAmount)}</strong></p>
        </div>
      ),
      header: 'Confirm Processing',
      icon: 'pi pi-play',
      accept: async () => {
        setLoading(true);
        try {
          const result = await mockRemittanceService.processRemittances([rowData], {});

          // Update status in local state
          const updatedRemittances = remittances.map(r =>
            r.id === rowData.id ? { ...r, status: 'Processing' } : r
          );
          setRemittances(updatedRemittances);

          toast.current.show({
            severity: 'success',
            summary: 'Processing Started',
            detail: `${rowData.remittanceNo} is being processed`,
            life: 3000
          });

          // Simulate status update after delay
          setTimeout(() => {
            const finalRemittances = updatedRemittances.map(r =>
              r.id === rowData.id ? { ...r, status: 'Completed' } : r
            );
            setRemittances(finalRemittances);
            toast.current.show({
              severity: 'success',
              summary: 'Processing Complete',
              detail: `${rowData.remittanceNo} has been processed successfully`,
              life: 3000
            });
          }, 3000);
        } catch (error) {
          toast.current.show({
            severity: 'error',
            summary: 'Processing Failed',
            detail: error.message,
            life: 3000
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Completed': return 'success';
        case 'Processing': return 'info';
        case 'Pending': return 'warning';
        case 'Draft': return 'secondary';
        default: return null;
      }
    };

    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const dateBodyTemplate = (rowData) => {
    return rowData.remittanceDate.toLocaleDateString();
  };

  const amountBodyTemplate = (rowData, field) => {
    return formatCurrency(rowData[field]);
  };

  const handlePrint = (rowData) => {
    toast.current.show({
      severity: 'info',
      summary: 'Print Preview',
      detail: `Preparing ${rowData.remittanceNo} for printing...`,
      life: 3000
    });
  };

  const handleExport = () => {
    confirmDialog({
      message: 'Export remittance data to Excel?',
      header: 'Export Data',
      icon: 'pi pi-file-excel',
      accept: () => {
        toast.current.show({
          severity: 'success',
          summary: 'Export Started',
          detail: 'Remittance data exported successfully',
          life: 3000
        });
      }
    });
  };

  const handleRefresh = async () => {
    await loadInitialData();
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-text"
          onClick={() => handleView(rowData)}
          tooltip="View Details"
        />
        {rowData.status === 'Draft' && (
          <Button
            icon="pi pi-pencil"
            className="p-button-text"
            onClick={() => handleEdit(rowData)}
            tooltip="Edit"
          />
        )}
        {rowData.status === 'Pending' && (
          <Button
            icon="pi pi-play"
            className="p-button-text"
            onClick={() => handleProcess(rowData)}
            tooltip="Process"
          />
        )}
        <Button
          icon="pi pi-print"
          className="p-button-text"
          onClick={() => handlePrint(rowData)}
          tooltip="Print"
        />
      </div>
    );
  };

  const linkBodyTemplate = (rowData) => {
    return (
      <a href="#" className="remittance-link" onClick={(e) => {
        e.preventDefault();
        handleView(rowData);
      }}>
        {rowData.remittanceNo}
      </a>
    );
  };

  const detailsDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Close"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setDetailsVisible(false)}
      />
      <Button
        label="Process"
        icon="pi pi-play"
        onClick={() => {
          setDetailsVisible(false);
          handleProcess(selectedRemittance);
        }}
        disabled={selectedRemittance?.status !== 'Pending'}
      />
    </div>
  );

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
                  dateFormat="mm/dd/yy"
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

        {/* Details Dialog */}
        <Dialog
          header="Remittance Details"
          visible={detailsVisible}
          onHide={() => setDetailsVisible(false)}
          style={{ width: '70vw' }}
          footer={detailsDialogFooter}
        >
          {remittanceDetails && (
            <TabView>
              <TabPanel header="General Information">
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Remittance No:</label>
                    <span>{remittanceDetails.remittanceNo}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <Tag value={selectedRemittance?.status} severity={
                      selectedRemittance?.status === 'Completed' ? 'success' :
                      selectedRemittance?.status === 'Processing' ? 'info' :
                      selectedRemittance?.status === 'Pending' ? 'warning' : 'secondary'
                    } />
                  </div>
                  <div className="detail-item">
                    <label>Created Date:</label>
                    <span>{new Date(remittanceDetails.createdDate).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-item">
                    <label>Created By:</label>
                    <span>{remittanceDetails.createdBy}</span>
                  </div>
                </div>
              </TabPanel>

              <TabPanel header="Insurer Details">
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Insurer Code:</label>
                    <span>{remittanceDetails.insurerDetails.code}</span>
                  </div>
                  <div className="detail-item">
                    <label>Insurer Name:</label>
                    <span>{remittanceDetails.insurerDetails.name}</span>
                  </div>
                  <div className="detail-item full-width">
                    <label>Address:</label>
                    <span>{remittanceDetails.insurerDetails.address}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{remittanceDetails.insurerDetails.contact}</span>
                  </div>
                  <div className="detail-item">
                    <label>Phone:</label>
                    <span>{remittanceDetails.insurerDetails.phone}</span>
                  </div>
                </div>
              </TabPanel>

              <TabPanel header={`Policies (${remittanceDetails.policies.length})`}>
                <DataTable value={remittanceDetails.policies} className="detail-table">
                  <Column field="policyNo" header="Policy No" />
                  <Column field="premium" header="Premium" body={(data) => formatCurrency(data.premium)} />
                  <Column field="commission" header="Commission" body={(data) => formatCurrency(data.commission)} />
                  <Column field="status" header="Status" body={(data) =>
                    <Tag value={data.status} severity={data.status === 'Active' ? 'success' : 'warning'} />
                  } />
                </DataTable>
              </TabPanel>

              <TabPanel header="Activity Log">
                <Timeline value={remittanceDetails.activityLog}
                  content={(item) => (
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <strong>{item.action}</strong>
                        <small>{new Date(item.at).toLocaleString()}</small>
                      </div>
                      <div className="timeline-details">
                        <p>By: {item.by}</p>
                        {item.notes && <p>Notes: {item.notes}</p>}
                      </div>
                    </div>
                  )}
                />
              </TabPanel>
            </TabView>
          )}
        </Dialog>

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

          <Card className="dashboard-card clickable" onClick={() => setStatus('Pending')}>
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
                  tooltip="Refresh"
                />
                <Button
                  icon="pi pi-file-excel"
                  className="p-button-text"
                  onClick={handleExport}
                  tooltip="Export to Excel"
                />
              </div>
            </div>
            <DataTable
              value={filteredRemittances.length > 0 ? filteredRemittances : remittances}
              className="remittance-table"
              stripedRows
              paginator
              rows={10}
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