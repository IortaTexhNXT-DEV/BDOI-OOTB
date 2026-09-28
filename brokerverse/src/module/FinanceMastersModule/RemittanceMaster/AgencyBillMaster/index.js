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
import remittanceService from "../../../../services/remittanceService";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { isoDate, showError } from "../../../Remittance/shared";
import { saveAndReturn } from "../masterRecord";
import "./index.scss";

const AgencyBillMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = React.useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [outstandingBills, setOutstandingBills] = useState([]);
  const { formatCurrency } = useFormatCurrency();

  useEffect(() => {
    const today = isoDate(new Date());
    remittanceService.listAgencyBills({ perPage: 200 })
      .then((rows) => setOutstandingBills((rows || [])
        .filter((b) => !["settled", "rejected", "cancelled"].includes(b.statusCode))
        .map((b) => ({
          ...b,
          billNo: b.billNumber,
          agency: b.agencyName,
          amount: b.billAmount,
          balance: b.totalDue,
          daysOverdue: b.dueDate && b.dueDate < today ? Math.floor((Date.parse(today) - Date.parse(b.dueDate)) / 86400000) : 0
        }))))
      .catch((error) => showError(toast, error));
  }, []);

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
        setFormData((prev) => ({
          ...prev,
          configCode: data.code,
          configName: data.name,
          billingFrequency: data.billingFrequency || prev.billingFrequency,
          billDate: data.billDate ?? prev.billDate,
          dueDays: data.dueDays ?? prev.dueDays,
          paymentTerms: data.paymentTerms || prev.paymentTerms,
          lateFeeType: data.lateFee?.type || prev.lateFeeType,
          lateFeeRate: data.lateFee?.rate ?? prev.lateFeeRate,
          gracePeriod: data.lateFee?.gracePeriod ?? prev.gracePeriod
        }));
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
    await saveAndReturn({
      type: "remittance-agency-bill",
      id: data?.id,
      toast,
      navigate,
      record: {
        code: formData.configCode,
        name: formData.configName,
        billingFrequency: formData.billingFrequency,
        billDate: formData.billDate,
        dueDays: formData.dueDays,
        paymentTerms: formData.paymentTerms,
        lateFee: { type: formData.lateFeeType, rate: formData.lateFeeRate, gracePeriod: formData.gracePeriod }
      }
    });
    setIsLoading(false);
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
              body={(rowData) => formatCurrency(rowData.amount)}
              style={{ width: '12%' }}
            />
            <Column
              field="balance"
              header="Balance"
              body={(rowData) => formatCurrency(rowData.balance)}
              style={{ width: '12%' }}
            />
            <Column
              field="status"
              header="Status"
              body={(rowData) => (
                <span className={`status-badge status-${String(rowData.status).toLowerCase().replace(/\s+/g, '-')}`}>
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