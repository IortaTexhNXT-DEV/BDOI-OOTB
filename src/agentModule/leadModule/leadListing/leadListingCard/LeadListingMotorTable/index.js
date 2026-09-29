import { InputText } from "primereact/inputtext";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import { Skeleton } from "primereact/skeleton";
import { MultiSelect } from "primereact/multiselect";
import { ProgressSpinner } from "primereact/progressspinner";
import SvgEdit from "../../../../../assets/icons/SvgEdits";
import { Button } from "primereact/button";
import SvgArrow from "../../../../../assets/icons/SvgArrow";
import SvgMotorTable from "../../../../../assets/agentIcon/SvgMotorTable";
import SvgDownArrow from "../../../../../assets/agentIcon/SvgDownArrow";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import debounce from "lodash/debounce";
import {
  getPaymentSearchDataMiddleWare,
  getleadtableMiddleware,
  getLeadByIdMiddleware,
  deleteLeadMiddleware,
} from "../../../Store/leadMiddleware";
import { isFireLob, isIarLob } from "../../../../endorsementModule/constants/endorsementCategories";
import countriesData from "../../../leadCreation/mock";

const LeadListingMotorTable = ({ lob = null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useRef(null);
  const dt = useRef(null);

  // Redux state
  const { leadtabledata, loading, error, totalRecords } = useSelector(
    ({ leadReducers }) => ({
      leadtabledata: leadReducers?.leadtabledata || [],
      loading: leadReducers?.loading || false,
      error: leadReducers?.error || null,
      totalRecords: leadReducers?.totalLeads || 0,
    })
  );

  // Local state
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectionMode] = useState("multiple");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([
    "name",
    "category",
    "date",
    "quotes",
    "actions",
  ]);

  // Column options for customization
  const allColumns = [
    { label: t("tables.name"), value: "name" },
    { label: t("tables.category"), value: "category" },
    { label: t("tables.date"), value: "date" },
    { label: t("tables.quotes"), value: "quotes" },
    { label: t("tables.actions"), value: "actions" },
  ];

  // Advanced filters
  const [filters, setFilters] = useState({
    leadCategory: "",
    country: "",
    province: "",
    city: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearch(value);
    }, 500),
    []
  );

  // Fetch leads on component mount and when filters change
  useEffect(() => {
    const params = {
      page: currentPage,
      pageSize: rowsPerPage,
      ...(filters.leadCategory && { leadCategory: filters.leadCategory }),
      ...(filters.country && { country: filters.country }),
      ...(filters.province && { province: filters.province }),
      ...(filters.city && { city: filters.city }),
      ...(search && { query: search }),
      ...(lob && { lob }),
    };
    dispatch(getleadtableMiddleware(params));
  }, [dispatch, currentPage, rowsPerPage, filters, search, lob]);

  // Export functionality
  const exportCSV = () => {
    dt.current.exportCSV();
  };

  // Filter options
  const categoryOptions = [
    { label: t("leads.allCategories"), value: "" },
    { label: t("leads.individual"), value: "Retail" },
    { label: t("leads.company"), value: "Corporate" },
  ];

  const countryOptions = [
    { label: "All Countries", value: "" },
    ...countriesData.countries.map((c) => ({ label: c, value: c })),
  ];

  const provinceOptions = [
    { label: "All Provinces", value: "" },
    ...countriesData.state.map((s) => ({ label: s, value: s })),
  ];

  const cityOptions = [
    { label: "All Cities", value: "" },
    ...countriesData.city.map((c) => ({ label: c, value: c })),
  ];

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleClearFilters = () => {
    setFilters({
      leadCategory: "",
      country: "",
      province: "",
      city: "",
    });
    setSearch("");
    setCurrentPage(1);
  };

  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
      ];

      return (
        <div className="table__selector">
          <React.Fragment>
            <span
              className="table__selector__text"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              {t("leads.rowsPerPage")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
              dropdownIcon={<SvgDownArrow />}
            />
          </React.Fragment>
        </div>
      );
    },
  };

  const handleViewDetail = (rowData) => {
    const leadId = rowData.leadId || rowData.id;
    if (leadId) {
      navigate(`/agent/leaddetail/${leadId}`);
    } else {
      console.error("No leadId found for viewing details");
    }
  };

  const renderViewEditButton = (rowData) => {
    return (
      <div
        className="btn__container__view__edit"
        style={{ display: "flex", gap: "8px" }}
      >
        <div>
          <Button
            icon="pi pi-eye"
            className="p-button-info p-button-text"
            onClick={() => handleViewDetail(rowData)}
            tooltip={t("leads.viewDetails")}
            tooltipOptions={{ position: "top" }}
          />
        </div>
        <div>
          <Button
            icon={<SvgEdit />}
            className="view__btn"
            onClick={() => handleEdit(rowData)}
            tooltip={t("common.edit")}
            tooltipOptions={{ position: "top" }}
          />
        </div>
        <div>
          <Button
            icon={<SvgArrow />}
            className="edit__btn"
            onClick={() => handleView(rowData)}
            tooltip={t("leads.viewQuotes")}
            tooltipOptions={{ position: "top" }}
          />
        </div>
        <div>
          <Button
            icon="pi pi-trash"
            className="p-button-danger p-button-text"
            onClick={() => handleDelete(rowData)}
            tooltip={t("common.delete")}
            tooltipOptions={{ position: "top" }}
          />
        </div>
      </div>
    );
  };

  const renderName = (rowData) => {
    const fullName = `${rowData.firstName || ""} ${
      rowData.lastName || ""
    }`.trim();
    return (
      <div className="name__box__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="name__text">{fullName?.toUpperCase() || "N/A"}</div>
          <div className="lead__id__text">
            {t("leads.cardLeadId")}: {rowData.generatedLeadId || rowData.leadId || "N/A"}{" "}
          </div>
        </div>
      </div>
    );
  };

  const renderCategory = (rowData) => {
    return (
      <div className="category__text">
        {rowData.leadCategory?.toUpperCase() || "N/A"}
      </div>
    );
  };

  const renderDate = (rowData) => {
    // Format createdAt date as yyyy-mm-dd
    const formatDate = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid date
      return date.toISOString().split("T")[0]; // Format as yyyy-mm-dd
    };

    // Use createdAt instead of DOB
    const dateValue =
      rowData.createdAt ||
      rowData.created_at ||
      rowData.dateCreated ||
      rowData.date_created;

    return <div className="date__text">{formatDate(dateValue)}</div>;
  };

  const renderQuotes = (rowData) => {
    // Use quotationsCount from API response
    return <div className="quote__text">{rowData.quotationsCount || "0"}</div>;
  };

  const handleView = (rowData) => {
    // Pass the leadId as leadRefId to filter quotations for this specific lead
    const leadId = rowData.leadId || rowData.id;
    if (leadId) {
      navigate(`/agent/quotelisting?leadRefId=${leadId}`);
    } else {
      console.error("No leadId found for viewing quotations");
      navigate("/agent/quotelisting");
    }
  };

  const handleEdit = (rowData) => {
    const leadId = rowData.leadId || rowData.id;
    if (!leadId) {
      console.error("No leadId found for editing");
      return;
    }
    dispatch(getLeadByIdMiddleware(leadId));
    if (lob && isIarLob(lob)) {
      navigate("/agent/createlead/iar", {
        state: { leadRefId: leadId, leadId, isEdit: true },
      });
      return;
    }
    if (lob && isFireLob(lob)) {
      navigate("/agent/createlead/fire-allied-perils", {
        state: { leadId, isEdit: true },
      });
      return;
    }
    navigate(`/agent/leadedit/${leadId}`);
  };

  const handleDelete = (rowData) => {
    const leadId = rowData.leadId || rowData.id;
    const fullName = `${rowData.firstName || ""} ${
      rowData.lastName || ""
    }`.trim();

    confirmDialog({
      message: t("leads.deleteConfirmMessage", { name: fullName || "this lead" }),
      header: t("leads.deleteConfirmation"),
      icon: "pi pi-exclamation-triangle",
      accept: async () => {
        try {
          const result = await dispatch(deleteLeadMiddleware(leadId));
          if (result.type.endsWith("/fulfilled")) {
            toast.current.show({
              severity: "success",
              summary: t("common.success"),
              detail: t("leads.leadDeletedSuccess"),
              life: 3000,
            });
            // Refresh the leads table
            dispatch(
              getleadtableMiddleware({
                page: currentPage,
                pageSize: rowsPerPage,
                ...(filters.leadCategory && { leadCategory: filters.leadCategory }),
                ...(filters.country && { country: filters.country }),
                ...(filters.province && { province: filters.province }),
                ...(filters.city && { city: filters.city }),
                ...(search && { query: search }),
                ...(lob && { lob }),
              })
            );
          } else {
            toast.current.show({
              severity: "error",
              summary: t("common.error"),
              detail: result.payload || t("leads.failedToDeleteLead"),
              life: 3000,
            });
          }
        } catch (error) {
          toast.current.show({
            severity: "error",
            summary: t("common.error"),
            detail: t("leads.unexpectedError"),
            life: 3000,
          });
        }
      },
    });
  };

  const handleDeleteMultiple = () => {
    if (selectedProducts.length === 0) return;

    confirmDialog({
      message: t("leads.deleteMultipleConfirmMessage", { count: selectedProducts.length }),
      header: t("leads.deleteConfirmation"),
      icon: "pi pi-exclamation-triangle",
      accept: async () => {
        try {
          const deletePromises = selectedProducts.map((lead) =>
            dispatch(deleteLeadMiddleware(lead.leadId || lead.id))
          );

          const results = await Promise.all(deletePromises);
          const successCount = results.filter((r) =>
            r.type.endsWith("/fulfilled")
          ).length;
          const failCount = results.length - successCount;

          if (successCount > 0) {
            toast.current.show({
              severity: failCount > 0 ? "warn" : "success",
              summary: failCount > 0 ? t("leads.partialSuccess") : t("common.success"),
              detail: failCount > 0
                ? t("leads.leadsDeletedCountWithFail", { successCount, failCount })
                : t("leads.leadsDeletedCount", { successCount }),
              life: 3000,
            });
          } else {
            toast.current.show({
              severity: "error",
              summary: t("common.error"),
              detail: t("leads.failedToDeleteLeads"),
              life: 3000,
            });
          }

          // Clear selection and refresh
          setSelectedProducts([]);
          dispatch(
            getleadtableMiddleware({
              page: currentPage,
              pageSize: rowsPerPage,
              ...(filters.leadCategory && { leadCategory: filters.leadCategory }),
              ...(filters.country && { country: filters.country }),
              ...(filters.province && { province: filters.province }),
              ...(filters.city && { city: filters.city }),
              ...(search && { query: search }),
              ...(lob && { lob }),
            })
          );
        } catch (error) {
          toast.current.show({
            severity: "error",
            summary: t("common.error"),
            detail: t("leads.unexpectedError"),
            life: 3000,
          });
        }
      },
    });
  };

  const ViewheaderStyle = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Poppins",
    fontWeight: 500,
    color: "#000",
    border: " none",
    display: "flex",
    alignItem: "center",
    height: "56px",
  };

  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Poppins",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const rendercheckedHeader = (value) => {
    return selectedProducts.length === 0 ? (
      value
    ) : (
      <div
        className="header__btn__container"
        style={{ display: "flex", gap: "10px", alignItems: "center" }}
      >
        <span style={{ fontWeight: "500" }}>
          {t("leads.selectedCount", { count: selectedProducts.length })}
        </span>
        <Button
          label={t("common.delete")}
          icon="pi pi-trash"
          className="p-button-danger p-button-sm"
          onClick={handleDeleteMultiple}
        />
      </div>
    );
  };

  const renderUncheckedHeader = (value) => {
    return selectedProducts.length == 0 && value;
  };

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />

      {error && (
        <Message severity="error" text={error} className="w-full mb-4" />
      )}

      <div className="grid">
        <div className="col-12 md:col-6 lg:col-6">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              placeholder={t("leads.searchByNameLeadId")}
              onChange={(e) => debouncedSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "1rem 2.75rem",
                borderRadius: "10px",
              }}
            />
          </span>
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <Button
            label={t("leads.filters")}
            icon={showFilters ? "pi pi-times" : "pi pi-filter"}
            className="p-button-outlined"
            onClick={() => setShowFilters(!showFilters)}
            style={{ width: "100%" }}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <div className="flex gap-2">
            <MultiSelect
              value={visibleColumns}
              options={allColumns}
              optionLabel="label"
              optionValue="value"
              onChange={(e) => setVisibleColumns(e.value)}
              placeholder={t("leads.columns")}
              className="w-full"
            />
            <Button
              icon="pi pi-download"
              className="p-button-help"
              onClick={exportCSV}
              tooltip={t("leads.exportCsv")}
              tooltipOptions={{ position: "top" }}
            />
          </div>
        </div>
      </div>

      {showFilters && (
        <div
          className="filter-container-bg grid mt-3"
          style={{
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          <div className="col-12 md:col-3 lg:col-3">
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
              }}
            >
              {t("leads.filterCategory")}
            </label>
            <Dropdown
              value={filters.leadCategory}
              options={categoryOptions}
              onChange={(e) => handleFilterChange("leadCategory", e.value)}
              placeholder={t("leads.selectCategory")}
              style={{ width: "100%" }}
              dropdownIcon={<SvgDownArrow />}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
              }}
            >
              {t("leads.filterCountry")}
            </label>
            <Dropdown
              value={filters.country}
              options={countryOptions}
              onChange={(e) => handleFilterChange("country", e.value)}
              placeholder={t("leads.selectCountry")}
              style={{ width: "100%" }}
              dropdownIcon={<SvgDownArrow />}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
              }}
            >
              {t("leads.filterProvince")}
            </label>
            <Dropdown
              value={filters.province}
              options={provinceOptions}
              onChange={(e) => handleFilterChange("province", e.value)}
              placeholder={t("leads.selectProvince")}
              style={{ width: "100%" }}
              dropdownIcon={<SvgDownArrow />}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
              }}
            >
              {t("leads.filterCity")}
            </label>
            <Dropdown
              value={filters.city}
              options={cityOptions}
              onChange={(e) => handleFilterChange("city", e.value)}
              placeholder={t("leads.selectCity")}
              style={{ width: "100%" }}
              dropdownIcon={<SvgDownArrow />}
            />
          </div>
          <div
            className="col-12"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <Button
              label={t("leads.clearFilters")}
              icon="pi pi-filter-slash"
              className="p-button-secondary p-button-outlined"
              onClick={handleClearFilters}
            />
          </div>
        </div>
      )}
      <div className="lead__table__container">
        {loading ? (
          <DataTable value={Array(5).fill({})} className="p-datatable-striped">
            <Column
              header={t("tables.name")}
              body={<Skeleton width="100%" height="24px" />}
            />
            <Column
              header={t("tables.category")}
              body={<Skeleton width="80px" height="24px" />}
            />
            <Column
              header={t("tables.date")}
              body={<Skeleton width="100px" height="24px" />}
            />
            <Column
              header={t("tables.quotes")}
              body={<Skeleton width="60px" height="24px" />}
            />
            <Column
              header={t("tables.actions")}
              body={<Skeleton width="150px" height="24px" />}
            />
          </DataTable>
        ) : (
          <DataTable
            ref={dt}
            value={leadtabledata}
            paginator
            rows={rowsPerPage}
            totalRecords={totalRecords}
            loading={processing}
            selectionMode={selectionMode}
            selection={selectedProducts}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            onSelectionChange={(e) => setSelectedProducts(e.value)}
            onPage={(e) => {
              setCurrentPage(e.page + 1);
              setRowsPerPage(e.rows);
            }}
            dataKey="leadId"
            tableStyle={{ minWidth: "50rem" }}
            scrollable={true}
            scrollHeight="60vh"
          >
            <Column
              selectionMode={selectionMode}
              body={(rowData) => (
                <Checkbox
                  checked={selectedProducts.includes(rowData)}
                  onChange={() => {}}
                />
              )}
              headerStyle={headerStyle}
            ></Column>
            {visibleColumns.includes("name") && (
              <Column
                body={renderName}
                header={rendercheckedHeader(t("tables.name"))}
                headerStyle={headerStyle}
                sortable
                sortField="firstName"
              />
            )}
            {visibleColumns.includes("category") && (
              <Column
                body={renderCategory}
                header={renderUncheckedHeader(t("tables.category"))}
                headerStyle={headerStyle}
                sortable
                sortField="leadCategory"
              />
            )}
            {visibleColumns.includes("date") && (
              <Column
                body={renderDate}
                header={renderUncheckedHeader(t("tables.date"))}
                headerStyle={headerStyle}
                sortable
                sortField="DOB"
              />
            )}
            {visibleColumns.includes("quotes") && (
              <Column
                body={renderQuotes}
                header={renderUncheckedHeader(t("tables.quotes"))}
                headerStyle={headerStyle}
                sortable
                sortField="quotationsCount"
              />
            )}
            {visibleColumns.includes("actions") && (
              <Column
                body={renderViewEditButton}
                header={renderUncheckedHeader(t("tables.actions"))}
                headerStyle={ViewheaderStyle}
              />
            )}
          </DataTable>
        )}
      </div>
    </div>
  );
};

export default LeadListingMotorTable;
