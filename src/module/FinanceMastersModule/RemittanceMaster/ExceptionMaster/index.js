import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { Card } from "primereact/card";
import { BreadCrumb } from "primereact/breadcrumb";
import { Toast } from "primereact/toast";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import { exceptionMasterData, mockCrudOperations } from "../../../../services/mockData/remittanceMockData";
import "./index.scss";

const ExceptionMaster = () => {
  const { t } = useTranslation();
  const { currencyCode } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = React.useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeExceptions, setActiveExceptions] = useState(exceptionMasterData.activeExceptions);

  const [formData, setFormData] = useState({
    amountVarianceThreshold: 100.00,
    percentVarianceThreshold: 5,
    dateVarianceDays: 30,
    duplicateCheckPeriod: 90,
    autoResolveLimit: 1000.00,
    writeOffLimit: 50.00,
    adjustmentApprovalLimit: 5000.00,
    exceptionHoldingAccount: "",
    writeOffAccount: "",
    adjustmentAccount: "",
    varianceAccount: ""
  });

  const [exceptionTypes, setExceptionTypes] = useState(exceptionMasterData.exceptionTypes);

  const severityOptions = [
    { label: "Critical", value: "Critical" },
    { label: "High", value: "High" },
    { label: "Medium", value: "Medium" },
    { label: "Low", value: "Low" }
  ];

  const categoryOptions = [
    { label: "Data Quality", value: "Data Quality" },
    { label: "Configuration", value: "Configuration" },
    { label: "Financial", value: "Financial" },
    { label: "Missing Document", value: "Missing Document" },
    { label: "System Error", value: "System Error" }
  ];

  const resolutionActionOptions = [
    { label: "Manual Review", value: "Manual Review" },
    { label: "Auto Resolve", value: "Auto Resolve" },
    { label: "Hold for Approval", value: "Hold for Approval" },
    { label: "Reject Transaction", value: "Reject Transaction" }
  ];

  const notifyRoleOptions = [
    { label: "User", value: "User" },
    { label: "Supervisor", value: "Supervisor" },
    { label: "Manager", value: "Manager" },
    { label: "Finance Head", value: "Finance Head" }
  ];

  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Exception Management", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        setFormData({
          amountVarianceThreshold: 500.00,
          percentVarianceThreshold: 2.5,
          dateVarianceDays: 15,
          duplicateCheckPeriod: 60,
          autoResolveLimit: 1000.00,
          writeOffLimit: 100.00,
          adjustmentApprovalLimit: 5000.00,
          exceptionHoldingAccount: "1005",
          writeOffAccount: "4003",
          adjustmentAccount: "4004",
          varianceAccount: "4005"
        });
      }
    }
  }, [mode, data]);

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const exceptionData = {
        ...formData,
        exceptionTypes,
        status: "Active"
      };

      let result;
      if (mode === "edit") {
        result = await mockCrudOperations.update("exception-master", data?.id || 1, exceptionData);
        toast.current.show({
          severity: "success",
          summary: "Success",
          detail: "Exception configuration updated successfully",
          life: 3000
        });
      } else {
        result = await mockCrudOperations.create("exception-master", exceptionData);
        toast.current.show({
          severity: "success",
          summary: "Success",
          detail: "Exception configuration created successfully",
          life: 3000
        });
      }

      console.log("Exception operation result:", result);

      setTimeout(() => {
        navigate("/master/finance/remittance");
      }, 1000);
    } catch (error) {
      console.error("Save error:", error);
      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to save exception configuration",
        life: 3000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const addExceptionType = () => {
    setExceptionTypes([
      ...exceptionTypes,
      {
        id: Date.now(),
        code: `EXC-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        name: "",
        category: "Data Quality",
        severity: "Medium",
        autoResolve: false,
        resolutionSteps: [],
        notification: ["email"],
        sla: "24 hours",
        glImpact: false,
        status: "Active"
      }
    ]);
  };

  const onCellEdit = (e) => {
    const updatedTypes = [...exceptionTypes];
    const index = updatedTypes.findIndex(t => t.id === e.rowData.id);
    if (index !== -1) {
      updatedTypes[index][e.field] = e.value;
      setExceptionTypes(updatedTypes);
    }
  };

  const deleteExceptionType = (rowData) => {
    const newTypes = exceptionTypes.filter(type => type.id !== rowData.id);
    setExceptionTypes(newTypes);
  };

  const activeEditor = (options) => (
    <Checkbox
      checked={options.value}
      onChange={(e) => options.editorCallback(e.checked)}
    />
  );

  return (
    <div className="exception-master">
      <Toast ref={toast} />

      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Card className="main-card">
        <div className="card-header">
          <h3>Exception Master</h3>
          <div className="header-actions">
            <Button
              label="Save"
              icon="pi pi-save"
              className="p-button-sm p-button-success"
              onClick={handleSave}
              disabled={mode === "view"}
              loading={isLoading}
            />
            <Button
              label={t("common.cancel")}
              icon="pi pi-times"
              className="p-button-sm p-button-secondary"
              onClick={handleCancel}
            />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="Exception Configuration">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Variance Thresholds
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="amountVarianceThreshold">Amount Variance Threshold</label>
                  <InputNumber
                    id="amountVarianceThreshold"
                    value={formData.amountVarianceThreshold}
                    onValueChange={(e) => setFormData({ ...formData, amountVarianceThreshold: e.value })}
                    mode="currency"
                    currency={currencyCode}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="percentVarianceThreshold">Percentage Variance Threshold</label>
                  <InputNumber
                    id="percentVarianceThreshold"
                    value={formData.percentVarianceThreshold}
                    onValueChange={(e) => setFormData({ ...formData, percentVarianceThreshold: e.value })}
                    suffix="%"
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="dateVarianceDays">Date Variance (Days)</label>
                  <InputNumber
                    id="dateVarianceDays"
                    value={formData.dateVarianceDays}
                    onValueChange={(e) => setFormData({ ...formData, dateVarianceDays: e.value })}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Auto Resolution Settings
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="autoResolveLimit">Auto Resolve Limit</label>
                  <InputNumber
                    id="autoResolveLimit"
                    value={formData.autoResolveLimit}
                    onValueChange={(e) => setFormData({ ...formData, autoResolveLimit: e.value })}
                    mode="currency"
                    currency={currencyCode}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="writeOffLimit">Write-off Limit</label>
                  <InputNumber
                    id="writeOffLimit"
                    value={formData.writeOffLimit}
                    onValueChange={(e) => setFormData({ ...formData, writeOffLimit: e.value })}
                    mode="currency"
                    currency={currencyCode}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="adjustmentApprovalLimit">Adjustment Approval Limit</label>
                  <InputNumber
                    id="adjustmentApprovalLimit"
                    value={formData.adjustmentApprovalLimit}
                    onValueChange={(e) => setFormData({ ...formData, adjustmentApprovalLimit: e.value })}
                    mode="currency"
                    currency={currencyCode}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Exception Types">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Exception Type Configuration
              </h4>
              <div className="mb-3">
                <Button
                  label={t("remittance.addExceptionType")}
                  icon="pi pi-plus"
                  onClick={addExceptionType}
                  disabled={mode === "view"}
                  className="p-button-sm"
                />
              </div>
              <DataTable
                value={exceptionTypes}
                editMode="cell"
                className="editable-cells-table"
                showGridlines
              >
                <Column
                  field="code"
                  header="Exception Code"
                  style={{ width: '15%' }}
                />
                <Column
                  field="name"
                  header="Exception Name"
                  editor={(options) => (
                    <InputText
                      value={options.value}
                      onChange={(e) => options.editorCallback(e.target.value)}
                    />
                  )}
                  onCellEditComplete={onCellEdit}
                  style={{ width: '25%' }}
                />
                <Column
                  field="category"
                  header="Category"
                  editor={(options) => (
                    <Dropdown
                      value={options.value}
                      options={categoryOptions}
                      onChange={(e) => options.editorCallback(e.value)}
                    />
                  )}
                  onCellEditComplete={onCellEdit}
                  style={{ width: '15%' }}
                />
                <Column
                  field="severity"
                  header="Severity"
                  editor={(options) => (
                    <Dropdown
                      value={options.value}
                      options={severityOptions}
                      onChange={(e) => options.editorCallback(e.value)}
                    />
                  )}
                  onCellEditComplete={onCellEdit}
                  style={{ width: '12%' }}
                />
                <Column
                  field="autoResolve"
                  header="Auto Resolve"
                  editor={activeEditor}
                  body={(rowData) => <Checkbox checked={rowData.autoResolve} disabled />}
                  onCellEditComplete={onCellEdit}
                  style={{ width: '13%', textAlign: 'center' }}
                />
                <Column
                  field="sla"
                  header="SLA"
                  style={{ width: '10%' }}
                />
                <Column
                  header="Actions"
                  body={(rowData) => (
                    <Button
                      icon="pi pi-trash"
                      className="p-button-sm p-button-text p-button-danger"
                      onClick={() => deleteExceptionType(rowData)}
                      disabled={mode === "view"}
                    />
                  )}
                  style={{ width: '10%' }}
                />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Active Exceptions">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Current Active Exceptions
              </h4>
              <DataTable
                value={activeExceptions}
                responsiveLayout="scroll"
                className="mt-3"
                emptyMessage="No active exceptions"
                showGridlines
              >
                <Column
                  field="exceptionCode"
                  header="Exception Code"
                  style={{ width: '15%' }}
                />
                <Column
                  field="referenceNo"
                  header="Reference No"
                  style={{ width: '15%' }}
                />
                <Column
                  field="description"
                  header="Description"
                  style={{ width: '25%' }}
                />
                <Column
                  field="detectedOn"
                  header="Detected On"
                  style={{ width: '15%' }}
                />
                <Column
                  field="severity"
                  header="Severity"
                  body={(rowData) => (
                    <span className={`severity-badge severity-${rowData.severity.toLowerCase()}`}>
                      {rowData.severity}
                    </span>
                  )}
                  style={{ width: '10%' }}
                />
                <Column
                  field="assignedTo"
                  header="Assigned To"
                  style={{ width: '15%' }}
                />
                <Column
                  field="slaRemaining"
                  header="SLA Remaining"
                  style={{ width: '10%' }}
                />
              </DataTable>
            </div>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

export default ExceptionMaster;