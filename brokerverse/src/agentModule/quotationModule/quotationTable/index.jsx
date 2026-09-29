import { InputText } from "primereact/inputtext";
import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import SvgArrow from "../../../assets/icons/SvgArrow";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import "../../quotationModule/index.scss";
import {
  quotationSearchListDataMiddleWare,
  quotationListDataMiddleWare,
} from "../store/quotationMiddleWare";
import { useDispatch, useSelector } from "react-redux";
import StatusBadge from "../../../components/StatusBadge";
import { Skeleton } from "primereact/skeleton";
import SvgEdit from "../../../assets/icons/SvgEdit";
import { Tooltip } from "primereact/tooltip";
import { loadQuotationForEdit } from "../../quoteModule/Store/quotationReducer";
import { isFireLob } from "../../endorsementModule/constants/endorsementCategories";

const LeadListingAllTable = () => {
  const { t } = useTranslation();
  const { quotationListData, quotationListSearchData, pagination, loading } =
    useSelector(({ quotationMainReducers }) => {
      return {
        quotationListData: quotationMainReducers?.quotationListData,
        quotationListSearchData: quotationMainReducers?.quotationListSearchData,
        pagination: quotationMainReducers?.pagination,
        loading: quotationMainReducers?.loading,
      };
    });

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectionMode] = useState("multiple");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Use Redux pagination state, fallback to defaults
  const currentPage = pagination?.page || 1;
  const pageSize = pagination?.pageSize || 10;
  const totalRecords = pagination?.total || 0;

  // Fetch quotations on component mount only
  useEffect(() => {
    dispatch(quotationListDataMiddleWare({ page: 1, pageSize: 10 }));
  }, [dispatch]);

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
              {t("quoteListing.rowsPerPage")}{" "}
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

  const handleEdit = (rowData) => {
    console.log("Editing quotation:", rowData);
    const quotationId = rowData.id;
    const rawData = rowData.rawData || rowData;
    const productType =
      rawData?.productType ||
      rawData?.ProductType ||
      rowData?.PolicyType;

    if (productType && isFireLob(productType)) {
      navigate("/agent/quotedetailview", {
        state: {
          quotationData: rawData,
          quotationId,
          fromListing: true,
          action: "edit",
        },
      });
      return;
    }

    dispatch(loadQuotationForEdit(rawData));
    navigate(`/agent/editquote/policydetails/quotedetails/${quotationId}`, {
      state: {
        quotationData: rawData,
        quotationId,
        fromListing: true,
        action: "edit",
      },
    });
  };

  const handleViewDetail = (rowData) => {
    console.log("Viewing quotation detail:", rowData);

    // Navigate to read-only detail view
    navigate("/agent/quotedetailview", {
      state: {
        quotationData: rowData.rawData,
        quotationId: rowData.id,
        fromListing: true,
      },
    });
  };

  const renderViewEditButton = (rowData) => {
    const canEdit = ["Draft", "PendingCustomer", "InProgress"].includes(
      rowData.Status
    );
    const editBtnId = `edit-btn-${rowData.id}`;
    const viewBtnId = `view-btn-${rowData.id}`;

    return (
      <div
        className="btn__container__view__edit"
        style={{
          display: "flex",
          gap: "6px",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {canEdit && (
          <>
            <Button
              id={editBtnId}
              icon={<SvgEdit />}
              className="p-button-rounded p-button-text p-button-warning"
              onClick={() => handleEdit(rowData)}
              style={{ width: "32px", height: "32px" }}
              aria-label={t("quoteListing.editQuotation")}
            />
            <Tooltip
              target={`#${editBtnId}`}
              content={t("quoteListing.editQuotation")}
              position="top"
            />
          </>
        )}
        <Button
          id={viewBtnId}
          icon={<SvgArrow />}
          className="p-button-rounded p-button-text p-button-info"
          onClick={() => handleViewDetail(rowData)}
          style={{ width: "32px", height: "32px" }}
          aria-label={t("quoteListing.viewDetails")}
        />
        <Tooltip
          target={`#${viewBtnId}`}
          content={t("quoteListing.viewDetails")}
          position="top"
        />
      </div>
    );
  };

  const renderQuoteId = (rowData) => {
    if (loading) return <Skeleton width="100%" height="1.5rem" />;
    return (
      <div className="category__text" style={{ fontWeight: 500 }}>
        {rowData.QuoteId || "N/A"}
      </div>
    );
  };

  const renderPolicyType = (rowData) => {
    if (loading) return <Skeleton width="100%" height="1.5rem" />;
    return <div className="category__text">{rowData.PolicyType || "N/A"}</div>;
  };

  const renderLeadName = (rowData) => {
    if (loading) return <Skeleton width="100%" height="1.5rem" />;
    return (
      <div className="category__text" style={{ textTransform: "capitalize" }}>
        {rowData.LeadName || t("quoteListing.unknownLead")}
      </div>
    );
  };

  const renderDate = (rowData) => {
    if (loading) return <Skeleton width="100%" height="1.5rem" />;
    return <div className="date__text">{rowData.Date || "N/A"}</div>;
  };

  const renderGrossPremium = (rowData) => {
    if (loading) return <Skeleton width="100%" height="1.5rem" />;
    return (
      <div className="date__text" style={{ fontWeight: 600, color: "#2E7D32" }}>
        {rowData.GrossPremium}
      </div>
    );
  };

  const renderStatus = (rowData) => {
    if (loading) return <Skeleton width="100px" height="2rem" />;
    return (
      <StatusBadge
        status={rowData.Status}
        type="quotation"
        size="sm"
        showTooltip={false}
      />
    );
  };
  const [search, setSearch] = useState("");
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    // Clear previous timer if it exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new timer to make the API call after user pauses typing
    debounceTimerRef.current = setTimeout(() => {
      let query = {
        page: 1,
        pageSize: 10,
      };
      if (search) {
        query.search = search;
      }
      dispatch(quotationListDataMiddleWare(query));
    }, 500); // Wait 500ms after user stops typing

    // Cleanup function to clear timer on unmount or when search changes
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search, dispatch]);

  const ViewheaderStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
    // display: "grid",
    // alignItem: "center",
  };

  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const headeraction = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
    display: "flex",
    justifyContent: "center",
    alignItem: "center",
  };

  const rendercheckedHeader = (value) => {
    return selectedProducts.length === 0 ? (
      value
    ) : selectedProducts.length === 1 ? (
      <div className="header__btn__container">
        <div className="header__delete__btn">{t("quoteListing.delete")}</div>
        <div className="header__edit__btn">{t("quoteListing.edit")}</div>
      </div>
    ) : (
      <div className="header__delete__btn">{t("quoteListing.delete")}</div>
    );
  };

  const renderUncheckedHeader = (value) => {
    return selectedProducts.length === 0 && value;
  };

  return (
    <div className="bg-transparent">
      <div className="grid">
        <div className="col-12 md:col-12 lg:col-12">
          <span className="p-input-icon-left" style={{ width: "100%" }}>
            <i className="pi pi-search" />
            <InputText
              placeholder={t("quoteListing.search")}
              style={{
                width: "100%",
                padding: "1rem 2.75rem",
                borderRadius: "10px",
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
      </div>
      <div className="lead__table__container">
        <DataTable
          value={quotationListData}
          paginator={!search} // Disable pagination when searching (client-side filtering)
          lazy={!search} // Enable lazy loading for server-side pagination
          rows={pageSize}
          first={(currentPage - 1) * pageSize}
          totalRecords={totalRecords}
          selectionMode={selectionMode}
          selection={selectedProducts}
          rowsPerPageOptions={[5, 10, 25, 50]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          className="corrections__table__main"
          onSelectionChange={(e) => setSelectedProducts(e.value)}
          onPage={(e) => {
            // Only allow pagination when not searching (search is client-side)
            if (!search) {
              const newPage = e.page + 1;
              const newPageSize = e.rows;
              dispatch(
                quotationListDataMiddleWare({
                  page: newPage,
                  pageSize: newPageSize,
                })
              );
            }
          }}
          dataKey="id"
          tableStyle={{ minWidth: "50rem" }}
          loading={loading}
        >
          <Column
            field="QuoteId"
            body={renderQuoteId}
            header={rendercheckedHeader(t("quoteListing.quoteId"))}
            headerStyle={{ ...headerStyle, minWidth: "180px" }}
            sortable
          ></Column>
          <Column
            field="LeadName"
            body={renderLeadName}
            header={renderUncheckedHeader(t("quoteListing.leadName"))}
            headerStyle={{ ...headerStyle, minWidth: "200px" }}
            sortable
          ></Column>

          <Column
            field="PolicyType"
            body={renderPolicyType}
            header={renderUncheckedHeader(t("quoteListing.policyType"))}
            headerStyle={{ ...headerStyle, minWidth: "180px" }}
            sortable
          ></Column>
          <Column
            field="GrossPremiumValue"
            body={renderGrossPremium}
            header={renderUncheckedHeader(t("quoteListing.grossPremium"))}
            headerStyle={{ ...headerStyle, minWidth: "150px" }}
            sortable
          ></Column>
          <Column
            field="Date"
            body={renderDate}
            header={renderUncheckedHeader(t("quoteListing.date"))}
            headerStyle={{ ...headerStyle, minWidth: "130px" }}
            sortable
          ></Column>

          <Column
            field="Status"
            body={renderStatus}
            header={renderUncheckedHeader(t("quoteListing.status"))}
            headerStyle={{ ...headeraction, minWidth: "150px" }}
            style={{ textAlign: "center" }}
            sortable
          ></Column>
          <Column
            body={renderViewEditButton}
            header={renderUncheckedHeader(t("quoteListing.actions"))}
            headerStyle={{
              ...ViewheaderStyle,
              textAlign: "center",
              minWidth: "150px",
            }}
            style={{ textAlign: "center" }}
          ></Column>
        </DataTable>
      </div>
    </div>
  );
};

export default LeadListingAllTable;
