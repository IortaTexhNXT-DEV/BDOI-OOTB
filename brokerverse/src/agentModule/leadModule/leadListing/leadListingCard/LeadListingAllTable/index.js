import { InputText } from "primereact/inputtext";
import TableDropdownField from "../../../../component/tableDropDwonField";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import SvgEdit from "../../../../../assets/icons/SvgEdits";
import { Button } from "primereact/button";
import SvgArrow from "../../../../../assets/icons/SvgArrow";
import SvgMotorTable from "../../../../../assets/agentIcon/SvgMotorTable";
import SvgTravlesTable from "../../../../../assets/agentIcon/SvgTravlesTable";
import SvgHomeTable from "../../../../../assets/agentIcon/SvgHomeTable";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import "../../index.scss";
import { useDispatch, useSelector } from "react-redux";
import {
  getLeadEditDataMiddleWare,
  getPaymentSearchDataMiddleWare,
  patchLeadEditMiddleWare,
} from "../../../Store/leadMiddleware";
import SvgDropdownicon from "../../../../../assets/icons/SvgDropdownicon";

const LeadListingAllTable = ({ leadtabledata, paymentSearchList }) => {
  const { t } = useTranslation();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectionMode, setSelectionMode] = useState("multiple");
  const [globalFilter, setGlobalFilter] = useState("Name");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const cities = [
    { name: t("tables.name"), code: "Name" },
    { name: t("tables.leadId"), code: "LeadID" },
  ];

  useEffect(() => {
    if (globalFilter && search) {
      dispatch(
        getPaymentSearchDataMiddleWare({
          field: globalFilter,
          value: search,
          // status1: status,
        })
      );
    }
  }, [search]);

  const TableData = [
    {
      id: "1",
      Name: "Sophie Clark",
      Category: "Retail",
      Date: "2024-01-26",
      Quotes: "01",
      LeadID: "123456",
      Svg: <SvgMotorTable />,
      dateSortField: "11001",
    },

    {
      id: "2",
      Name: "Daniel Brown",
      Category: "Corporate",
      Date: "2024-08-10",
      Quotes: "01",
      LeadID: "1234000",
      Svg: <SvgMotorTable />,
      dateSortField: "11008",
    },
    {
      id: "3",
      Name: "Sophia Carter",
      Category: "Retail",
      Date: "2024-09-15",
      Quotes: "02",
      LeadID: "1234555",
      Svg: <SvgHomeTable />,
      dateSortField: "11009",
    },

    {
      id: "4",
      Name: "Olivia Turner",
      Category: "Retail",
      Date: "2024-05-25",
      Quotes: "04",
      LeadID: "1456",
      Svg: <SvgHomeTable />,
      dateSortField: "11005",
    },
    {
      id: "5",
      Name: "David Rodriguez",
      Category: "Corporate",
      Date: "2024-06-30",
      Quotes: "05",
      LeadID: "123116",
      Svg: <SvgHomeTable />,
      dateSortField: "11006",
    },
  ];

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
              Rows per page:{" "}
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
          <Button
            icon={<SvgEdit />}
            className="view__btn"
            onClick={() => handleEdit(rowData)}
          />
        </div>
        <div>
          <Button
            icon={<SvgArrow />}
            className="edit__btn"
            onClick={() => handleView(rowData)}
          />
        </div>
      </div>
    );
  };

  const renderName = (rowData) => {
    return (
      <div className="name__box__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="name__text">{rowData.FirstName?.toUpperCase()}</div>
          <div className="lead__id__text">Lead Id :{rowData.LeadID} </div>
        </div>
      </div>
    );
  };

  const renderCategory = (rowData) => {
    return (
      <div className="category__text">{rowData.category?.toUpperCase()}</div>
    );
  };

  const renderDate = (rowData) => {
    // Format createdAt date as yyyy-mm-dd
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid date
      return date.toISOString().split('T')[0]; // Format as yyyy-mm-dd
    };
    
    // Use createdAt instead of DateofBirth
    const dateValue = rowData.createdAt || rowData.created_at || rowData.dateCreated || rowData.date_created;
    
    return <div className="date__text">{formatDate(dateValue)}</div>;
  };

  const renderQuotes = (rowData) => {
    return <div className="quote__text">{rowData.Quotes?.toUpperCase()}</div>;
  };

  const handleView = () => {
    navigate("/agent/quotelisting");
  };

  const handleEdit = (rowData) => {
    dispatch(getLeadEditDataMiddleWare(rowData));
    navigate("/agent/leadedit");
  };

  const ViewheaderStyle = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
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
        <div className="header__delete__btn">{t("tables.delete")}</div>
        <div className="header__edit__btn" onClick={() => handleEdit("1")}>
          {t("tables.edit")}
        </div>
      </div>
    ) : (
      <div className="header__delete__btn">{t("tables.delete")}</div>
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
            {/* <SvgSearch/> */}
            <InputText
              placeholder={t("tables.search")}
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
          {/* <TableDropdownField label="Search By" /> */}
          <Dropdown
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.value)}
            options={cities}
            optionLabel="name"
            optionValue="code"
            placeholder={t("tables.searchBy")}
            className="sorbyfilter__style"
            dropdownIcon={<SvgDownArrow />}
          />
        </div>
      </div>
      <div className="lead__table__container">
        <DataTable
          value={search ? paymentSearchList : leadtabledata}
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
          scrollable={true}
          scrollHeight="60vh"
          tableStyle={{ minWidth: "50rem" }}
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
          <Column
            body={renderName}
            header={rendercheckedHeader(t("tables.name"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderCategory}
            header={renderUncheckedHeader(t("tables.category"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDate}
            header={renderUncheckedHeader(t("tables.date"))}
            headerStyle={headerStyle}
            sortable
            sortField="dateSortField"
          ></Column>
          <Column
            body={renderQuotes}
            header={renderUncheckedHeader(t("tables.quotes"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderViewEditButton}
            header={renderUncheckedHeader(t("tables.actions"))}
            headerStyle={ViewheaderStyle}
          ></Column>
        </DataTable>
      </div>
    </div>
  );
};

export default LeadListingAllTable;
