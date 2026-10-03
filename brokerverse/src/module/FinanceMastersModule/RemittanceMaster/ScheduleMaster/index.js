import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { Calendar } from "primereact/calendar";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { PickList } from "primereact/picklist";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Toast } from "primereact/toast";
import SvgDot from "../../../../assets/icons/SvgDot";
import { Card } from "primereact/card";
import remittanceService, { masterService } from "../../../../services/remittanceService";
import { showError } from "../../../Remittance/shared";
import { saveAndReturn } from "../masterRecord";
import { calendarDateFormat } from "../../../../utility/dateFormat";
import "./index.scss";

const ScheduleMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = React.useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    scheduleCode: "",
    scheduleName: "",
    isActive: true,
    scheduleType: null,
    frequency: null,
    executionDay: 1,
    businessDayRule: null,
    executionTime: null,
    timeZone: "EST",
    cutoffTime: null,
    holidayCalendar: null,
    skipHolidays: true,
    customHolidays: []
  });

  const [allInsurers, setAllInsurers] = useState([]);
  const [availableInsurers, setAvailableInsurers] = useState([]);
  const [scheduledInsurers, setScheduledInsurers] = useState([]);
  const [insurerSettings, setInsurerSettings] = useState([]);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [frequencyOptions, setFrequencyOptions] = useState([]);

  useEffect(() => {
    masterService.options("insurance-company")
      .then((rows) => setAllInsurers(rows.map((r) => ({ id: r.id, code: r.code, name: r.label }))))
      .catch((error) => showError(toast, error));
    masterService.definition("remittance-schedule")
      .then((def) => setFrequencyOptions(((def.fields || []).find((f) => f.name === "frequency")?.options || []).map((v) => ({ label: v, value: v }))))
      .catch((error) => showError(toast, error));
    const linked = data?.linkedProcesses || [];
    remittanceService.automatedHistory()
      .then((rows) => setExecutionLogs(rows.filter((r) => linked.includes(r.configCode)).map((r) => ({
        scheduleCode: r.configCode,
        executionTime: r.executionDate,
        duration: r.duration,
        status: r.status,
        recordsProcessed: r.recordsProcessed
      }))))
      .catch((error) => showError(toast, error));
  }, [data]);

  useEffect(() => {
    const chosen = new Set(scheduledInsurers.map((i) => i.code));
    setAvailableInsurers(allInsurers.filter((i) => !chosen.has(i.code)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInsurers]);

  const scheduleTypeOptions = [
    { label: "Fixed Date", value: "Fixed Date" },
    { label: "Recurring", value: "Recurring" },
    { label: "Business Days", value: "Business Days" },
    { label: "Custom", value: "Custom" },
  ];


  const businessDayRuleOptions = [
    { label: "Previous Business Day", value: "Previous Business Day" },
    { label: "Next Business Day", value: "Next Business Day" },
    { label: "Same Day", value: "Same Day" },
  ];

  const timeZoneOptions = [
    { label: "Local", value: "Local" },
    { label: "UTC", value: "UTC" },
    { label: "EST", value: "EST" },
    { label: "PST", value: "PST" },
  ];

  const holidayCalendarOptions = [
    { label: "US Banking", value: "US Banking" },
    { label: "UK Banking", value: "UK Banking" },
    { label: "Custom Calendar", value: "Custom" },
  ];

  const priorityOptions = [
    { label: "High", value: "High" },
    { label: "Medium", value: "Medium" },
    { label: "Low", value: "Low" },
  ];

  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Schedule Configuration", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        const executionTime = new Date();
        if (data.time) {
          const [hours, minutes] = String(data.time).split(':');
          executionTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        }
        const saved = data.form || {};
        setFormData((prev) => ({
          ...prev,
          ...saved,
          scheduleCode: data.code,
          scheduleName: data.name,
          isActive: data.status === true || data.status === "Active",
          scheduleType: saved.scheduleType || (data.type === "Remittance Processing" ? "Recurring" : data.type) || null,
          frequency: data.frequency || null,
          executionTime,
          cutoffTime: saved.cutoffTime ? new Date(saved.cutoffTime) : null,
          timeZone: data.timezone || prev.timeZone,
        }));
        setScheduledInsurers(saved.scheduledInsurers || []);
        setInsurerSettings(saved.insurerSettings || []);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        scheduleCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 10000);
    return `SCH-${String(random).padStart(4, '0')}`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    const time = formData.executionTime instanceof Date
      ? `${String(formData.executionTime.getHours()).padStart(2, "0")}:${String(formData.executionTime.getMinutes()).padStart(2, "0")}`
      : undefined;
    await saveAndReturn({
      type: "remittance-schedule",
      id: data?.id,
      toast,
      navigate,
      record: {
        code: formData.scheduleCode,
        name: formData.scheduleName,
        isActive: formData.isActive,
        type: formData.scheduleType,
        frequency: formData.frequency,
        time,
        timezone: formData.timeZone,
        form: { ...formData, scheduledInsurers, insurerSettings }
      }
    });
    setIsLoading(false);
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const onInsurerChange = (e) => {
    setAvailableInsurers(e.source);
    setScheduledInsurers(e.target);
    
    const newSettings = e.target.map(insurer => {
      const existing = insurerSettings.find(s => s.insurerCode === insurer.code);
      if (existing) return existing;
      return {
        insurerCode: insurer.code,
        insurerName: insurer.name,
        customDay: null,
        leadTime: 0,
        priority: "Medium",
        active: true
      };
    });
    setInsurerSettings(newSettings);
  };

  const onSettingCellEdit = (e) => {
    const updatedSettings = [...insurerSettings];
    const index = updatedSettings.findIndex(s => s.insurerCode === e.rowData.insurerCode);
    updatedSettings[index][e.field] = e.value;
    setInsurerSettings(updatedSettings);
  };

  const priorityEditor = (options) => (
    <Dropdown
      value={options.value}
      options={priorityOptions}
      onChange={(e) => options.editorCallback(e.value)}
      style={{ width: '100%' }}
    />
  );

  const activeEditor = (options) => (
    <Checkbox
      checked={options.value}
      onChange={(e) => options.editorCallback(e.checked)}
    />
  );

  const insurerItemTemplate = (item) => {
    return (
      <div className="insurer-item">
        <span className="insurer-code">{item.code}</span>
        <span className="insurer-name">{item.name}</span>
        <span className="insurer-type">{item.type}</span>
      </div>
    );
  };

  return (
    <div className="schedule-master">
      <Toast ref={toast} />

      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Card className="main-card">
        <div className="card-header">
          <h3>Remittance Schedule Master</h3>
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
          <TabPanel header="Schedule Setup">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Schedule Configuration
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="scheduleCode">Schedule Code *</label>
                  <InputText
                    id="scheduleCode"
                    value={formData.scheduleCode}
                    onChange={(e) => handleInputChange('scheduleCode', e.target.value)}
                    disabled={mode === "edit" || mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="scheduleName">Schedule Name *</label>
                  <InputText
                    id="scheduleName"
                    value={formData.scheduleName}
                    onChange={(e) => handleInputChange('scheduleName', e.target.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="isActive"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="isActive" className="ml-2">Active</label>
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Schedule Pattern
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="scheduleType">Schedule Type *</label>
                  <Dropdown
                    id="scheduleType"
                    value={formData.scheduleType}
                    options={scheduleTypeOptions}
                    onChange={(e) => handleInputChange('scheduleType', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectType")}
                  />
                </div>
                {formData.scheduleType === 'Recurring' && (
                  <div className="form-field">
                    <label htmlFor="frequency">Frequency</label>
                    <Dropdown
                      id="frequency"
                      value={formData.frequency}
                      options={frequencyOptions}
                      onChange={(e) => handleInputChange('frequency', e.value)}
                      disabled={mode === "view"}
                      className="w-full"
                      placeholder="Select Frequency"
                    />
                  </div>
                )}
                {formData.frequency === 'Monthly' && (
                  <div className="form-field">
                    <label htmlFor="executionDay">Execution Day</label>
                    <InputNumber
                      id="executionDay"
                      value={formData.executionDay}
                      onValueChange={(e) => handleInputChange('executionDay', e.value)}
                      min={1}
                      max={31}
                      disabled={mode === "view"}
                      className="w-full"
                    />
                  </div>
                )}
                {formData.scheduleType === 'Business Days' && (
                  <div className="form-field">
                    <label htmlFor="businessDayRule">Business Day Rule</label>
                    <Dropdown
                      id="businessDayRule"
                      value={formData.businessDayRule}
                      options={businessDayRuleOptions}
                      onChange={(e) => handleInputChange('businessDayRule', e.value)}
                      disabled={mode === "view"}
                      className="w-full"
                      placeholder={t("remittance.selectRule")}
                    />
                  </div>
                )}
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Time Configuration
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="executionTime">Execution Time *</label>
                  <Calendar
                    id="executionTime"
                    value={formData.executionTime}
                    onChange={(e) => handleInputChange('executionTime', e.value)}
                    timeOnly
                    hourFormat="24"
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="timeZone">Time Zone</label>
                  <Dropdown
                    id="timeZone"
                    value={formData.timeZone}
                    options={timeZoneOptions}
                    onChange={(e) => handleInputChange('timeZone', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="cutoffTime">Cut-off Time</label>
                  <Calendar
                    id="cutoffTime"
                    value={formData.cutoffTime}
                    onChange={(e) => handleInputChange('cutoffTime', e.value)}
                    timeOnly
                    hourFormat="24"
                    disabled={mode === "view"}
                    className="w-full"
                  />
                  <small className="help-text">Latest time to include transactions</small>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Insurer Assignment">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Insurer Selection
              </h4>
              <PickList
                source={availableInsurers}
                target={scheduledInsurers}
                onChange={onInsurerChange}
                itemTemplate={insurerItemTemplate}
                sourceHeader="Available Insurers"
                targetHeader="Scheduled Insurers"
                sourceStyle={{ height: '300px' }}
                targetStyle={{ height: '300px' }}
                disabled={mode === "view"}
              />

              <h4 className="section-title mt-4">
                <SvgDot />
                Insurer-Specific Settings
              </h4>
              <DataTable
                value={insurerSettings}
                editMode="cell"
                className="editable-cells-table"
              >
                <Column field="insurerCode" header="Insurer Code" style={{ width: '15%' }} />
                <Column field="insurerName" header="Insurer Name" style={{ width: '25%' }} />
                <Column
                  field="customDay"
                  header="Custom Day"
                  editor={(options) => (
                    <InputNumber
                      value={options.value}
                      onValueChange={(e) => options.editorCallback(e.value)}
                      min={1}
                      max={31}
                    />
                  )}
                  onCellEditComplete={onSettingCellEdit}
                  style={{ width: '15%' }}
                />
                <Column
                  field="leadTime"
                  header="Lead Time (Days)"
                  editor={(options) => (
                    <InputNumber
                      value={options.value}
                      onValueChange={(e) => options.editorCallback(e.value)}
                      min={0}
                    />
                  )}
                  onCellEditComplete={onSettingCellEdit}
                  style={{ width: '15%' }}
                />
                <Column
                  field="priority"
                  header="Priority"
                  editor={priorityEditor}
                  onCellEditComplete={onSettingCellEdit}
                  style={{ width: '15%' }}
                />
                <Column
                  field="active"
                  header="Active"
                  editor={activeEditor}
                  body={(rowData) => <Checkbox checked={rowData.active} disabled />}
                  onCellEditComplete={onSettingCellEdit}
                  style={{ width: '15%', textAlign: 'center' }}
                />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Holiday Calendar">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Holiday Configuration
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="holidayCalendar">Holiday Calendar</label>
                  <Dropdown
                    id="holidayCalendar"
                    value={formData.holidayCalendar}
                    options={holidayCalendarOptions}
                    onChange={(e) => handleInputChange('holidayCalendar', e.value)}
                    disabled={mode === "view"}
                    className="w-full"
                    placeholder={t("remittance.selectCalendar")}
                  />
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="skipHolidays"
                    checked={formData.skipHolidays}
                    onChange={(e) => handleInputChange('skipHolidays', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="skipHolidays" className="ml-2">Skip Holidays</label>
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Custom Holidays
              </h4>
              <div className="form-field">
                <label htmlFor="customHolidays">Additional Holidays</label>
                <Calendar
                  id="customHolidays"
                  value={formData.customHolidays}
                  onChange={(e) => handleInputChange('customHolidays', e.value)}
                  selectionMode="multiple"
                  dateFormat={calendarDateFormat()}
                  disabled={mode === "view"}
                  className="w-full"
                  inline
                />
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Execution History">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Recent Executions
              </h4>
              <DataTable
                value={executionLogs}
                responsiveLayout="scroll"
                className="mt-3"
                emptyMessage="No execution history available"
                showGridlines
              >
                <Column
                  field="scheduleCode"
                  header="Schedule Code"
                  style={{ width: '15%' }}
                />
                <Column
                  field="executionTime"
                  header="Execution Time"
                  style={{ width: '20%' }}
                />
                <Column
                  field="duration"
                  header="Duration"
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
                <Column
                  field="recordsProcessed"
                  header="Records Processed"
                  style={{ width: '15%' }}
                />
                <Column
                  header="Actions"
                  body={(rowData) => (
                    <div className="action-buttons">
                      <Button
                        icon="pi pi-eye"
                        className="p-button-sm p-button-text"
                        tooltip="View Details"
                        onClick={() => {
                          toast.current.show({
                            severity: "info",
                            summary: "Execution Details",
                            detail: `Execution ${rowData.scheduleCode} processed ${rowData.recordsProcessed} records`,
                            life: 3000
                          });
                        }} aria-label="View Details"
                      />
                    </div>
                  )}
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

export default ScheduleMaster;