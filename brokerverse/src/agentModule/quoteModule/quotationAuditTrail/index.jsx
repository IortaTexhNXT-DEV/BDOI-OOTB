import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Skeleton } from "primereact/skeleton";
import { Message } from "primereact/message";
import { getQuotationAuditTrail } from "./store/auditTrailMiddleware";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

const QuotationAuditTrail = ({ quotationId: propQuotationId }) => {
  const { t } = useTranslation();
  const { quotationId: urlQuotationId } = useParams();
  const dispatch = useDispatch();
  const [sortOrder, setSortOrder] = useState("desc");

  // Use prop quotationId if provided, otherwise use URL param
  const quotationId = propQuotationId || urlQuotationId;

  const { auditTrailData, quotationDetails, loading, error } = useSelector(
    ({ quotationAuditTrailReducers }) => ({
      auditTrailData: quotationAuditTrailReducers?.auditTrailData || [],
      quotationDetails: quotationAuditTrailReducers?.quotationDetails || {},
      loading: quotationAuditTrailReducers?.loading || false,
      error: quotationAuditTrailReducers?.error || null,
    })
  );

  useEffect(() => {
    if (quotationId) {
      dispatch(getQuotationAuditTrail(quotationId, sortOrder));
    }
  }, [dispatch, quotationId, sortOrder]);

  const handleSortChange = (e) => {
    setSortOrder(e.value);
  };

  const sortOptions = [
    { label: "Newest First", value: "desc" },
    { label: "Oldest First", value: "asc" },
  ];

  const formatDateTime = (dateString) => {
    if (!dateString) {
      return "N/A";
    }

    try {
      const date = new Date(dateString);

      // Check if the date is valid
      if (Number.isNaN(date.getTime())) {
        return "Invalid Date";
      }

      const formatted = formatAppDate(date, { withTime: true });

      return formatted;
    } catch (error) {
      return "Date Error";
    }
  };

  const renderDate = (rowData) => {
    const timestamp =
      rowData.date ||
      rowData.createdAt ||
      rowData.timestamp ||
      rowData.created_at ||
      rowData.updatedAt ||
      rowData.updated_at ||
      rowData.dateTime ||
      rowData.date_time;

    return <div className="audit-date">{formatDateTime(timestamp)}</div>;
  };

  const renderAction = (rowData) => {
    return (
      <div className="audit-action">
        {rowData.action || rowData.operation || "N/A"}
      </div>
    );
  };

  const renderFieldName = (rowData) => {
    return (
      <div className="audit-field-name">
        {rowData.fieldName || rowData.field_name || rowData.field || "N/A"}
      </div>
    );
  };

  const formatValue = (value) => {
    if (!value || value === "N/A") return "N/A";

    try {
      // Check if it's a JSON string
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          const itemKey =
            typeof item === "object" ? JSON.stringify(item) : String(item);
          const uniqueKey = `${itemKey.slice(
            0,
            30
          )}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          return (
            <div key={uniqueKey} className="value-item">
              •{" "}
              {typeof item === "object"
                ? JSON.stringify(item, null, 2)
                : String(item)}
            </div>
          );
        });
      } else if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed).map(([key, val]) => (
          <div
            key={`object-${key}-${JSON.stringify(val).slice(0, 20)}`}
            className="value-item"
          >
            • <strong>{key}:</strong>{" "}
            {typeof val === "object"
              ? JSON.stringify(val, null, 2)
              : String(val)}
          </div>
        ));
      }
      return value;
    } catch {
      // If not JSON, check if it's a string with multiple lines or separators
      if (
        typeof value === "string" &&
        (value.includes("\n") || value.includes(";") || value.includes(","))
      ) {
        const items = value.split(/[\n;,]/).filter((item) => item.trim());
        if (items.length > 1) {
          return items.map((item) => {
            const uniqueKey = `${item
              .trim()
              .slice(0, 30)}-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 11)}`;
            return (
              <div key={uniqueKey} className="value-item">
                • {item.trim()}
              </div>
            );
          });
        }
      }
      return value;
    }
  };

  const renderOldValue = (rowData) => {
    const value = rowData.oldValue || rowData.old_value || "N/A";
    return <div className="audit-old-value">{formatValue(value)}</div>;
  };

  const renderNewValue = (rowData) => {
    const value = rowData.newValue || rowData.new_value || "N/A";
    return <div className="audit-new-value">{formatValue(value)}</div>;
  };

  const renderUser = (rowData) => {
    // Check for the new API response structure with user object
    if (
      rowData.user &&
      typeof rowData.user === "object" &&
      rowData.user.displayName
    ) {
      return <div className="audit-user">{rowData.user.displayName}</div>;
    }

    // Fallback to old structure for backward compatibility
    return (
      <div className="audit-user">
        {rowData.user || rowData.createdBy || rowData.updatedBy || "System"}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="audit-trail-container">
        <div className="quotation-info">
          <Skeleton height="2rem" className="mb-2" />
          <Skeleton height="1rem" className="mb-2" />
        </div>
        <div className="audit-table">
          <Skeleton height="3rem" className="mb-2" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height="2rem" className="mb-1" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="audit-trail-container">
        <Message
          severity="error"
          text={`Error loading audit trail: ${error}`}
        />
      </div>
    );
  }

  return (
    <div className="audit-trail-container">
      {/* Quotation Information Header */}
      <div className="quotation-info">
        <Card className="quotation-info-card">
          <div className="quotation-details">
            <div className="quotation-number">
              <strong>Quotation Number:</strong>{" "}
              {quotationDetails.quotationNumber || quotationId}
            </div>
            <div className="quotation-status">
              <strong>Status:</strong>{" "}
              {quotationDetails.quotationStatus || "N/A"}
            </div>
          </div>
        </Card>
      </div>

      {/* Sort Controls */}
      <div className="sort-controls">
        <div className="sort-dropdown">
          <label htmlFor="sortOrder">Sort by Date:</label>
          <Dropdown
            id="sortOrder"
            value={sortOrder}
            options={sortOptions}
            onChange={handleSortChange}
            placeholder={t("agent.selectSortOrder")}
            className="sort-dropdown-field"
          />
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="audit-table">
        <Card>
          <DataTable
            value={auditTrailData}
            className="audit-trail-table"
            emptyMessage="No audit trail records found"
            tableStyle={{ minWidth: "60rem" }}
          >
            <Column
              field="date"
              header={t("tables.dateTime")}
              body={renderDate}
              style={{ width: "15%" }}
            />
            <Column
              field="action"
              header={t("tables.action")}
              body={renderAction}
              style={{ width: "15%" }}
            />
            <Column
              field="fieldName"
              header={t("tables.fieldName")}
              body={renderFieldName}
              style={{ width: "15%" }}
            />
            <Column
              field="oldValue"
              header={t("tables.previousValue")}
              body={renderOldValue}
              style={{ width: "25%" }}
            />
            <Column
              field="newValue"
              header={t("tables.updatedValue")}
              body={renderNewValue}
              style={{ width: "25%" }}
            />
            <Column
              field="user"
              header={t("tables.modifiedBy")}
              body={renderUser}
              style={{ width: "5%" }}
            />
          </DataTable>
        </Card>
      </div>
    </div>
  );
};

export default QuotationAuditTrail;
