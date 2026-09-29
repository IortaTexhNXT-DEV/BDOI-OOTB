import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { Password } from "primereact/password";
import { FileUpload } from "primereact/fileupload";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Chips } from "primereact/chips";
import { InputNumber } from "primereact/inputnumber";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Toast } from "primereact/toast";
import SvgDot from "../../../../assets/icons/SvgDot";
import { Card } from "primereact/card";
import remittanceService from "../../../../services/remittanceService";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { showError } from "../../../Remittance/shared";
import { saveAndReturn, useMasterOptions } from "../masterRecord";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";
import "./index.scss";

const ElectronicTransferMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = React.useRef(null);
  const { formatCurrency } = useFormatCurrency();
  const banks = useMasterOptions("bank", toast);
  const bankOptions = banks.map((b) => ({ label: b.name, value: b.value }));
  const [transferMethods, setTransferMethods] = useState([]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [transferQueue, setTransferQueue] = useState([]);
  const [formData, setFormData] = useState({
    configCode: "",
    configName: "",
    transferType: null,
    bankCode: null,
    bankName: "",
    accountNumber: "",
    accountType: null,
    swiftCode: "",
    iban: "",
    authType: null,
    encryption: "AES-256",
    username: "",
    password: "",
    certPath: null,
    privateKey: null,
    allowedIPs: [],
    fileFormat: null,
    fileEncoding: "UTF-8",
    includeHeader: true,
    includeFooter: true,
    availableMethods: []
  });

  const [methodLimits, setMethodLimits] = useState([]);

  useEffect(() => {
    remittanceService.transferMethods()
      .then((methods) => {
        setTransferMethods(methods.map((m) => ({ value: m.value, label: m.label })));
        setMethodLimits((current) => (current.length ? current : methods.map((m) => ({
          method: m.label, minAmount: 0, maxAmount: m.limit, dailyLimit: m.limit, charges: 0, active: true
        }))));
      })
      .catch((error) => showError(toast, error));
    remittanceService.listTransfers({ status: "Pending,Approved", perPage: 200 })
      .then((rows) => setTransferQueue(rows.map((r) => ({ ...r, referenceNo: r.reference, scheduledDate: r.scheduledDate || r.date }))))
      .catch((error) => showError(toast, error));
  }, []);

  const transferTypeOptions = [
    { label: "Domestic", value: "Domestic" },
    { label: "International", value: "International" },
    { label: "SEPA", value: "SEPA" },
    { label: "SWIFT", value: "SWIFT" },
  ];


  const accountTypeOptions = [
    { label: "Current", value: "Current" },
    { label: "Savings", value: "Savings" },
    { label: "Settlement", value: "Settlement" },
  ];

  const authTypeOptions = [
    { label: "Username/Password", value: "Username/Password" },
    { label: "Certificate", value: "Certificate" },
    { label: "Token", value: "Token" },
    { label: "OAuth2", value: "OAuth2" },
  ];

  const encryptionOptions = [
    { label: "None", value: "None" },
    { label: "PGP", value: "PGP" },
    { label: "AES-256", value: "AES-256" },
    { label: "RSA", value: "RSA" },
  ];

  const fileFormatOptions = [
    { label: "ISO 20022 XML", value: "ISO 20022 XML" },
    { label: "MT940", value: "MT940" },
    { label: "MT103", value: "MT103" },
    { label: "BAI2", value: "BAI2" },
    { label: "Custom CSV", value: "Custom CSV" },
    { label: "Fixed Width", value: "Fixed Width" },
  ];

  const fileEncodingOptions = [
    { label: "UTF-8", value: "UTF-8" },
    { label: "ASCII", value: "ASCII" },
    { label: "ISO-8859-1", value: "ISO-8859-1" },
    { label: "Windows-1252", value: "Windows-1252" },
  ];


  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Electronic Transfer Setup", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        setFormData((prev) => ({
          ...prev,
          transferType: data.scope || prev.transferType,
          bankName: data.bankDetails?.bankName || "",
          accountNumber: data.bankDetails?.accountNumber || "",
          accountType: data.bankDetails?.accountType || null,
          availableMethods: data.transferType ? [data.transferType] : [],
          ...(data.form || {}),
          configCode: data.code,
          configName: data.name,
        }));
        if (data.form?.methodLimits) setMethodLimits(data.form.methodLimits);
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
    return `ETM-${String(random).padStart(3, '0')}`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (field === 'bankCode') {
      const bank = bankOptions.find(b => b.value === value);
      if (bank) {
        setFormData(prev => ({
          ...prev,
          bankName: bank.label
        }));
      }
    }
  };

  const handleMethodSelect = (method) => {
    const methods = [...formData.availableMethods];
    const index = methods.indexOf(method);
    if (index > -1) {
      methods.splice(index, 1);
    } else {
      methods.push(method);
    }
    handleInputChange('availableMethods', methods);
  };

  const handleSave = async () => {
    setIsLoading(true);
    const limits = methodLimits.filter((l) => l.active);
    await saveAndReturn({
      type: "remittance-electronic-transfer",
      id: data?.id,
      toast,
      navigate,
      record: {
        code: formData.configCode,
        name: formData.configName,
        scope: formData.transferType,
        transferType: formData.availableMethods[0] || null,
        bankDetails: { bankName: formData.bankName, accountNumber: formData.accountNumber, accountType: formData.accountType },
        limits: {
          minAmount: Math.min(...limits.map((l) => Number(l.minAmount || 0))),
          maxAmount: Math.max(0, ...limits.map((l) => Number(l.maxAmount || 0))),
          dailyLimit: limits.reduce((sum, l) => sum + Number(l.dailyLimit || 0), 0)
        },
        form: { ...formData, password: undefined, privateKey: undefined, methodLimits }
      }
    });
    setIsLoading(false);
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const onLimitCellEdit = (e) => {
    const updatedLimits = [...methodLimits];
    const index = updatedLimits.findIndex(l => l.method === e.rowData.method);
    updatedLimits[index][e.field] = e.value;
    setMethodLimits(updatedLimits);
  };

  const activeEditor = (options) => (
    <Checkbox
      checked={options.value}
      onChange={(e) => options.editorCallback(e.checked)}
    />
  );

  return (
    <div className="electronic-transfer-master">
      <Toast ref={toast} />

      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Card className="main-card">
        <div className="card-header">
          <h3>Electronic Transfer Master</h3>
          <div className="header-actions">
            <Button
              label={t("financeMasters.save")}
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
          <TabPanel header="Bank Configuration">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Transfer Configuration
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="configCode">Config Code *</label>
                  <InputText
                    id="configCode"
                    value={formData.configCode}
                    onChange={(e) => handleInputChange('configCode', e.target.value)}
                    disabled={mode === "edit" || mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="configName">Config Name *</label>
                  <InputText
                    id="configName"
                    value={formData.configName}
                    onChange={(e) => handleInputChange('configName', e.target.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="transferType">Transfer Type *</label>
                  <Dropdown
                    id="transferType"
                    value={formData.transferType}
                    options={transferTypeOptions}
                    onChange={(e) => handleInputChange('transferType', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectType")}
                  />
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Bank Details
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="bankCode">Bank Code *</label>
                  <Dropdown
                    id="bankCode"
                    value={formData.bankCode}
                    options={bankOptions}
                    onChange={(e) => handleInputChange('bankCode', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectBank")}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="bankName">Bank Name</label>
                  <InputText
                    id="bankName"
                    value={formData.bankName}
                    disabled
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="accountNumber">Account Number *</label>
                  <Password
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    disabled={mode === "view"}
                    feedback={false}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="accountType">Account Type</label>
                  <Dropdown
                    id="accountType"
                    value={formData.accountType}
                    options={accountTypeOptions}
                    onChange={(e) => handleInputChange('accountType', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectType")}
                  />
                </div>
                {(formData.transferType === 'International' || formData.transferType === 'SWIFT') && (
                  <div className="form-field">
                    <label htmlFor="swiftCode">SWIFT Code</label>
                    <InputText
                      id="swiftCode"
                      value={formData.swiftCode}
                      onChange={(e) => handleInputChange('swiftCode', e.target.value)}
                      disabled={mode === "view"}
                      className="w-full"
                    />
                  </div>
                )}
                {(formData.transferType === 'International' || formData.transferType === 'SEPA') && (
                  <div className="form-field">
                    <label htmlFor="iban">IBAN</label>
                    <InputText
                      id="iban"
                      value={formData.iban}
                      onChange={(e) => handleInputChange('iban', e.target.value)}
                      disabled={mode === "view"}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Transfer Methods">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Supported Methods
              </h4>
              <div className="method-selection">
                {transferMethods.map(method => (
                  <div key={method.value} className="method-item">
                    <Checkbox
                      inputId={method.value}
                      checked={formData.availableMethods.includes(method.value)}
                      onChange={() => handleMethodSelect(method.value)}
                      disabled={mode === "view"}
                    />
                    <label htmlFor={method.value} className="ml-2">{method.label}</label>
                  </div>
                ))}
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Method Limits
              </h4>
              <DataTable
                value={methodLimits.filter(m => formData.availableMethods.includes(m.method))}
                editMode="cell"
                className="editable-cells-table"
              >
                <Column field="method" header="Method" style={{ width: '15%' }} />
                <Column
                  field="minAmount"
                  header="Min Amount"
                  editor={(options) => (
                    <InputNumber
                      value={options.value}
                      onValueChange={(e) => options.editorCallback(e.value)}
                      mode="decimal"
                      minFractionDigits={2}
                    />
                  )}
                  onCellEditComplete={onLimitCellEdit}
                  style={{ width: '17%' }}
                />
                <Column
                  field="maxAmount"
                  header="Max Amount"
                  editor={(options) => (
                    <InputNumber
                      value={options.value}
                      onValueChange={(e) => options.editorCallback(e.value)}
                      mode="decimal"
                      minFractionDigits={2}
                    />
                  )}
                  onCellEditComplete={onLimitCellEdit}
                  style={{ width: '17%' }}
                />
                <Column
                  field="dailyLimit"
                  header="Daily Limit"
                  editor={(options) => (
                    <InputNumber
                      value={options.value}
                      onValueChange={(e) => options.editorCallback(e.value)}
                      mode="decimal"
                      minFractionDigits={2}
                    />
                  )}
                  onCellEditComplete={onLimitCellEdit}
                  style={{ width: '17%' }}
                />
                <Column
                  field="charges"
                  header="Charges"
                  editor={(options) => (
                    <InputNumber
                      value={options.value}
                      onValueChange={(e) => options.editorCallback(e.value)}
                      mode="decimal"
                      minFractionDigits={2}
                    />
                  )}
                  onCellEditComplete={onLimitCellEdit}
                  style={{ width: '17%' }}
                />
                <Column
                  field="active"
                  header="Active"
                  editor={activeEditor}
                  body={(rowData) => <Checkbox checked={rowData.active} disabled />}
                  onCellEditComplete={onLimitCellEdit}
                  style={{ width: '17%', textAlign: 'center' }}
                />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="File Formats">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Export Format Configuration
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="fileFormat">File Format *</label>
                  <Dropdown
                    id="fileFormat"
                    value={formData.fileFormat}
                    options={fileFormatOptions}
                    onChange={(e) => handleInputChange('fileFormat', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectFormat")}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="fileEncoding">File Encoding</label>
                  <Dropdown
                    id="fileEncoding"
                    value={formData.fileEncoding}
                    options={fileEncodingOptions}
                    onChange={(e) => handleInputChange('fileEncoding', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="includeHeader"
                    checked={formData.includeHeader}
                    onChange={(e) => handleInputChange('includeHeader', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="includeHeader" className="ml-2">Include Header</label>
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="includeFooter"
                    checked={formData.includeFooter}
                    onChange={(e) => handleInputChange('includeFooter', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="includeFooter" className="ml-2">Include Footer</label>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Security">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Authentication
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="authType">Authentication Type *</label>
                  <Dropdown
                    id="authType"
                    value={formData.authType}
                    options={authTypeOptions}
                    onChange={(e) => handleInputChange('authType', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder="Select Auth Type"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="encryption">Encryption</label>
                  <Dropdown
                    id="encryption"
                    value={formData.encryption}
                    options={encryptionOptions}
                    onChange={(e) => handleInputChange('encryption', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                {formData.authType === 'Username/Password' && (
                  <>
                    <div className="form-field">
                      <label htmlFor="username">Username</label>
                      <InputText
                        id="username"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        disabled={mode === "view"}
                        className="w-full"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="password">Password</label>
                      <Password
                        id="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        disabled={mode === "view"}
                        feedback={false}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
                {formData.authType === 'Certificate' && (
                  <>
                    <div className="form-field">
                      <label htmlFor="certPath">Certificate Path</label>
                      <FileUpload
                        id="certPath"
                        mode="basic"
                        accept=".pem,.crt,.cer"
                        maxFileSize={1000000}
                        disabled={mode === "view"}
                        className="w-full"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="privateKey">Private Key</label>
                      <FileUpload
                        id="privateKey"
                        mode="basic"
                        accept=".key,.pem"
                        maxFileSize={1000000}
                        disabled={mode === "view"}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                IP Restrictions
              </h4>
              <div className="form-field">
                <label htmlFor="allowedIPs">Allowed IPs</label>
                <Chips
                  id="allowedIPs"
                  value={formData.allowedIPs}
                  onChange={(e) => handleInputChange('allowedIPs', e.value)}
                  disabled={mode === "view"}
                  className="w-full"
                  placeholder={t("remittance.enterIpAddresses")}
                />
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Transfer Queue">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Pending Transfers
              </h4>
              <DataTable
                value={transferQueue}
                responsiveLayout="scroll"
                className="mt-3"
                emptyMessage="No pending transfers"
                showGridlines
              >
                <Column
                  field="referenceNo"
                  header="Reference No"
                  style={{ width: '15%' }}
                />
                <Column
                  field="beneficiary"
                  header="Beneficiary"
                  style={{ width: '25%' }}
                />
                <Column
                  field="amount"
                  header="Amount"
                  body={(rowData) => formatCurrency(rowData.amount)}
                  style={{ width: '15%' }}
                />
                <Column
                  field="method"
                  header="Method"
                  style={{ width: '15%' }}
                />
                <Column body={(row) => formatAppDate(row.scheduledDate)}
                  field="scheduledDate"
                  header="Scheduled Date"
                  style={{ width: '15%' }}
                />
                <Column
                  field="status"
                  header="Status"
                  body={(rowData) => (
                    <span className={`status-badge status-${rowData.status.toLowerCase()}`}>
                      {rowData.status}
                    </span>
                  )}
                  style={{ width: '15%' }}
                />
              </DataTable>
            </div>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

export default ElectronicTransferMaster;