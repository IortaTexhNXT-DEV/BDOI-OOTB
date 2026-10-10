import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Card } from "primereact/card";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import collectionService from "../../../services/collectionService";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";
import logger from "../../../utility/logger";
import ImportDialog from "../../../components/ImportDialog";
import { hasPermission } from "../../../utils/canOpen";
import { openConfirm } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../module/OpsAccounting/common";

const openItemsUpload = (t) => [{ label: t("collectionsList.openItems"), templatePath: "/receipts/opening-items/template", uploadPath: "/receipts/opening-items/import" }];

const CollectionsList = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [lazyState, setLazyState] = useState({
    first: 0,
    rows: 20,
    page: 1,
    sortField: null,
    sortOrder: null,
  });
  const [filters, setFilters] = useState({
    status: "",
    overdueLevel: "",
    search: "",
  });

  const toast = useRef(null);
  const navigate = useNavigate();
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showOpenItems, setShowOpenItems] = useState(false);
  const [levelBands, setLevelBands] = useState([30, 60]);

  const statusOptions = [
    { label: t("collectionsList.allStatus"), value: "" },
    { label: t("collectionsList.pending"), value: "Pending" },
    { label: t("collectionsList.current"), value: "Current" },
    { label: t("collectionsList.overdue"), value: "Overdue" },
    { label: t("collectionsList.partiallyPaid"), value: "PartiallyPaid" },
    { label: t("collectionsList.committed"), value: "Committed" },
    { label: t("collectionsList.escalated"), value: "Escalated" },
  ];

  // the day bands come from the collections.overdue_levels setting, as the server applies them
  const [l1, l2] = levelBands;
  const overdueLevelOptions = [
    { label: t("collectionsList.allLevels"), value: "" },
    { label: t("collectionsList.levelBand", { level: 1, from: 1, to: l1 }), value: "1" },
    { label: t("collectionsList.levelBand", { level: 2, from: l1 + 1, to: l2 }), value: "2" },
    { label: t("collectionsList.levelBeyond", { level: 3, from: l2 + 1 }), value: "3" },
  ];

  useEffect(() => {
    loadCollections();
  }, [lazyState, filters]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const params = {
        page: lazyState.page,
        pageSize: lazyState.rows,
        ...filters,
      };

      // Add sorting parameters if they exist
      if (
        lazyState.sortField &&
        lazyState.sortOrder !== null &&
        lazyState.sortOrder !== 0
      ) {
        params.sortField = lazyState.sortField;
        // PrimeReact uses 1 for asc, -1 for desc
        params.sortOrder = lazyState.sortOrder === 1 ? "asc" : "desc";
      }

      const result = await collectionService.getCollections(params);

      if (result.success) {
        setCollections(result.data);
        setTotalRecords(result.pagination.total);
        if (Array.isArray(result.overdueLevels) && result.overdueLevels.length === 2) setLevelBands(result.overdueLevels.map(Number));
      }
    } catch (error) {
      logger.error("Load collections error:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to load collections",
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const onPage = (event) => {
    setLazyState({
      ...lazyState,
      first: event.first,
      rows: event.rows,
      page: event.page + 1,
    });
  };

  const onSort = (event) => {
    // If clicking the same field, toggle the sort order
    let newSortOrder = event.sortOrder;
    if (lazyState.sortField === event.sortField) {
      if (lazyState.sortOrder === 1) {
        newSortOrder = -1; // Toggle to descending
      } else if (lazyState.sortOrder === -1) {
        newSortOrder = null; // Clear sort
      } else {
        newSortOrder = 1; // Start with ascending
      }
    }

    setLazyState({
      ...lazyState,
      first: 0,
      page: 1,
      sortField: newSortOrder ? event.sortField : null,
      sortOrder: newSortOrder,
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setLazyState((prev) => ({ ...prev, page: 1, first: 0 }));
  };

  const handleViewDetails = (collection) => {
    navigate(`/agent/collections/${collection.id}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return formatAppDate(dateString);
  };

  // Column templates
  const clientBodyTemplate = (rowData) => {
    const client = rowData.client;
    if (!client) return "-";
    return `${client.firstName || ""} ${client.lastName || ""}`.trim();
  };

  const policyBodyTemplate = (rowData) => {
    return rowData.policyNumber || "-";
  };

  const outstandingBodyTemplate = (rowData) => {
    return formatCurrency(rowData.outstandingAmount);
  };

  const currentBodyTemplate = (rowData) => {
    return formatCurrency(rowData.currentAmount);
  };

  const days1to30BodyTemplate = (rowData) => {
    return formatCurrency(rowData.days1to30Amount);
  };

  const days31to60BodyTemplate = (rowData) => {
    return formatCurrency(rowData.days31to60Amount);
  };

  const days61to90BodyTemplate = (rowData) => {
    return formatCurrency(rowData.days61to90Amount);
  };

  const over90BodyTemplate = (rowData) => {
    return formatCurrency(rowData.over90DaysAmount);
  };

  const dueDateBodyTemplate = (rowData) => {
    return formatDate(rowData.dueDate);
  };

  const statusBodyTemplate = (rowData) => {
    const statusClass =
      {
        Pending: "status-pending",
        Current: "status-current",
        Overdue: "status-overdue",
        PartiallyPaid: "status-partial",
        Paid: "status-paid",
        Committed: "status-committed",
        Escalated: "status-escalated",
      }[rowData.collectionStatus] || "";

    return (
      <span className={`collection-status ${statusClass}`}>
        {rowData.collectionStatus}
      </span>
    );
  };

  const daysPastDueBodyTemplate = (rowData) => {
    return `${rowData.daysPastDue} days`;
  };

  const daysPastDueSortFunction = (rowData) => {
    return Number.parseInt(rowData.daysPastDue) || 0;
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          label="View"
          icon="pi pi-eye"
          className="p-button-sm p-button-outlined"
          onClick={() => handleViewDetails(rowData)}
        />
      </div>
    );
  };

  // the e-mails go out inside the confirmation (an error stays there); the toast follows once they are sent
  const handleSendDueDateReminders = async () => {
    let result;
    let scope;
    try {
      scope = (await collectionService.getDueDateReminderPreview())?.data;
    } catch (error) {
      toast.current?.show({ severity: "error", summary: t("collectionsList.remindersTitle"), detail: error.response?.data?.message || t("collectionsList.remindersFailed"), life: 4000 });
      return;
    }
    if (!scope?.items) {
      toast.current?.show({ severity: "info", summary: t("collectionsList.remindersTitle"), detail: t("collectionsList.noneToRemind"), life: 4000 });
      return;
    }
    const sent = await openConfirm({
      title: t("collectionsList.remindersTitle"),
      message: t("collectionsList.remindersScope", { count: scope.items }),
      facts: [
        { label: t("collectionsList.remindClients"), value: scope.clients, type: "number", decimals: 0 },
        { label: t("collectionsList.remindItems"), value: scope.items, type: "number", decimals: 0 },
        { label: t("collectionsList.remindOutstanding"), value: scope.totalOutstanding, type: "amount" },
        ...(scope.byLevel || []).map((l) => ({
          label: overdueLevelOptions.find((o) => o.value === String(l.level))?.label || t("collectionsList.notYetOverdue"),
          value: `${l.count} · ${formatCurrency(l.amount)}`,
        })),
        { label: t("collectionsList.remindNoEmail"), value: scope.withoutEmail, type: "number", decimals: 0, hidden: !scope.withoutEmail },
      ],
      confirmLabel: t("collectionsList.sendReminders"),
      confirmIcon: "pi pi-send",
      onConfirm: async () => {
        setSendingReminders(true);
        try {
          result = await collectionService.sendDueDateReminders();
        } catch (error) {
          logger.error("Send reminders error:", error);
          throw new Error(error.response?.data?.message || t("collectionsList.remindersFailed"));
        } finally {
          setSendingReminders(false);
        }
      },
    });
    if (!sent || !result?.success) return;
    toast.current?.show({
      severity: "success",
      summary: t("collectionsList.remindersSentTitle"),
      detail: result.message || t("collectionsList.remindersSent"),
      life: 3000,
    });
  };

  return (
    <div className="collections-list-container">
      <Toast ref={toast} />
      <PageHeader title={t("sidebar.Collections")} group={t("sidebar.Accounts")} />

      <div className="reminder-button-section">
        <Button
          label={t("collectionsList.sendPaymentRemindersNow")}
          icon="pi pi-send"
          className="p-button-rounded"
          onClick={handleSendDueDateReminders}
          loading={sendingReminders}
          tooltipOptions={{ position: "top" }}
        />
        {hasPermission("write:receipts") && (
          <Button label={t("collectionsList.importOpenItems")} icon="pi pi-upload" className="p-button-outlined p-button-rounded ml-2" onClick={() => setShowOpenItems(true)} />
        )}
      </div>
      <ImportDialog visible={showOpenItems} onHide={() => setShowOpenItems(false)} title={t("collectionsList.importOpenItemsTitle")} targets={openItemsUpload(t)} goLiveDate onDone={() => loadCollections()}
        note={t("collectionsList.importOpenItemsNote")} />

      <Card>
        <div className="filter-section">
          <div className="p-inputgroup">
            <span className="p-inputgroup-addon">
              <i className="pi pi-search"></i>
            </span>
            <InputText
              placeholder={t("collectionsList.searchPlaceholder")}
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
            />
          </div>

          <Dropdown
            value={filters.status}
            options={statusOptions}
            onChange={(e) => handleFilterChange("status", e.value)}
            placeholder={t("collectionsList.filterByStatus")}
          />

          <Dropdown
            value={filters.overdueLevel}
            options={overdueLevelOptions}
            onChange={(e) => handleFilterChange("overdueLevel", e.value)}
            placeholder={t("collectionsList.filterByOverdueLevel")}
          />
        </div>

        <div className="collections-table-container">
          <DataTable
            value={collections}
            lazy
            paginator
            first={lazyState.first}
            rows={lazyState.rows}
            totalRecords={totalRecords}
            onPage={onPage}
            onSort={onSort}
            loading={loading}
            dataKey="id"
            emptyMessage="No collections found"
            className="collections-table"
            sortField={lazyState.sortField}
            sortOrder={lazyState.sortOrder}
          >
            <Column
              field="client"
              header={t("tables.clientName")}
              body={clientBodyTemplate}
              style={{ minWidth: "150px" }}
            />
            <Column
              field="policyNumber"
              header={t("tables.policyNo")}
              body={policyBodyTemplate}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="outstandingAmount"
              header={t("tables.outstanding")}
              body={outstandingBodyTemplate}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="currentAmount"
              header={t("tables.current")}
              body={currentBodyTemplate}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="days1to30Amount"
              header={t("tables.days1To30")}
              body={days1to30BodyTemplate}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="days31to60Amount"
              header={t("tables.days31To60")}
              body={days31to60BodyTemplate}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="days61to90Amount"
              header={t("tables.days61To90")}
              body={days61to90BodyTemplate}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="over90DaysAmount"
              header={t("tables.over90Days")}
              body={over90BodyTemplate}
              style={{ minWidth: "110px" }}
            />
            <Column
              field="dueDate"
              header={t("tables.dueDate")}
              body={dueDateBodyTemplate}
              style={{ minWidth: "100px" }}
            />
            <Column
              field="collectionStatus"
              header={t("tables.status")}
              body={statusBodyTemplate}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="daysPastDue"
              header={t("tables.daysOverdue")}
              body={daysPastDueBodyTemplate}
              sortFunction={daysPastDueSortFunction}
              style={{ minWidth: "110px" }}
              sortable
            />
            <Column
              header={t("tables.actions")}
              body={actionsBodyTemplate}
              style={{ minWidth: "100px" }}
            />
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default CollectionsList;
