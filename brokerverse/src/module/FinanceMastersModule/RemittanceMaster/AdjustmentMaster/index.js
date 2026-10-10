import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Toast } from "primereact/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import DetailHeader from "../../../../components/DetailHeader";
import DetailSection from "../../../../components/DetailSection";
import KeyValueGrid from "../../../../components/KeyValueGrid";
import { RecordActivityLog } from "../../../../components/ActivityLog";
import { masterService } from "../../../../services/remittanceService";
import { showError } from "../../../Remittance/shared";
import { MASTER_HOME, saveRecord } from "../masterRecord";
import "./index.scss";

const TYPE = "remittance-adjustment-type";
const toRow = (type) => ({
  id: type.id,
  adjustmentCode: type.code,
  adjustmentName: type.name,
  category: type.category,
  adjustmentNature: type.glAccounts ? "Debit/Credit" : "Credit",
  glAccount: type.glAccounts ? `${type.glAccounts.debit}/${type.glAccounts.credit}` : "",
  requiresApproval: type.requiresApproval,
  approvalLimit: Number(type.approvalLimit || 0),
  active: type.status === "Active"
});
const toRecord = (row) => {
  const [debit, credit] = String(row.glAccount || "").split("/");
  return {
    code: row.adjustmentCode,
    name: row.adjustmentName,
    category: row.category,
    glAccounts: { debit: debit || null, credit: credit || null },
    requiresApproval: row.requiresApproval,
    approvalLimit: row.approvalLimit,
    isActive: row.active
  };
};

const AdjustmentMaster = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const navigate = useNavigate();
  const { mode } = useParams();
  const isViewMode = mode === "view";
  const toast = React.useRef(null);
  const location = useLocation();

  // Adjustment types are records of the remittance-adjustment-type master
  const [adjustmentTypes, setAdjustmentTypes] = useState([]);
  const [removedIds, setRemovedIds] = useState([]);

  useEffect(() => {
    masterService.list(TYPE)
      .then((rows) => setAdjustmentTypes((rows || []).map(toRow)))
      .catch((error) => showError(toast, error));
  }, []);

  // Adjustment rules state
  const [maxAdjustmentAmount, setMaxAdjustmentAmount] = useState(10000);
  const [maxAdjustmentPercent, setMaxAdjustmentPercent] = useState(10);
  const [frequencyLimit, setFrequencyLimit] = useState(3);

  // Approval matrix state
  const [approvalMatrix, setApprovalMatrix] = useState({
    User: { Premium: 100, Commission: 100, Tax: 100, Fee: 100, Refund: 0 },
    Supervisor: { Premium: 1000, Commission: 1000, Tax: 1000, Fee: 500, Refund: 500 },
    Manager: { Premium: 5000, Commission: 5000, Tax: 5000, Fee: 2500, Refund: 2500 },
    "Finance Head": { Premium: 25000, Commission: 25000, Tax: 25000, Fee: 10000, Refund: 10000 },
    CFO: { Premium: 999999999, Commission: 999999999, Tax: 999999999, Fee: 999999999, Refund: 999999999 }
  });

  const categoryOptions = [
    { label: "Premium", value: "Premium" },
    { label: "Commission", value: "Commission" },
    { label: "Tax", value: "Tax" },
    { label: "Fee", value: "Fee" },
    { label: "Penalty", value: "Penalty" },
    { label: "Refund", value: "Refund" }
  ];

  const natureOptions = [
    { label: "Debit", value: "Debit" },
    { label: "Credit", value: "Credit" }
  ];

  const handleSave = async () => {
    try {
      await Promise.all(removedIds.map((id) => masterService.remove(TYPE, id)));
      await Promise.all(adjustmentTypes.map((row) => saveRecord(TYPE, row.isNew ? null : row.id, toRecord(row))));
      setRemovedIds([]);

      toast.current.show({
        severity: 'success',
        summary: 'Success',
        detail: 'Adjustment Master configuration saved successfully',
        life: 3000
      });

      setTimeout(() => {
        navigate(MASTER_HOME);
      }, 1500);
    } catch (error) {
      showError(toast, error, 'Failed to save configuration');
    }
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const handleAddType = () => {
    const newType = {
      id: Date.now(),
      isNew: true,
      adjustmentCode: "",
      adjustmentName: "",
      category: "Premium",
      adjustmentNature: "Credit",
      glAccount: "",
      requiresApproval: true,
      approvalLimit: 0,
      active: true
    };
    setAdjustmentTypes([...adjustmentTypes, newType]);

    toast.current.show({
      severity: 'info',
      summary: 'Info',
      detail: 'New adjustment type added. Please fill in the details.',
      life: 3000
    });
  };

  const onCellEdit = (e) => {
    const updatedTypes = adjustmentTypes.map(type =>
      type.id === e.rowData.id ? { ...type, [e.field]: e.value } : type
    );
    setAdjustmentTypes(updatedTypes);
  };

  const textEditor = (options) => {
    return (
      <InputText
        value={options.value}
        onChange={(e) => options.editorCallback(e.target.value)}
      />
    );
  };

  const dropdownEditor = (options, optionsList) => {
    return (
      <Dropdown
        value={options.value}
        options={optionsList}
        onChange={(e) => options.editorCallback(e.value)}
      />
    );
  };


  const numberEditor = (options) => {
    return (
      <InputNumber
        value={options.value}
        onValueChange={(e) => options.editorCallback(e.value)}
        mode="currency"
        currency={currencyCode}
      />
    );
  };

  const deleteTemplate = (rowData) => {
    return (
      <Button
        icon="pi pi-trash"
        className="p-button-text p-button-danger"
        onClick={() => {
          if (!rowData.isNew) setRemovedIds((ids) => [...ids, rowData.id]);
          setAdjustmentTypes(adjustmentTypes.filter(type => type.id !== rowData.id));
          toast.current.show({
            severity: 'success',
            summary: 'Deleted',
            detail: 'Adjustment type removed successfully',
            life: 3000
          });
        }}
        disabled={isViewMode} aria-label="Delete" tooltip="Delete" tooltipOptions={{ position: "top" }} />
    );
  };

  const matrixCellEditor = (role, category) => {
    if (isViewMode) {
      return formatCurrency(approvalMatrix[role][category]);
    }
    return (
      <InputNumber
        value={approvalMatrix[role][category]}
        onValueChange={(e) => setApprovalMatrix((matrix) => ({ ...matrix, [role]: { ...matrix[role], [category]: e.value } }))}
        mode="currency"
        currency={currencyCode}
        className="w-full"
        disabled={isViewMode}
      />
    );
  };

  // View from the list opens the adjustment type chosen there as a record; the whole master is edited from Edit
  const viewed = isViewMode ? adjustmentTypes.find((r) => r.adjustmentCode === location.state?.data?.code) || null : null;
  const header = (
    <div className="header-section">
      <div className="flex align-items-center gap-2">
        <Button icon="pi pi-arrow-left" text rounded aria-label={t("common.back")} onClick={handleCancel} />
        <h2 className="m-0">{t("remittance.adjustmentMaster.title")}</h2>
      </div>
      <BreadCrumb home={{ label: t("financeMasters.master") }} className="mt-2"
        model={[{ label: t("remittance.adjustmentMaster.remittanceMaster"), url: "/master/finance/remittance" }, { label: t(`remittance.adjustmentMaster.mode.${mode}`, { defaultValue: mode }) }]} />
    </div>
  );

  if (viewed) {
    return (
      <div className="adjustment-master">
        <Toast ref={toast} />
        {header}
        <Card>
          <DetailHeader title={viewed.adjustmentCode} subtitle={viewed.adjustmentName}
            status={{ code: viewed.active ? "active" : "inactive", label: t(viewed.active ? "remittance.adjustmentMaster.active" : "remittance.adjustmentMaster.inactive") }} />
          <DetailSection title={t("remittance.adjustmentMaster.type")}>
            <KeyValueGrid columns={3} items={[
              { label: t("remittance.adjustmentMaster.category"), value: viewed.category },
              { label: t("remittance.adjustmentMaster.nature"), value: viewed.adjustmentNature },
              { label: t("remittance.adjustmentMaster.glAccount"), value: viewed.glAccount },
              { label: t("remittance.adjustmentMaster.requiresApproval"), value: viewed.requiresApproval, type: "boolean" },
              { label: t("remittance.adjustmentMaster.autoApproveBelow"), value: viewed.approvalLimit, type: "amount" },
            ]} />
          </DetailSection>
          <DetailSection title={t("detailView.activity")}>
            <RecordActivityLog entity={`master:${TYPE}`} recordId={viewed.id} />
          </DetailSection>
          <div className="action-buttons mt-4">
            <Button label={t("remittance.adjustmentMaster.close")} outlined onClick={handleCancel} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="adjustment-master">
      <Toast ref={toast} />
      {header}

      <Card>
        <TabView>
          <TabPanel header="Adjustment Types">
            <div className="adjustment-types-section">
              <div className="toolbar mb-3">
                {!isViewMode && (
                  <Button
                    label={t("remittance.addType")}
                    icon="pi pi-plus"
                    className="p-button-primary"
                    onClick={handleAddType}
                  />
                )}
              </div>

              <DataTable
                value={adjustmentTypes}
                editMode="cell"
                className="adjustment-grid"
                onCellEditComplete={onCellEdit}
                stripedRows
              >
                <Column
                  field="adjustmentCode"
                  header="Code"
                  style={{ width: "10%" }}
                  editor={!isViewMode ? textEditor : null}
                />
                <Column
                  field="adjustmentName"
                  header="Adjustment Name"
                  style={{ width: "20%" }}
                  editor={!isViewMode ? textEditor : null}
                />
                <Column
                  field="category"
                  header="Category"
                  style={{ width: "12%" }}
                  editor={!isViewMode ? (options) => dropdownEditor(options, categoryOptions) : null}
                />
                <Column
                  field="adjustmentNature"
                  header="Nature"
                  style={{ width: "10%" }}
                  editor={!isViewMode ? (options) => dropdownEditor(options, natureOptions) : null}
                />
                <Column
                  field="glAccount"
                  header="GL Account"
                  style={{ width: "15%" }}
                  body={(rowData) => (
                    <div className="p-inputgroup">
                      <span>{rowData.glAccount}</span>
                      {!isViewMode && (
                        <Button icon="pi pi-search" className="p-button-text p-button-sm" aria-label="Search" tooltip="Search" tooltipOptions={{ position: "top" }} />
                      )}
                    </div>
                  )}
                />
                <Column
                  field="requiresApproval"
                  header="Requires Approval"
                  style={{ width: "10%" }}
                  body={(rowData) => (
                    <Checkbox
                      checked={rowData.requiresApproval}
                      onChange={(e) => onCellEdit({
                        rowData,
                        field: "requiresApproval",
                        value: e.checked
                      })}
                      disabled={isViewMode}
                    />
                  )}
                />
                <Column
                  field="approvalLimit"
                  header="Auto-Approve Below"
                  style={{ width: "12%" }}
                  body={(rowData) => formatCurrency(rowData.approvalLimit)}
                  editor={!isViewMode ? numberEditor : null}
                />
                <Column
                  field="active"
                  header="Active"
                  style={{ width: "6%" }}
                  body={(rowData) => (
                    <Checkbox
                      checked={rowData.active}
                      onChange={(e) => onCellEdit({
                        rowData,
                        field: "active",
                        value: e.checked
                      })}
                      disabled={isViewMode}
                    />
                  )}
                />
                {!isViewMode && (
                  <Column
                    header=""
                    style={{ width: "5%" }}
                    body={deleteTemplate}
                  />
                )}
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Adjustment Rules">
            <div className="adjustment-rules-section">
              <div className="rules-container">
                <h3>Automatic Adjustment Rules</h3>
                <div className="rule-builder">
                  <div className="rule-card">
                    <div className="rule-header">
                      <span>Rule 1: Late Payment Penalty</span>
                      <Button icon="pi pi-pencil" className="p-button-text p-button-sm" disabled={isViewMode} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
                    </div>
                    <div className="rule-content">
                      <strong>Condition:</strong> Payment Delay {'>'} 30 Days<br />
                      <strong>Action:</strong> Apply Late Fee (2.5% of Outstanding Amount)
                    </div>
                  </div>
                  <div className="rule-card">
                    <div className="rule-header">
                      <span>Rule 2: Small Balance Write-off</span>
                      <Button icon="pi pi-pencil" className="p-button-text p-button-sm" disabled={isViewMode} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
                    </div>
                    <div className="rule-content">
                      <strong>Condition:</strong> Amount Difference {'<'} {"\u20B1"}10<br />
                      <strong>Action:</strong> Write-off Difference
                    </div>
                  </div>
                  <div className="rule-card">
                    <div className="rule-header">
                      <span>Rule 3: Loyalty Discount</span>
                      <Button icon="pi pi-pencil" className="p-button-text p-button-sm" disabled={isViewMode} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
                    </div>
                    <div className="rule-content">
                      <strong>Condition:</strong> Customer Category = Gold<br />
                      <strong>Action:</strong> Apply Discount (5%)
                    </div>
                  </div>
                  {!isViewMode && (
                    <Button
                      label={t("remittance.addRule")}
                      icon="pi pi-plus"
                      className="p-button-outlined mt-3"
                    />
                  )}
                </div>

                <h3 className="mt-4">Adjustment Limits</h3>
                <div className="grid">
                  <div className="col-12 md:col-4">
                    <label>Max Adjustment Amount</label>
                    <InputNumber
                      value={maxAdjustmentAmount}
                      onValueChange={(e) => setMaxAdjustmentAmount(e.value)}
                      mode="currency"
                      currency={currencyCode}
                      disabled={isViewMode}
                      className="w-full"
                    />
                  </div>
                  <div className="col-12 md:col-4">
                    <label>Max Adjustment Percentage</label>
                    <InputNumber
                      value={maxAdjustmentPercent}
                      onValueChange={(e) => setMaxAdjustmentPercent(e.value)}
                      suffix="%"
                      disabled={isViewMode}
                      className="w-full"
                    />
                  </div>
                  <div className="col-12 md:col-4">
                    <label>Adjustment Frequency Limit</label>
                    <InputNumber
                      value={frequencyLimit}
                      onValueChange={(e) => setFrequencyLimit(e.value)}
                      suffix=" per policy/month"
                      disabled={isViewMode}
                      className="w-full"
                    />
                    <small className="text-muted">Max adjustments per policy per month</small>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Approval Matrix">
            <div className="approval-matrix-section">
              <h3>Adjustment Approval Limits</h3>
              <div className="matrix-table">
                <table className="approval-matrix-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Premium Adjustment</th>
                      <th>Commission Adjustment</th>
                      <th>Tax Adjustment</th>
                      <th>Fee Waiver</th>
                      <th>Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(approvalMatrix).map(role => (
                      <tr key={role}>
                        <td className="role-name">{role}</td>
                        <td>{matrixCellEditor(role, "Premium")}</td>
                        <td>{matrixCellEditor(role, "Commission")}</td>
                        <td>{matrixCellEditor(role, "Tax")}</td>
                        <td>{matrixCellEditor(role, "Fee")}</td>
                        <td>{matrixCellEditor(role, "Refund")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="matrix-note mt-3">
                <i className="pi pi-info-circle mr-2"></i>
                <small>
                  Amounts shown are maximum limits for each role.
                  Adjustments exceeding these limits require approval from the next level.
                </small>
              </div>
            </div>
          </TabPanel>
        </TabView>

        <div className="action-buttons mt-4">
          {!isViewMode && (
            <Button
              label={t("financeMasters.save")}
              icon="pi pi-save"
              className="p-button-primary mr-2"
              onClick={handleSave}
            />
          )}
          <Button
            label={isViewMode ? "Close" : "Cancel"}
            icon="pi pi-times"
            className="p-button-secondary"
            onClick={handleCancel}
          />
        </div>
      </Card>
    </div>
  );
};

export default AdjustmentMaster;