import { InputText } from "primereact/inputtext";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import SvgEdit from "../../../../assets/icons/SvgEdits";
import { Button } from "primereact/button";
import SvgArrow from "../../../../assets/icons/SvgArrow";
import SvgMotorTable from "../../../../assets/agentIcon/SvgMotorTable";
import SvgTravlesTable from "../../../../assets/agentIcon/SvgTravlesTable";
import SvgHomeTable from "../../../../assets/agentIcon/SvgHomeTable";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import "../../PaymentTabel/index.scss";
import { useDispatch, useSelector } from "react-redux";
import {
  getPaymentPaidSearchDataMiddleWare,
  getPaymentSearchDataMiddleWare,
} from "../../store/paymentMiddleware";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";

const PaidListTabelData = () => {
  const { t } = useTranslation();
  const {
    paymenttabledata,
    paymentSearchList,
    loading,
    paymentPaidSearchList,
    paymentPendingtabledata,
    paymentRewiwingtabledata,
  } = useSelector(({ agentPaymentMainReducers }) => {
    return {
      loading: agentPaymentMainReducers?.loading,
      paymenttabledata: agentPaymentMainReducers?.paymenttabledata,
      paymentPaidSearchList: agentPaymentMainReducers?.paymentPaidSearchList,
    };
  });
  console.log(paymentPaidSearchList, "paymentPaidSearchList  ");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectionMode, setSelectionMode] = useState("multiple");
  const [globalFilter, setGlobalFilter] = useState("PolicyNumber");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const cities = [
    { name: "PolicyNumber", code: "PolicyNumber" },
    { name: "ClientId", code: "ClientId" },
  ];

  useEffect(() => {
    if (globalFilter && search) {
      dispatch(
        getPaymentPaidSearchDataMiddleWare({
          field: globalFilter,
          value: search,
          // status1: status,
        })
      );
    }
  }, [search]);

  // const paymenttabledata = [
  //   {
  //     id: 1,
  //     type: "Policy",
  //     name: "CarsonDarrin",
  //     clintid: "123",
  //     policyNo: "999",
  //     grosspremium: "355",
  //     policyIssued: "13/12/12",
  //     policyExpird: "13/12/12",
  //     status: "PAID"
  //   },
  //   {
  //     id: 2,
  //     type: "Renewal Policy",
  //     name: "Carson Darrin",
  //     clintid: "456",
  //     policyNo: "98456",
  //     grosspremium: "655",
  //     policyIssued: "13/12/12",
  //     policyExpird: "13/12/12",
  //     status: "PAID"
  //   },
  //   {
  //     id: 3,
  //     type: "Renewal Policy",
  //     name: "Carson Darrin",
  //     clintid: "566",
  //     policyNo: "123456",
  //     grosspremium: "655",
  //     policyIssued: "13/12/12",
  //     policyExpird: "13/12/12",
  //     status: "PAID"
  //   },
  //   {
  //     id: 4,
  //     type: "Renewal Policy",
  //     name: "Carson Darrin",
  //     clintid: "786",
  //     policyNo: "67856",
  //     grosspremium: "655",
  //     policyIssued: "13/12/12",
  //     policyExpird: "13/12/12",
  //     status: "PAID"
  //   },

  // ]

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
            icon={<SvgArrow />}
            className="edit__btn"
            onClick={() => handleView(rowData)}
          />
        </div>
      </div>
    );
  };

  const renderType = (rowData) => {
    return (
      <div className="name__box__container">
        <div className="name__text">{rowData.type?.toUpperCase()}</div>
      </div>
    );
  };

  const renderName = (rowData) => {
    return <div className="category__text">{rowData.name?.toUpperCase()}</div>;
  };
  const renderClientId = (rowData) => {
    return (
      <div className="category__text">{rowData.clintid?.toUpperCase()}</div>
    );
  };
  const renderPolicyNo = (rowData) => {
    return (
      <div className="category__text">{rowData.policyNo?.toUpperCase()}</div>
    );
  };
  const renderGrossPremium = (rowData) => {
    return (
      <div className="category__text">
        {rowData.grosspremium?.toUpperCase()}
      </div>
    );
  };
  const renderPolicyIssued = (rowData) => {
    return (
      <div className="category__text">
        {rowData.policyIssued?.toUpperCase()}
      </div>
    );
  };
  const renderPolicyExpired = (rowData) => {
    return (
      <div className="category__text">
        {rowData.policyExpird?.toUpperCase()}
      </div>
    );
  };
  const renderStatus = (rowData) => {
    return <div className="status__text">{rowData.status?.toUpperCase()}</div>;
  };

  const handleView = () => {
    navigate(`/agent/policydetailedviewonly`);
  };

  const handleEdit = () => {
    navigate("/agent/leadedit");
  };

  const ViewheaderStyle = {
    justifyContent: "center",
    fontSize: 14,
    fontFamily: "Poppins",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const headerStyle = {
    textalign: "center",
    fontSize: 14,
    fontFamily: "Poppins",
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
        <div className="header__edit__btn">{t("tables.edit")}</div>
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
      <div class="grid">
        <div class="col-12 md:col-9 lg:col-9">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              placeholder={t("common.search")}
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
        <div class="col-12 md:col-3 lg:col-3">
          <Dropdown
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.value)}
            options={cities}
            optionLabel="name"
            optionValue="code"
            placeholder={t("tables.searchBy")}
            className="sorbyfilter__style"
            dropdownIcon={<SvgDropdownicon />}
          />
        </div>
      </div>
      <div className="lead__table__container">
        <DataTable
          value={search ? paymentPaidSearchList : paymenttabledata}
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
            body={renderType}
            header={rendercheckedHeader(t("tables.type"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderName}
            header={renderUncheckedHeader(t("tables.assuredName"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderClientId}
            header={renderUncheckedHeader(t("tables.clientId"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPolicyNo}
            header={renderUncheckedHeader(t("tables.policyNumber"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderGrossPremium}
            header={renderUncheckedHeader(t("tables.grossPremium"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPolicyIssued}
            header={renderUncheckedHeader(t("tables.policyIssued"))}
            headerStyle={headerStyle}
            sortField="dateSortField"
          ></Column>
          <Column
            body={renderPolicyExpired}
            header={renderUncheckedHeader(t("tables.policyExpiry"))}
            headerStyle={headerStyle}
            sortField="dateSortField"
          ></Column>
          <Column
            body={renderStatus}
            header={renderUncheckedHeader(t("tables.status"))}
            headerStyle={headerStyle}
            className="sorbyfilter_container"
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

export default PaidListTabelData;
