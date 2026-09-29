import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Toast } from "primereact/toast";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import { agencyBillData, mockCrudOperations } from "../../../../services/mockData/remittanceMockData";
import "./index.scss";

const AgencyBillMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = React.useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [outstandingBills, setOutstandingBills] = useState(agencyBillData.outstandingBills);

  const [formData, setFormData] = useState({
    configCode: "",
    configName: "",
    billingFrequency: "Monthly",
    billDate: 1,
    dueDays: 30,
    paymentTerms: "Net 30",
    lateFeeType: "Percentage",
    lateFeeRate: 1.5,
    gracePeriod: 5
  });

  const frequencyOptions = [
    { label: "Monthly", value: "Monthly" },
    { label: "Quarterly", value: "Quarterly" },
    { label: "Annually", value: "Annually" }
  ];

  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Agency Bill Master", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        const configData = agencyBillData.configurations.find(c => c.id === data.id) || data;
        setFormData({
          configCode: configData.code || "ABL-001",
          configName: configData.name || "Standard Agency Billing",
          billingFrequency: configData.billingFrequency || "Monthly",
          billDate: configData.billDate || 1,
          dueDays: configData.dueDays || 30,
          paymentTerms: configData.paymentTerms || "Net 30",
          lateFeeType: configData.lateFee?.type || "Percentage",
          lateFeeRate: configData.lateFee?.rate || 1.5,
          gracePeriod: configData.lateFee?.gracePeriod || 5
        });
      }
    } else {
      setFormData(prev => ({
        ...prev,
        configCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 1000);
    return `ABL-${String(random).padStart(3, '0')}`;
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const billData = {
        ...formData,
        status: "Active"
      };

      let result;
      if (mode === "edit") {
        result = await mockCrudOperations.update("agency-bill", data.id, billData);
        toast.current.show({
          severity: "success",
          summary: "Success",
          detail: "Agency bill configuration updated successfully",
          life: 3000
        });
      } else {
        result = await mockCrudOperations.create("agency-bill", billData);
        toast.current.show({
          severity: "success",
          summary: "Success",
          detail: "Agency bill configuration created successfully",
          life: 3000
        });
      }

      setTimeout(() => {
        navigate("/master/finance/remittance");
      }, 1000);
    } catch (error) {
      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to save agency bill configuration",
        life: 3000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  return (
    <div className="agency-bill-master">
      <Toast ref={toast} />

      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Card className="main-card">
        <div className="card-header">
          <h3>Agency Bill Master</h3>
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

        <div className="form-section">
          <h4 className="section-title">
            <SvgDot />
            Billing Configuration
          </h4>
          <div className="form-grid three-column">
            <div className="form-field">
              <label htmlFor="configCode">Config Code *</label>
              <InputText
                id="configCode"
                value={formData.configCode}
                onChange={(e) => setFormData({ ...formData, configCode: e.target.value })}
                disabled={mode === "edit" || mode === "view"}
                className="w-full"
              />
            </div>
            <div className="form-field">
              <label htmlFor="configName">Config Name *</label>
              <InputText
                id="configName"
                value={formData.configName}
                onChange={(e) => setFormData({ ...formData, configName: e.target.value })}
                disabled={mode === "view"}
                className="w-full"
              />
            </div>
            <div className="form-field">
              <label htmlFor="billingFrequency">Billing Frequency</label>
              <Dropdown
                id="billingFrequency"
                value={formData.billingFrequency}
                options={frequencyOptions}
                onChange={(e) => setFormData({ ...formData, billingFrequency: e.value })}
                disabled={mode === "view"}
                className="w-full"
              />
            </div>
            <div className="form-field">
              <label htmlFor="billDate">Bill Date</label>
              <InputNumber
                id="billDate"
                value={formData.billDate}
                onValueChange={(e) => setFormData({ ...formData, billDate: e.value })}
                min={1}
                max={31}
                disabled={mode === "view"}
                className="w-full"
              />
            </div>
            <div className="form-field">
              <label htmlFor="dueDays">Due Days</label>
              <InputNumber
                id="dueDays"
                value={formData.dueDays}
                onValueChange={(e) => setFormData({ ...formData, dueDays: e.value })}
                disabled={mode === "view"}
                className="w-full"
              />
            </div>
            <div className="form-field">
              <label htmlFor="lateFeeRate">Late Fee Rate (%)</label>
              <InputNumber
                id="lateFeeRate"
                value={formData.lateFeeRate}
                onValueChange={(e) => setFormData({ ...formData, lateFeeRate: e.value })}
                mode="decimal"
                minFractionDigits={1}
                disabled={mode === "view"}
                className="w-full"
              />
            </div>
          </div>

          <h4 className="section-title mt-4">
            <SvgDot />
            Outstanding Bills
          </h4>
          <DataTable
            value={outstandingBills}
            responsiveLayout="scroll"
            className="mt-3"
            emptyMessage="No outstanding bills"
            showGridlines
          >
            <Column field="billNo" header="Bill No" style={{ width: '15%' }} />
            <Column field="agency" header="Agency" style={{ width: '20%' }} />
            <Column field="billDate" header="Bill Date" style={{ width: '12%' }} />
            <Column field="dueDate" header="Due Date" style={{ width: '12%' }} />
            <Column
              field="amount"
              header="Amount"
              body={(rowData) => `$${rowData.amount.toLocaleString()}`}
              style={{ width: '12%' }}
            />
            <Column
              field="balance"
              header="Balance"
              body={(rowData) => `$${rowData.balance.toLocaleString()}`}
              style={{ width: '12%' }}
            />
            <Column
              field="status"
              header="Status"
              body={(rowData) => (
                <span className={`status-badge status-${rowData.status.toLowerCase()}`}>
                  {rowData.status}
                </span>
              )}
              style={{ width: '12%' }}
            />
            <Column field="daysOverdue" header="Days Overdue" style={{ width: '5%' }} />
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default AgencyBillMaster;