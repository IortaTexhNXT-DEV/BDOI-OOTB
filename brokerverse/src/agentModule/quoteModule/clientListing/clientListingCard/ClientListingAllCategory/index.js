import { InputText } from "primereact/inputtext";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import { Avatar } from "primereact/avatar";
import { useDispatch } from "react-redux";
import {
  getClientEditMiddleWare,
  getPaymentSearchDataMiddleWare,
} from "../../store/clientsMiddleware";
import SvgDropdownicon from "../../../../../assets/icons/SvgDropdownicon";
import { formatDate as formatConfiguredDate } from "../../../../../utility/dateFormat";

const ClientListingAllCategory = ({
  data,
  clientListTable,
  paymentSearchList,
}) => {
  const { t } = useTranslation();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectionMode] = useState("multiple");
  const [globalFilter, setGlobalFilter] = useState("Name");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cities = [
    { name: t("clients.name"), code: "Name" },
    { name: t("clients.clientIdSearch"), code: "ClientID" },
  ];

  useEffect(() => {
    if (globalFilter && search) {
      dispatch(
        getPaymentSearchDataMiddleWare({
          field: globalFilter,
          value: search,
          status: data,
        })
      );
    }
  }, [search]);

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
              {t("clients.rowsPerPage")}{" "}
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

  const renderViewEditButton = (rowData) => {
    return (
      <div className="btn__container__view__edit">
        <div>
          <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("clients.edit", { defaultValue: "Edit" })} tooltip={t("clients.edit", { defaultValue: "Edit" })} tooltipOptions={{ position: "top" }} onClick={() => handleEditAction(rowData)} />
        </div>
        <div>
          <Button icon="pi pi-arrow-right" text rounded size="small" aria-label={t("clients.view", { defaultValue: "View" })} tooltip={t("clients.view", { defaultValue: "View" })} tooltipOptions={{ position: "top" }} onClick={() => handleViewAction(rowData)} />
        </div>
      </div>
    );
  };
  const handleSvg = (type, index) => {
    const colors = [
      "#D4635D",
      "#67D07A",
      "#D4635D",
      "#874EFF",
      "#EDC63B",
      "#A36EFF",
      "#5DCB67",
      "#0072d8",
      "#D8BFD8",
      "#FFA07A",
    ];

    const backgroundColor =
      colors[parseInt(index) % colors.length] || "#CCCCCC";

    return (
      <Avatar
        label={(type || "?").charAt(0).toUpperCase()}
        size="xlarge"
        shape="circle"
        style={{ backgroundColor: backgroundColor, color: "#fff" }}
      />
    );
  };

  const renderName = (rowData) => {
    return (
      <div className="name__box__container">
        <div>{handleSvg(rowData.DisplayName || rowData.FirstName, rowData.id)}</div>
        <div>
          <div className="name__text">{rowData.DisplayName || rowData.FirstName}</div>
          <div className="lead__id__text">{t("clients.clientIdLabel")}{rowData.LeadID} </div>
        </div>
      </div>
    );
  };

  const renderCategory = (rowData) => {
    return (
      <div className="category__text">{rowData.category ? rowData.category.charAt(0).toUpperCase() + rowData.category.slice(1).toLowerCase() : ""}</div>
    );
  };

  const renderDes = (rowData) => {
    return (
      <div className="category__text">
        {rowData.ProductDescription}
      </div>
    );
  };

  const renderDate = (rowData) => {
    // Format createdAt date as yyyy-mm-dd
    const formatDate = (dateString) => formatConfiguredDate(dateString, { empty: "" });
    
    // Try multiple possible date fields
    const dateValue = rowData.createdAt || rowData.created_at || rowData.dateCreated || rowData.date_created;
    
    return <div className="date__text">{formatDate(dateValue)}</div>;
  };

  const renderQuotes = (rowData) => {
    return <div className="quote__text">{rowData.Quotes}</div>;
  };

  const handleEditAction = (rowData) => {
    dispatch(getClientEditMiddleWare(rowData));
    navigate("/agent/clientedit");
  };

  const handleViewAction = (rowData) => {
    // Use the actual client ID from the database
    const clientId = rowData.id || rowData.clientId || rowData.LeadID;
    navigate(`/agent/clientview/${clientId}`);
  };

  const ViewheadercenterStyle = {
    // justifyContent: 'center',
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
    display: "flex",
    justifyContent: "center",
    // display: "grid",
    alignItem: "center",
  };

  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const rendercheckedHeader = (value) => {
    return selectedProducts.length === 0 ? (
      value
    ) : selectedProducts.length === 1 ? (
      <div className="header__btn__container">
        <div className="header__delete__btn">{t("clients.delete")}</div>
        <div className="header__edit__btn">{t("clients.edit")}</div>
      </div>
    ) : (
      <div className="header__delete__btn">{t("clients.delete")}</div>
    );
  };

  const renderUncheckedHeader = (value) => {
    return selectedProducts.length == 0 && value;
  };

  return (
    <div>
      <div className="grid">
        <div className="col-12 md:col-9 lg:col-9">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              placeholder={t("clients.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "1rem 2.75rem",
                borderRadius: "10px",
              }}
            />
          </span>
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <Dropdown
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.value)}
            options={cities}
            optionLabel="name"
            optionValue="code"
            placeholder={t("clients.searchBy")}
            className="sorbyfilter__style"
            dropdownIcon={<SvgDropdownicon />}
          />
        </div>
      </div>
      <div className="lead__table__container">
        <DataTable
          value={search ? paymentSearchList : clientListTable}
          paginator
          rows={5}
          selectionMode={selectionMode}
          selection={selectedProducts}
          rowsPerPageOptions={[5, 10, 25, 50]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          className="corrections__table__main"
          onSelectionChange={(e) => setSelectedProducts(e.value)}
          dataKey="id"
          tableStyle={{ minWidth: "50rem" }}
          scrollable={true}
          scrollHeight="60vh"
        >
          <Column
            body={renderName}
            header={rendercheckedHeader(t("clients.assuredName"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderCategory}
            header={renderUncheckedHeader(t("clients.category"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDate}
            header={renderUncheckedHeader(t("clients.clientSince"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderQuotes}
            header={renderUncheckedHeader(t("clients.policies"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDes}
            header={renderUncheckedHeader(t("clients.latestPolicyStatus"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderViewEditButton}
            header={renderUncheckedHeader(t("clients.actions"))}
            headerStyle={ViewheadercenterStyle}
          ></Column>
        </DataTable>
      </div>
    </div>
  );
};

export default ClientListingAllCategory;
