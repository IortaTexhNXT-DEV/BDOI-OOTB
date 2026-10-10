import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { InputNumber } from "primereact/inputnumber";
import { MultiSelect } from "primereact/multiselect";
import FieldError from "../../../../components/FieldError";
import { openConfirm } from "../../../../components/ConfirmDialog";
import DetailDialog from "../../../../components/DetailDialog";
import DetailHeader from "../../../../components/DetailHeader";
import DetailSection from "../../../../components/DetailSection";
import KeyValueGrid from "../../../../components/KeyValueGrid";
import { useLocation } from "react-router-dom";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";
import SvgSearchIcon from "../../../../assets/icons/SvgSearchIcon";
import ToggleButton from "../../../../components/ToggleButton";
import InputField from "../../../../components/InputField";
import incentiveService from "../../../../services/incentiveService";
import mastersService from "../../../../services/mastersService";
import { isoDate, loadSettings, showError, showSuccess } from "../../../Remittance/shared";
import { calendarDateFormat, formatDate as formatAppDate } from "../../../../utility/dateFormat";
import { requiredErrors, hasErrors, errorSummary } from "../../../../utility/requiredFields";
import "./index.scss";

const IncentiveProgramMaster = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`incentiveProgramMaster.${key}`, opts);
  const { formatCurrency } = useFormatCurrency();
  const location = useLocation();
  const toast = useRef(null);

  // State management
  const [programs, setPrograms] = useState([]);
  const [config, setConfig] = useState({ types: [], frequencies: [], metrics: [], currencies: [], defaultCurrency: "" });
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [loading, setLoading] = useState(false);

  // Form state
  const [showDialog, setShowDialog] = useState(false);
  const [viewed, setViewed] = useState(null);
  const [mode, setMode] = useState("add"); // add, edit, view
  const [currentProgram, setCurrentProgram] = useState(null);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    programCode: "",
    programName: "",
    description: "",
    programType: "",
    applicableTo: [],
    startDate: null,
    endDate: null,
    targetMetric: "",
    baseTarget: 0,
    stretchTarget: 0,
    Currency: "",
    calculationFrequency: "",
    status: "Active",
    structure: []
  });

  const loadPrograms = async () => {
    setLoading(true);
    try {
      setPrograms(await incentiveService.listPrograms());
    } catch (error) {
      showError(toast, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    // currencies: the active Currency master rows; a program defaults to the accounting base currency
    Promise.all([loadSettings(), mastersService.list("currency", { status: "Active" }).catch(() => [])])
      .then(([s, currencies]) => setConfig({
        types: s["incentive.program_types"] || [],
        frequencies: s["incentive.calculation_frequencies"] || [],
        metrics: Object.keys(s["incentive.metric_map"] || {}),
        currencies: currencies.map((c) => c.CurrencyCode).filter(Boolean),
        defaultCurrency: (currencies.find((c) => c.isBase === true) || {}).CurrencyCode || s["currency.default"] || ""
      }))
      .catch((error) => showError(toast, error));
  }, []);

  const toOptions = (values) => values.map((v) => ({ label: v, value: v }));

  // Options
  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Active", value: "Active" },
    { label: "Draft", value: "Draft" },
    { label: "Completed", value: "Completed" },
    { label: "Inactive", value: "Inactive" }
  ];

  const typeOptions = [{ label: "All", value: "All" }, ...toOptions(config.types)];

  const programTypeOptions = toOptions(config.types);

  const applicableToOptions = [
    { label: "Individual Agent", value: "Individual Agent" },
    { label: "Team", value: "Team" },
    { label: "Branch", value: "Branch" },
    { label: "Region", value: "Region" }
  ];

  const targetMetricOptions = toOptions(config.metrics);

  const frequencyOptions = toOptions(config.frequencies);

  const currencyOptions = toOptions(config.currencies);

  // Breadcrumb items
  const items = [
    { label: t("incentiveProgramMaster.financeMasters"), url: "/master/finance" },
    { label: t("incentiveProgramMaster.incentiveMaster"), url: "/master/finance/incentive" },
    { label: t("incentiveProgramMaster.programMaster"), url: "/master/finance/incentive/program" }
  ];

  const home = { label: t("incentiveProgramMaster.master") };

  // Check for navigation state
  useEffect(() => {
    if (location.state) {
      const { mode: navMode, data } = location.state;
      if (navMode === "view" && data) {
        setViewed(data);
      } else if (navMode && ["add", "edit"].includes(navMode)) {
        setMode(navMode);
        if (data) {
          setCurrentProgram(data);
          setFormData({
            ...data,
            startDate: data.startDate ? new Date(data.startDate) : null,
            endDate: data.endDate ? new Date(data.endDate) : null,
          });
        }
        setShowDialog(true);
      }
    }
  }, [location.state]);

  // Filter data
  const filteredPrograms = programs.filter((program) => {
    const matchesSearch =
      program.programName.toLowerCase().includes(search.toLowerCase()) ||
      program.programCode.toLowerCase().includes(search.toLowerCase()) ||
      String(program.description || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === "All" || program.status === selectedStatus;
    const matchesType = selectedType === "All" || program.programType === selectedType;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Handle form operations
  const handleAdd = () => {
    setMode("add");
    setCurrentProgram(null);
    setFormData({
      programCode: "",
      programName: "",
      description: "",
      programType: "",
      applicableTo: [],
      startDate: null,
      endDate: null,
      targetMetric: "",
      baseTarget: 0,
      stretchTarget: 0,
      Currency: config.defaultCurrency,
      calculationFrequency: "",
      status: "Active",
      structure: []
    });
    setErrors({});
    setShowDialog(true);
  };

  const handleEdit = (rowData) => {
    setMode("edit");
    setCurrentProgram(rowData);
    setFormData({
      ...rowData,
      startDate: rowData.startDate ? new Date(rowData.startDate) : null,
      endDate: rowData.endDate ? new Date(rowData.endDate) : null,
    });
    setErrors({});
    setShowDialog(true);
  };

  const handleView = (rowData) => setViewed(rowData);

  const handleSave = async () => {
    const found = requiredErrors(formData, [
      ["programName", "Program name"],
      ["programType", "Program type"],
      ["applicableTo", "Applicable to"],
      ["startDate", "Start date"],
      ["endDate", "End date"],
      ["endDate", "End date", (v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, "End date must be on or after the start date"],
      ["targetMetric", "Target metric"],
      ["calculationFrequency", "Calculation frequency"],
      ["baseTarget", "Base target", (v) => Number(v.baseTarget) > 0, "Base target must be greater than zero"],
    ]);
    setErrors(found);
    if (hasErrors(found)) {
      showError(toast, { message: errorSummary(found) }, "Validation");
      return;
    }
    setLoading(true);
    try {
      const programData = {
        ...formData,
        startDate: isoDate(formData.startDate) || null,
        endDate: isoDate(formData.endDate) || null,
      };

      if (mode === "add") {
        const created = await incentiveService.createProgram(programData);
        showSuccess(toast, `Incentive program ${created.programCode} created successfully`);
      } else if (mode === "edit") {
        await incentiveService.updateProgram(currentProgram.id, programData);
        showSuccess(toast, "Incentive program updated successfully");
      }

      setShowDialog(false);
      await loadPrograms();
    } catch (error) {
      showError(toast, error, "Failed to save incentive program");
    } finally {
      setLoading(false);
    }
  };


  const handleStatusChange = async (rowData) => {
    const deactivate = rowData.status === "Active";
    const newStatus = deactivate ? "Inactive" : "Active";
    const action = deactivate ? "deactivate" : "activate";
    const changed = await openConfirm({
      title: k(`${action}Title`),
      severity: deactivate ? "warning" : "neutral",
      message: k(`${action}Message`),
      facts: [
        { label: k("programCode"), value: rowData.programCode },
        { label: k("programName"), value: rowData.programName },
        { label: k("programType"), value: rowData.programType },
        { label: k("startDate"), value: rowData.startDate, type: "date" },
        { label: k("endDate"), value: rowData.endDate, type: "date" },
      ],
      note: deactivate ? k("deactivateNote") : null,
      confirmLabel: k(`${action}Action`),
      onConfirm: () => incentiveService.updateProgram(rowData.id, { status: newStatus }),
    });
    if (!changed) return;
    showSuccess(toast, k(deactivate ? "deactivated" : "activated", { code: rowData.programCode }));
    await loadPrograms();
  };

  // Template functions
  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case "Active": return "success";
        case "Draft": return "secondary";
        case "Completed": return "info";
        case "Inactive": return "danger";
        default: return null;
      }
    };

    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const dateBodyTemplate = (rowData, field) => {
    return formatAppDate(rowData[field]);
  };

  const amountBodyTemplate = (rowData, field) => {
    return formatCurrency(rowData[field], { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon={<SvgEyeIcon />}
          className="view-eye-button"
          onClick={() => handleView(rowData)}
          tooltip={k("viewDetails")} aria-label={k("viewDetails")}
        />
        <Button
          icon={<SvgEditicons />}
          className="edit-button"
          onClick={() => handleEdit(rowData)}
          tooltip={k("edit")} aria-label={k("edit")}
        />
        <ToggleButton
          isChecked={rowData.status === "Active"}
          onChange={() => handleStatusChange(rowData)}
        />
      </div>
    );
  };

  // Dialog footer
  const dialogFooter = (
    <div className="dialog-footer">
      <Button
        label={k("cancel")}
        className="p-button-text"
        onClick={() => setShowDialog(false)}
      />
      <Button
        label={mode === "add" ? k("createProgram") : k("saveProgram")}
        icon="pi pi-check"
        onClick={handleSave}
        loading={loading}
      />
    </div>
  );

  return (
    <div className="container__incentive__program__master">
      <Toast ref={toast} />

      {/* Header */}
      <div className="top__container">
        <div className="page__title">{t("incentiveProgramMaster.pageTitle")}</div>
        <div className="add-button-container">
          <Button
            icon={<div className="pr-2"><SvgAdd /></div>}
            className="main__btn__action"
            onClick={handleAdd} aria-label="Add" tooltip="Add" tooltipOptions={{ position: "top" }} >
            {t("incentiveProgramMaster.addProgram")}
          </Button>
        </div>
        <BreadCrumb
          home={home}
          className="breadCrums__view__reversal"
          model={items}
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>

      {/* Content */}
      <div className="content-container">
        <Card>
          {/* Filter Section */}
          <div className="filter-section">
            <div className="filter-row">
              <div className="filter-field">
                <label>Search</label>
                <InputField
                  placeholder="Search by name, code, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<SvgSearchIcon />}
                />
              </div>
              <div className="filter-field">
                <label>Status</label>
                <Dropdown
                  value={selectedStatus}
                  options={statusOptions}
                  onChange={(e) => setSelectedStatus(e.value)}
                  placeholder="Select status"
                />
              </div>
              <div className="filter-field">
                <label>Program Type</label>
                <Dropdown
                  value={selectedType}
                  options={typeOptions}
                  onChange={(e) => setSelectedType(e.value)}
                  placeholder="Select type"
                />
              </div>
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            value={filteredPrograms}
            className="incentive-table"
            stripedRows
            paginator
            rows={20}
            loading={loading}
            emptyMessage="No incentive programs found"
          >
            <Column field="programCode" header="Program Code" style={{ width: "12%" }} />
            <Column field="programName" header="Program Name" style={{ width: "20%" }} />
            <Column field="programType" header="Type" style={{ width: "12%" }} />
            <Column field="targetMetric" header="Target Metric" style={{ width: "12%" }} />
            <Column
              body={(data) => amountBodyTemplate(data, 'baseTarget')}
              header="Base Target"
              style={{ width: "10%", textAlign: "right" }}
            />
            <Column field="calculationFrequency" header="Frequency" style={{ width: "10%" }} />
            <Column
              body={(data) => dateBodyTemplate(data, 'startDate')}
              header="Start Date"
              style={{ width: "10%" }}
            />
            <Column
              body={(data) => dateBodyTemplate(data, 'endDate')}
              header="End Date"
              style={{ width: "10%" }}
            />
            <Column
              body={statusBodyTemplate}
              header="Status"
              style={{ width: "8%" }}
            />
            <Column
              body={actionBodyTemplate}
              header="Actions"
              style={{ width: "10%" }}
            />
          </DataTable>
        </Card>
      </div>

      {/* Program Dialog */}
      <Dialog
        header={mode === "add" ? t("incentiveProgramMaster.createIncentiveProgram") : t("incentiveProgramMaster.editIncentiveProgram")}
        visible={showDialog}
        onHide={() => setShowDialog(false)}
        style={{ width: "56rem" }}
        breakpoints={{ "960px": "94vw" }}
        footer={dialogFooter}
        className="ipm-dialog"
      >
        <div className="ipm-form">
          <h3 className="ipm-form__title">{k("programSection")}</h3>
          <div className="form-grid">
            <div className="form-row">
              <div className="form-field">
                <label>{k("programCode")}</label>
                <InputText
                  value={formData.programCode}
                  onChange={(e) => setFormData({...formData, programCode: e.target.value})}
                  placeholder={k("codeWhenBlank")}
                />
              </div>
              <div className="form-field">
                <label className="ipm-form__required">{k("programName")}</label>
                <InputText
                  value={formData.programName}
                  onChange={(e) => setFormData({...formData, programName: e.target.value})}
                />
                <FieldError error={errors.programName} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full-width">
                <label>{k("description")}</label>
                <InputTextarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="ipm-form__required">{k("programType")}</label>
                <Dropdown
                  value={formData.programType}
                  options={programTypeOptions}
                  onChange={(e) => setFormData({...formData, programType: e.value})}
                />
                <FieldError error={errors.programType} />
              </div>
              <div className="form-field">
                <label className="ipm-form__required">{k("applicableTo")}</label>
                <MultiSelect
                  value={formData.applicableTo}
                  options={applicableToOptions}
                  onChange={(e) => setFormData({...formData, applicableTo: e.value})}
                />
                <FieldError error={errors.applicableTo} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="ipm-form__required">{k("startDate")}</label>
                <Calendar
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.value})}
                  dateFormat={calendarDateFormat()}
                />
                <FieldError error={errors.startDate} />
              </div>
              <div className="form-field">
                <label className="ipm-form__required">{k("endDate")}</label>
                <Calendar
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.value})}
                  dateFormat={calendarDateFormat()}
                />
                <FieldError error={errors.endDate} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{k("status")}</label>
                <Dropdown
                  value={formData.status}
                  options={statusOptions.filter(opt => opt.value !== "All")}
                  onChange={(e) => setFormData({...formData, status: e.value})}
                />
              </div>
              <div className="form-field">
                <label>{k("currency")}</label>
                <Dropdown
                  value={formData.Currency ?? formData.currency}
                  options={currencyOptions}
                  onChange={(e) => setFormData({...formData, Currency: e.value})}
                />
              </div>
            </div>
          </div>

          <h3 className="ipm-form__title">{k("targetsSection")}</h3>
          <div className="form-grid">
            <div className="form-row">
              <div className="form-field">
                <label className="ipm-form__required">{k("targetMetric")}</label>
                <Dropdown
                  value={formData.targetMetric}
                  options={targetMetricOptions}
                  onChange={(e) => setFormData({...formData, targetMetric: e.value})}
                />
                <FieldError error={errors.targetMetric} />
              </div>
              <div className="form-field">
                <label className="ipm-form__required">{k("frequency")}</label>
                <Dropdown
                  value={formData.calculationFrequency}
                  options={frequencyOptions}
                  onChange={(e) => setFormData({...formData, calculationFrequency: e.value})}
                />
                <FieldError error={errors.calculationFrequency} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="ipm-form__required">{k("baseTarget")}</label>
                <InputNumber
                  value={formData.baseTarget}
                  onValueChange={(e) => setFormData({...formData, baseTarget: e.value})}
                  mode="decimal"
                  minFractionDigits={0}
                  maxFractionDigits={2}
                />
                <FieldError error={errors.baseTarget} />
              </div>
              <div className="form-field">
                <label>{k("stretchTarget")}</label>
                <InputNumber
                  value={formData.stretchTarget}
                  onValueChange={(e) => setFormData({...formData, stretchTarget: e.value})}
                  mode="decimal"
                  minFractionDigits={0}
                  maxFractionDigits={2}
                />
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {viewed ? (
        <DetailDialog visible onHide={() => setViewed(null)} header={t("incentiveProgramMaster.viewIncentiveProgram")} size="lg"
          footer={(
            <>
              <Button type="button" label={k("close")} outlined onClick={() => setViewed(null)} />
              <Button type="button" label={k("edit")} icon="pi pi-pencil" onClick={() => { const row = viewed; setViewed(null); handleEdit(row); }} />
            </>
          )}>
          <DetailHeader
            title={viewed.programName}
            subtitle={viewed.programCode}
            status={{ code: String(viewed.status || "").toLowerCase(), label: viewed.status }}
            meta={[
              { label: k("programType"), value: viewed.programType },
              { label: k("startDate"), value: viewed.startDate, type: "date" },
              { label: k("endDate"), value: viewed.endDate, type: "date" },
              { label: k("frequency"), value: viewed.calculationFrequency },
            ]}
          />
          <DetailSection title={k("programSection")}>
            <KeyValueGrid columns={3} items={[
              { label: k("applicableTo"), value: (viewed.applicableTo || []).join(", "), span: 2 },
              { label: k("currency"), value: viewed.Currency ?? viewed.currency },
              { label: k("description"), value: viewed.description, span: "full" },
            ]} />
          </DetailSection>
          <DetailSection title={k("targetsSection")}>
            <KeyValueGrid columns={3} items={[
              { label: k("targetMetric"), value: viewed.targetMetric },
              { label: k("baseTarget"), value: viewed.baseTarget, type: "number" },
              { label: k("stretchTarget"), value: viewed.stretchTarget, type: "number" },
            ]} />
          </DetailSection>
          {viewed.structure?.length ? (
            <DetailSection title={k("structureSection")} flush>
              <DataTable value={viewed.structure} size="small">
                <Column field="level" header={k("achievementLevel")} />
                <Column field="type" header={k("incentiveType")} />
                <Column field="value" header={k("rateOrAmount")} />
                <Column header={k("maxPayout")} body={(data) => formatCurrency(data.maxPayout)} className="text-right" headerClassName="text-right" />
              </DataTable>
            </DetailSection>
          ) : null}
        </DetailDialog>
      ) : null}
    </div>
  );
};

export default IncentiveProgramMaster;