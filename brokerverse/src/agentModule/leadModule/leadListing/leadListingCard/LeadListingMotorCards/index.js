import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Paginator } from "primereact/paginator";
import { Checkbox } from "primereact/checkbox";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import { Skeleton } from "primereact/skeleton";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import debounce from "lodash/debounce";
import {
  getleadtableMiddleware,
  getLeadByIdMiddleware,
  deleteLeadMiddleware,
} from "../../../Store/leadMiddleware";
import { isFireLob, isIarLob } from "../../../../endorsementModule/constants/endorsementCategories";
import countriesData from "../../../leadCreation/mock";
import SvgMotorTable from "../../../../../assets/agentIcon/SvgMotorTable";
import "./index.scss";
import { formatDate as formatConfiguredDate } from "../../../../../utility/dateFormat";

const LeadListingMotorCards = ({ lob = null, activeTab = 0, tabIndex = 0 }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useRef(null);

  // Redux state
  const { leadtabledata, loading, totalRecords } = useSelector(
    ({ leadReducers }) => ({
      leadtabledata: leadReducers?.leadtabledata || [],
      loading: leadReducers?.loading || false,
      totalRecords: leadReducers?.totalLeads || 0,
    })
  );

  // Local state
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [filters, setFilters] = useState({
    leadCategory: "",
    country: "",
    province: "",
    city: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback((value) => {
    const handler = debounce(() => {
      setSearch(value);
    }, 500);
    handler();
  }, []);

  // Fetch leads on component mount, when filters change, or when tab becomes active
  useEffect(() => {
    if (activeTab !== tabIndex) return;
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
  }, [dispatch, currentPage, rowsPerPage, filters, search, lob, activeTab, tabIndex]);

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
    setCurrentPage(1);
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

  const handleSelectLead = (lead) => {
    const isSelected = selectedLeads.find((l) => l.leadId === lead.leadId);
    if (isSelected) {
      setSelectedLeads(selectedLeads.filter((l) => l.leadId !== lead.leadId));
    } else {
      setSelectedLeads([...selectedLeads, lead]);
    }
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === leadtabledata.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads([...leadtabledata]);
    }
  };

  const handleView = async (leadId) => {
    try {
      await dispatch(getLeadByIdMiddleware(leadId));
      navigate(`/agent/leaddetail/${leadId}`);
    } catch (error) {
      console.error("Error fetching lead details:", error);
    }
  };

  const handleEdit = async (leadId) => {
    try {
      await dispatch(getLeadByIdMiddleware(leadId));
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
    } catch (error) {
      console.error("Error editing lead:", error);
    }
  };

  const handleDelete = (lead) => {
    const leadId = lead.leadId || lead.id;
    const fullName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
    confirmDialog({
      message: t("leads.deleteConfirmMessage", { name: fullName || "this lead" }),
      header: t("leads.confirmation"),
      icon: "pi pi-exclamation-triangle",
      accept: async () => {
        try {
          await dispatch(deleteLeadMiddleware(leadId));
          toast.current.show({
            severity: "success",
            summary: t("common.success"),
            detail: t("leads.leadDeletedSuccess"),
            life: 3000,
          });
          // Refresh the table
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
        } catch (error) {
          toast.current.show({
            severity: "error",
            summary: t("common.error"),
            detail: t("leads.failedToDeleteLead"),
            life: 3000,
          });
        }
      },
    });
  };

  const onPageChange = (event) => {
    setCurrentPage(event.page + 1);
    setRowsPerPage(event.rows);
  };

  const formatDate = (dateString) => formatConfiguredDate(dateString, { empty: "N/A" });

  const renderSkeleton = () => {
    return Array(6)
      .fill(0)
      .map((_, index) => (
        <div key={index} className="col-12 md:col-6 lg:col-4">
          <Card className="lead-card-skeleton">
            <Skeleton width="100%" height="150px" />
          </Card>
        </div>
      ));
  };

  const handleViewQuotations = (leadId) => {
    if (leadId) {
      navigate(`/agent/quotelisting?leadRefId=${leadId}`);
    } else {
      console.error("No leadId found for viewing quotations");
      navigate("/agent/quotelisting");
    }
  };

  return (
    <div className="lead-cards-container">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Search and Filter Bar */}
      <div className="lead-cards-toolbar">
        <div className="p-inputgroup search-input-group">
          <span className="p-inputgroup-addon">
            <i className="pi pi-search"></i>
          </span>
          <InputText
            placeholder={t("leads.searchByNameLeadId")}
            onChange={(e) => debouncedSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-actions">
          <Button
            label={showFilters ? t("leads.hideFilters") : t("leads.showFilters")}
            icon="pi pi-filter"
            onClick={() => setShowFilters(!showFilters)}
            className="p-button-outlined"
          />
          {selectedLeads.length > 0 && (
            <span className="selected-count">
              {t("leads.selectedCount", { count: selectedLeads.length })}
            </span>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card className="filter-card">
          <div className="grid">
            <div className="col-12 md:col-3">
              <label className="filter-label">{t("leads.filterCategory")}</label>
              <Dropdown
                value={filters.leadCategory}
                options={categoryOptions}
                onChange={(e) => handleFilterChange("leadCategory", e.value)}
                placeholder={t("leads.selectCategory")}
                className="w-full"
              />
            </div>
            <div className="col-12 md:col-3">
              <label className="filter-label">{t("leads.filterCountry")}</label>
              <Dropdown
                value={filters.country}
                options={countryOptions}
                onChange={(e) => handleFilterChange("country", e.value)}
                placeholder={t("leads.selectCountry")}
                className="w-full"
                filter
              />
            </div>
            <div className="col-12 md:col-3">
              <label className="filter-label">{t("leads.filterProvince")}</label>
              <Dropdown
                value={filters.province}
                options={provinceOptions}
                onChange={(e) => handleFilterChange("province", e.value)}
                placeholder={t("leads.selectProvince")}
                className="w-full"
                filter
              />
            </div>
            <div className="col-12 md:col-3">
              <label className="filter-label">{t("leads.filterCity")}</label>
              <Dropdown
                value={filters.city}
                options={cityOptions}
                onChange={(e) => handleFilterChange("city", e.value)}
                placeholder={t("leads.selectCity")}
                className="w-full"
                filter
              />
            </div>
            <div className="col-12">
              <Button
                label={t("leads.clearFilters")}
                icon="pi pi-times"
                onClick={handleClearFilters}
                className="p-button-text"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Select All Checkbox */}
      {/* {leadtabledata.length > 0 && (
        <div className="select-all-container">
          <Checkbox
            inputId="selectAll"
            checked={
              selectedLeads.length === leadtabledata.length &&
              leadtabledata.length > 0
            }
            onChange={handleSelectAll}
          />
          <label htmlFor="selectAll" className="ml-2">
            Select All
          </label>
        </div>
      )} */}

      {/* Cards Grid */}
      <div className="grid">
        {loading ? (
          renderSkeleton()
        ) : leadtabledata.length === 0 ? (
          <div className="col-12">
            <Card className="empty-state-card">
              <div className="empty-state">
                <i className="pi pi-inbox" style={{ fontSize: "3rem" }}></i>
                <h3>{t("leads.noLeadsFound")}</h3>
                <p>{t("leads.tryAdjustingSearchOrFilters")}</p>
              </div>
            </Card>
          </div>
        ) : (
          leadtabledata.map((lead) => {
            const isSelected = selectedLeads.find(
              (l) => l.leadId === lead.leadId
            );
            return (
              <div key={lead.leadId} className="col-12 md:col-6 lg:col-6">
                <Card
                  className={`lead-card cursor-pointer ${
                    isSelected ? "lead-card-selected" : ""
                  } 
                  `}
                  onClick={() => handleViewQuotations(lead.leadId)}
                >
                  <div className="lead-card-header">
                    <div className="lead-card-checkbox">
                      {/* <Checkbox
                        checked={!!isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectLead(lead);
                        }}
                      /> */}
                    </div>
                    <div>
                      <SvgMotorTable />
                    </div>
                  </div>

                  <div className="lead-card-body">
                    <h3 className="lead-name">
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <div className="lead-detail">
                      <span className="lead-label">{t("leads.cardLeadId")}:</span>
                      <span className="lead-value">
                        {lead.generatedLeadId || lead.leadId || "N/A"}
                      </span>
                    </div>
                    <div className="lead-detail">
                      <span className="lead-label">{t("leads.cardCategory")}:</span>
                      <span className="lead-value uppercase">
                        {lead.leadCategory || "N/A"}
                      </span>
                    </div>
                    <div className="lead-detail">
                      <span className="lead-label">{t("leads.cardDate")}:</span>
                      <span className="lead-value">
                        {formatDate(lead.DOB || lead.createdAt)}
                      </span>
                    </div>
                    <div className="lead-detail">
                      <span className="lead-label">{t("leads.cardQuotes")}:</span>
                      <span className="lead-value quotes-badge">
                        {lead.quotationsCount || 0}
                      </span>
                    </div>
                    {lead.email && (
                      <div className="lead-detail">
                        <span className="lead-label">{t("leads.cardEmail")}:</span>
                        <span className="lead-value">{lead.email}</span>
                      </div>
                    )}
                    {lead.mobileNumber && (
                      <div className="lead-detail">
                        <span className="lead-label">{t("leads.cardPhone")}:</span>
                        <span className="lead-value">{lead.mobileNumber}</span>
                      </div>
                    )}
                  </div>

                  <div className="lead-card-footer">
                    <Button
                      label={t("common.view")}
                      icon="pi pi-eye"
                      className="p-button-text p-button-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(lead.leadId);
                      }}
                    />
                    <Button
                      label={t("common.edit")}
                      icon="pi pi-pencil"
                      className="p-button-text p-button-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(lead.leadId);
                      }}
                    />
                    <Button
                      label={t("common.delete")}
                      icon="pi pi-trash"
                      className="p-button-text p-button-sm p-button-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(lead);
                      }}
                    />
                  </div>
                </Card>
              </div>
            );
          })
        )}
      </div>

      {/* Paginator */}
      {totalRecords > 0 && (
        <Paginator
          first={(currentPage - 1) * rowsPerPage}
          rows={rowsPerPage}
          totalRecords={totalRecords}
          rowsPerPageOptions={[6, 12, 24, 48]}
          onPageChange={onPageChange}
          className="mt-4"
        />
      )}
    </div>
  );
};

export default LeadListingMotorCards;
