import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import { Card } from "primereact/card";
import { Toast } from "primereact/toast";
import { saveAndReturn } from "../masterRecord";
import "./index.scss";

const DELIMITERS = { Comma: ",", Tab: "\t", Pipe: "|", Semicolon: ";" };
const toSnake = (v) => String(v || "").replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (v) => String(v || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const BulkProcessingMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = useRef(null);
  const TYPE = "remittance-bulk-processing";

  const [activeIndex, setActiveIndex] = useState(0);
  const [formData, setFormData] = useState({
    formatCode: "",
    formatName: "",
    fileType: null,
    delimiter: null,
    hasHeader: true,
    sheetName: "Sheet1",
    dateFormat: "DD/MM/YYYY",
    maxFileSize: 50,
    maxRecords: 10000,
    allowDuplicates: false,
    skipInvalid: false,
    processingMode: "Batch",
    batchSize: 100,
    errorHandling: "Continue",
    autoApprove: false
  });

  const [columnMappings, setColumnMappings] = useState([]);

  const fileTypeOptions = [
    { label: "CSV", value: "CSV" },
    { label: "Excel", value: "Excel" },
    { label: "XML", value: "XML" },
    { label: "Fixed Width", value: "Fixed Width" },
    { label: "JSON", value: "JSON" },
  ];

  const delimiterOptions = [
    { label: "Comma", value: "Comma" },
    { label: "Tab", value: "Tab" },
    { label: "Pipe", value: "Pipe" },
    { label: "Semicolon", value: "Semicolon" },
  ];

  const dateFormatOptions = [
    { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
    { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
    { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
  ];

  const processingModeOptions = [
    { label: "Batch", value: "Batch" },
    { label: "Real-time", value: "Real-time" },
    { label: "Scheduled", value: "Scheduled" },
  ];

  const errorHandlingOptions = [
    { label: "Stop on Error", value: "Stop on Error" },
    { label: "Continue", value: "Continue" },
    { label: "Rollback All", value: "Rollback All" },
  ];

  const dataTypeOptions = [
    { label: "Text", value: "Text" },
    { label: "Number", value: "Number" },
    { label: "Date", value: "Date" },
    { label: "Decimal", value: "Decimal" },
  ];

  const targetFieldOptions = [
    { label: "Policy Number", value: "policyNumber" },
    { label: "Premium Amount", value: "premiumAmount" },
    { label: "Transaction Date", value: "transactionDate" },
    { label: "Insurer Code", value: "insurerCode" },
    { label: "Client Code", value: "clientCode" },
    { label: "Commission Amount", value: "commissionAmount" },
    { label: "Tax Amount", value: "taxAmount" },
    { label: "Net Amount", value: "netAmount" },
    { label: "Payment Method", value: "paymentMethod" },
    { label: "Reference Number", value: "referenceNumber" },
  ];

  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Bulk Processing Setup", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        setFormData((prev) => ({
          ...prev,
          fileType: /xls/i.test(data.fileFormat) ? "Excel" : data.fileFormat || prev.fileType,
          delimiter: Object.keys(DELIMITERS).find((k) => DELIMITERS[k] === data.delimiter) || prev.delimiter,
          hasHeader: data.hasHeader ?? prev.hasHeader,
          sheetName: data.sheetName || prev.sheetName,
          maxFileSize: parseFloat(data.maxFileSize) || prev.maxFileSize,
          maxRecords: data.maxRecords ?? prev.maxRecords,
          errorHandling: data.errorHandling || prev.errorHandling,
          ...(data.form || {}),
          formatCode: data.code,
          formatName: data.name,
        }));
        setColumnMappings(data.form?.columnMappings || (data.fieldMappings || []).map((m, i) => ({
          id: i + 1,
          sourceColumn: m.sourceField || m.sourceColumn,
          targetField: toCamel(m.targetField),
          dataType: "Text",
          required: Boolean(m.required),
          defaultValue: ""
        })));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        formatCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 1000);
    return `BFM-${String(random).padStart(3, '0')}`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => saveAndReturn({
    type: TYPE,
    id: data?.id,
    toast,
    navigate,
    record: {
      code: formData.formatCode,
      name: formData.formatName,
      fileFormat: formData.fileType,
      delimiter: DELIMITERS[formData.delimiter] || ",",
      hasHeader: formData.hasHeader,
      sheetName: formData.sheetName,
      maxFileSize: formData.maxFileSize,
      maxRecords: formData.maxRecords,
      errorHandling: formData.errorHandling,
      duplicateHandling: formData.allowDuplicates ? "Allow" : "Skip",
      fieldMappings: columnMappings.map((m) => ({ sourceField: m.sourceColumn, targetField: toSnake(m.targetField), required: m.required })),
      form: { ...formData, columnMappings }
    }
  });

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const addMapping = () => {
    const newMapping = {
      id: columnMappings.length + 1,
      sourceColumn: "",
      targetField: "",
      dataType: "Text",
      required: false,
      defaultValue: ""
    };
    setColumnMappings([...columnMappings, newMapping]);
  };

  // Maps the columns the remittance importer reads (policy, premium, commission, tax) that are not mapped yet.
  const autoMap = () => {
    const importerFields = ["policyNumber", "premiumAmount", "commissionAmount", "taxAmount"];
    const mapped = new Set(columnMappings.map((m) => m.targetField));
    const added = importerFields.filter((f) => !mapped.has(f)).map((f, i) => ({
      id: columnMappings.length + i + 1,
      sourceColumn: targetFieldOptions.find((o) => o.value === f).label.replace(/\s+/g, ""),
      targetField: f,
      dataType: f === "policyNumber" ? "Text" : "Decimal",
      required: f === "policyNumber" || f === "premiumAmount",
      defaultValue: ""
    }));
    setColumnMappings([...columnMappings, ...added]);
  };

  const deleteMapping = (rowData) => {
    setColumnMappings(columnMappings.filter(map => map.id !== rowData.id));
  };

  const onMappingCellEdit = (e) => {
    const updatedMappings = [...columnMappings];
    const index = updatedMappings.findIndex(map => map.id === e.rowData.id);
    updatedMappings[index][e.field] = e.value;
    setColumnMappings(updatedMappings);
  };

  const targetFieldEditor = (options) => (
    <Dropdown
      value={options.value}
      options={targetFieldOptions}
      onChange={(e) => options.editorCallback(e.value)}
      style={{ width: '100%' }}
    />
  );

  const dataTypeEditor = (options) => (
    <Dropdown
      value={options.value}
      options={dataTypeOptions}
      onChange={(e) => options.editorCallback(e.value)}
      style={{ width: '100%' }}
    />
  );

  const requiredEditor = (options) => (
    <Checkbox
      checked={options.value}
      onChange={(e) => options.editorCallback(e.checked)}
    />
  );

  const actionBodyTemplate = (rowData) => {
    return (
      <Button
        icon="pi pi-trash"
        className="p-button-rounded p-button-danger p-button-text"
        onClick={() => deleteMapping(rowData)}
        disabled={mode === "view"}
      />
    );
  };

  return (
    <div className="bulk-processing-master">
      <Toast ref={toast} />
      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Card className="main-card">
        <div className="card-header">
          <h3>Bulk Remittance Processing Master</h3>
          <div className="header-actions">
            <Button
              label={t("financeMasters.save")}
              icon="pi pi-save"
              className="p-button-sm p-button-success"
              onClick={handleSave}
              disabled={mode === "view"}
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
          <TabPanel header="File Format">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Format Configuration
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="formatCode">Format Code *</label>
                  <InputText
                    id="formatCode"
                    value={formData.formatCode}
                    onChange={(e) => handleInputChange('formatCode', e.target.value)}
                    disabled={mode === "edit" || mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="formatName">Format Name *</label>
                  <InputText
                    id="formatName"
                    value={formData.formatName}
                    onChange={(e) => handleInputChange('formatName', e.target.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="fileType">File Type *</label>
                  <Dropdown
                    id="fileType"
                    value={formData.fileType}
                    options={fileTypeOptions}
                    onChange={(e) => handleInputChange('fileType', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectFileType")}
                  />
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                File Structure
              </h4>
              <div className="form-grid two-column">
                {formData.fileType === 'CSV' && (
                  <div className="form-field">
                    <label htmlFor="delimiter">Delimiter</label>
                    <Dropdown
                      id="delimiter"
                      value={formData.delimiter}
                      options={delimiterOptions}
                      onChange={(e) => handleInputChange('delimiter', e.value)}
                      disabled={mode === "view"}
                      className="w-full"
                      placeholder={t("remittance.selectDelimiter")}
                    />
                  </div>
                )}
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="hasHeader"
                    checked={formData.hasHeader}
                    onChange={(e) => handleInputChange('hasHeader', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="hasHeader" className="ml-2">Has Header Row</label>
                </div>
                {formData.fileType === 'Excel' && (
                  <div className="form-field">
                    <label htmlFor="sheetName">Sheet Name</label>
                    <InputText
                      id="sheetName"
                      value={formData.sheetName}
                      onChange={(e) => handleInputChange('sheetName', e.target.value)}
                      disabled={mode === "view"}
                      className="w-full"
                    />
                  </div>
                )}
                <div className="form-field">
                  <label htmlFor="dateFormat">Date Format</label>
                  <Dropdown
                    id="dateFormat"
                    value={formData.dateFormat}
                    options={dateFormatOptions}
                    onChange={(e) => handleInputChange('dateFormat', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectDateFormat")}
                  />
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Column Mapping
              </h4>
              <div className="toolbar mb-3">
                <Button
                  label={t("remittance.addMapping")}
                  icon="pi pi-plus"
                  className="p-button-sm"
                  onClick={addMapping}
                  disabled={mode === "view"}
                />
                <Button
                  label={t("remittance.autoMap")}
                  icon="pi pi-sparkles"
                  className="p-button-sm p-button-secondary"
                  onClick={autoMap}
                  disabled={mode === "view"}
                />
              </div>
              <DataTable
                value={columnMappings}
                editMode="cell"
                className="editable-cells-table"
              >
                <Column
                  field="sourceColumn"
                  header="Source Column"
                  editor={(options) => (
                    <InputText
                      type="text"
                      value={options.value}
                      onChange={(e) => options.editorCallback(e.target.value)}
                    />
                  )}
                  onCellEditComplete={onMappingCellEdit}
                  style={{ width: '25%' }}
                />
                <Column
                  field="targetField"
                  header="Target Field"
                  editor={targetFieldEditor}
                  onCellEditComplete={onMappingCellEdit}
                  style={{ width: '25%' }}
                />
                <Column
                  field="dataType"
                  header="Data Type"
                  editor={dataTypeEditor}
                  onCellEditComplete={onMappingCellEdit}
                  style={{ width: '20%' }}
                />
                <Column
                  field="required"
                  header="Required"
                  editor={requiredEditor}
                  onCellEditComplete={onMappingCellEdit}
                  body={(rowData) => <Checkbox checked={rowData.required} disabled />}
                  style={{ width: '10%', textAlign: 'center' }}
                />
                <Column
                  field="defaultValue"
                  header="Default Value"
                  editor={(options) => (
                    <InputText
                      type="text"
                      value={options.value}
                      onChange={(e) => options.editorCallback(e.target.value)}
                    />
                  )}
                  onCellEditComplete={onMappingCellEdit}
                  style={{ width: '15%' }}
                />
                <Column
                  body={actionBodyTemplate}
                  style={{ width: '5%' }}
                />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Validation Rules">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                File Validation
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="maxFileSize">Max File Size (MB)</label>
                  <InputNumber
                    id="maxFileSize"
                    value={formData.maxFileSize}
                    onValueChange={(e) => handleInputChange('maxFileSize', e.value)}
                    min={1}
                    max={500}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="maxRecords">Max Records</label>
                  <InputNumber
                    id="maxRecords"
                    value={formData.maxRecords}
                    onValueChange={(e) => handleInputChange('maxRecords', e.value)}
                    min={1}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="allowDuplicates"
                    checked={formData.allowDuplicates}
                    onChange={(e) => handleInputChange('allowDuplicates', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="allowDuplicates" className="ml-2">Allow Duplicates</label>
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="skipInvalid"
                    checked={formData.skipInvalid}
                    onChange={(e) => handleInputChange('skipInvalid', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="skipInvalid" className="ml-2">Skip Invalid Records</label>
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Data Validation Rules
              </h4>
              <div className="validation-rules">
                <div className="rule-item">
                  <span className="rule-type">Required Field</span>
                  <span className="rule-desc">Policy Number, Premium Amount, Transaction Date must be provided</span>
                </div>
                <div className="rule-item">
                  <span className="rule-type">Range Check</span>
                  <span className="rule-desc">Premium Amount must be between 0 and 1,000,000</span>
                </div>
                <div className="rule-item">
                  <span className="rule-type">Format Check</span>
                  <span className="rule-desc">Policy Number must match pattern POL-XXXXXX</span>
                </div>
                <div className="rule-item">
                  <span className="rule-type">Lookup Validation</span>
                  <span className="rule-desc">Insurer Code must exist in Insurer Master</span>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Processing">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Processing Configuration
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="processingMode">Processing Mode</label>
                  <Dropdown
                    id="processingMode"
                    value={formData.processingMode}
                    options={processingModeOptions}
                    onChange={(e) => handleInputChange('processingMode', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                {formData.processingMode === 'Batch' && (
                  <div className="form-field">
                    <label htmlFor="batchSize">Batch Size</label>
                    <InputNumber
                      id="batchSize"
                      value={formData.batchSize}
                      onValueChange={(e) => handleInputChange('batchSize', e.value)}
                      min={1}
                      max={10000}
                      disabled={mode === "view"}
                      className="w-full"
                    />
                  </div>
                )}
                <div className="form-field">
                  <label htmlFor="errorHandling">Error Handling</label>
                  <Dropdown
                    id="errorHandling"
                    value={formData.errorHandling}
                    options={errorHandlingOptions}
                    onChange={(e) => handleInputChange('errorHandling', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="autoApprove"
                    checked={formData.autoApprove}
                    onChange={(e) => handleInputChange('autoApprove', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="autoApprove" className="ml-2">Auto-Approve</label>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

export default BulkProcessingMaster;