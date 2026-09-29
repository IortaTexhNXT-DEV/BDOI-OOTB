import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Skeleton } from "primereact/skeleton";
import { Message } from "primereact/message";
import { getClaimAuditTrail } from "./store/auditTrailMiddleWare";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

const ClaimAuditTrail = () => {
  const { t } = useTranslation();
  const { claimId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [sortOrder, setSortOrder] = useState("desc");

  const { auditTrailData, claimDetails, loading, error } = useSelector(
    ({ auditTrailReducers }) => ({
      auditTrailData: auditTrailReducers?.auditTrailData || [],
      claimDetails: auditTrailReducers?.claimDetails || {},
      loading: auditTrailReducers?.loading || false,
      error: auditTrailReducers?.error || null,
    })
  );

  useEffect(() => {
    if (claimId) {
      console.log(
        "Fetching audit trail for claimId:",
        claimId,
        "sortOrder:",
        sortOrder
      );
      dispatch(getClaimAuditTrail(claimId, sortOrder));
    }
  }, [dispatch, claimId, sortOrder]);

  // Debug: Log the audit trail data when it changes
  useEffect(() => {
    if (auditTrailData && auditTrailData.length > 0) {
      console.log("Audit trail data received:", auditTrailData);
      console.log("First record:", auditTrailData[0]);
    }
  }, [auditTrailData]);

  const handleBack = () => {
    navigate("/agent/claim");
  };

  const handleSortChange = (e) => {
    setSortOrder(e.value);
  };

  const sortOptions = [
    { label: t("claimAuditTrail.newestFirst"), value: "desc" },
    { label: t("claimAuditTrail.oldestFirst"), value: "asc" },
  ];

  const formatDateTime = (dateString) => {
    if (!dateString) {
      console.log("No date string provided");
      return t("claimAuditTrail.nA");
    }

    console.log("Formatting date:", dateString);

    try {
      const date = new Date(dateString);

      // Check if the date is valid
      if (Number.isNaN(date.getTime())) {
        console.log("Invalid date:", dateString);
        return t("claimAuditTrail.invalidDate");
      }

      const formatted = formatAppDate(date, { withTime: true });

      console.log("Formatted date:", formatted);
      return formatted;
    } catch (error) {
      console.log("Error formatting date:", error, "Input:", dateString);
      return t("claimAuditTrail.dateError");
    }
  };

  const renderDate = (rowData) => {
    // Debug: Log the rowData to see what fields are available
    console.log("Audit trail row data:", rowData);

    // Check for various possible timestamp field names
    const timestamp =
      rowData.date ||
      rowData.createdAt ||
      rowData.timestamp ||
      rowData.created_at ||
      rowData.updatedAt ||
      rowData.updated_at ||
      rowData.dateTime ||
      rowData.date_time;

    console.log("Found timestamp:", timestamp);

    return <div className="audit-date">{formatDateTime(timestamp)}</div>;
  };

  const renderAction = (rowData) => {
    return (
      <div className="audit-action">
        {rowData.action || rowData.operation || t("claimAuditTrail.nA")}
      </div>
    );
  };

  const renderFieldName = (rowData) => {
    return (
      <div className="audit-field-name">
        {rowData.fieldName || rowData.field_name || rowData.field || t("claimAuditTrail.nA")}
      </div>
    );
  };

  const formatValue = (value) => {
    if (!value || value === "N/A") return t("claimAuditTrail.nA");

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
    const value = rowData.oldValue || rowData.old_value || t("claimAuditTrail.nA");
    return <div className="audit-old-value">{formatValue(value)}</div>;
  };

  const renderNewValue = (rowData) => {
    const value = rowData.newValue || rowData.new_value || t("claimAuditTrail.nA");
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
        {rowData.user || rowData.createdBy || rowData.updatedBy || t("claimAuditTrail.system")}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="audit-trail-container">
        <div className="header">
          <h2>{t("claimAuditTrail.title")}</h2>
          <div className="actions">
            <Button
              label={t("claimAuditTrail.back")}
              icon="pi pi-arrow-left"
              className="p-button-outlined"
              onClick={handleBack}
            />
          </div>
        </div>
        <div className="claim-info">
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
        <div className="header">
          <h2>{t("claimAuditTrail.title")}</h2>
          <div className="actions">
            <Button
              label={t("claimAuditTrail.back")}
              icon="pi pi-arrow-left"
              className="p-button-outlined"
              onClick={handleBack}
            />
          </div>
        </div>
        <Message
          severity="error"
          text={t("claimAuditTrail.errorLoading", { error })}
        />
      </div>
    );
  }

  return (
    <div className="audit-trail-container">
      <div className="header">
        <h2>{t("claimAuditTrail.title")}</h2>
        <div className="actions">
          <Button
            label={t("claimAuditTrail.back")}
            icon="pi pi-arrow-left"
            className="p-button-outlined"
            onClick={handleBack}
          />
        </div>
      </div>

      {/* Claim Information Header */}
      <div className="claim-info">
        <Card className="claim-info-card">
          <div className="claim-details">
            <div className="claim-number">
              <strong>{t("claimAuditTrail.claimNumber")}</strong>{" "}
              {claimDetails.claimNumber || claimId}
            </div>
            <div className="policy-holder">
              <strong>{t("claimAuditTrail.policyHolder")}</strong>{" "}
              {claimDetails.policyHolderName ||
                claimDetails.policy?.insuredName ||
                t("claimAuditTrail.nA")}
            </div>
          </div>
        </Card>
      </div>

      {/* Sort Controls */}
      <div className="sort-controls">
        <div className="sort-dropdown">
          <label htmlFor="sortOrder">{t("claimAuditTrail.sortByDate")}</label>
          <Dropdown
            id="sortOrder"
            value={sortOrder}
            options={sortOptions}
            onChange={handleSortChange}
            placeholder={t("claimAuditTrail.selectSortOrder")}
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
            emptyMessage={t("claimAuditTrail.noRecordsFound")}
            tableStyle={{ minWidth: "60rem" }}
          >
            <Column
              field="timestamp"
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

export default ClaimAuditTrail;
