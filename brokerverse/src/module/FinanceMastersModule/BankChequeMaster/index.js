import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import NavBar from "../../../components/NavBar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgFilters from "../../../assets/icons/SvgFilters";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { ProductService } from "./mock";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import SvgArrow from "../../../assets/icons/SvgArrow";

const BankChequeMaster = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    ProductService.getProductsMini().then((data) => setProducts(data));
  }, []);

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
        <React.Fragment>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("financeMasters.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </React.Fragment>
      );
    },
  };

  const headerStyle = {
    // width: '10rem',
    // backgroundColor: 'red',
    fontSize: 14,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
    width: "16%",
    textalign: "center",
  };

  const items = [
    { label: t("financeMasters.bankCheque") },
  ];
  const home = { label: t("financeMasters.master") };

  const navigate = useNavigate();
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(5);
  const [globalFilter, setGlobalFilter] = useState("");

  const onPageChange = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  const onGlobalFilterChange = (event) => {
    setGlobalFilter(event.target.value);
  };

  const handlePolicy = () => {
    navigate("/master/finance/bankcheque/addbankcheque");
  };
  const handleArrowClick = (data) => {
    console.log("first", data);
    navigate("/master/finance/bankcheque/bankchequedetails");
  };
  const handleEditClick = () => {
    navigate("/otherreceiptsview");
  };
  return (
    <div className="overall__bankchequedetail__container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("financeMasters.bankChequeMaster")}</label>
          <BreadCrumb
            model={items}
            home={home}
            activeItem={items[0]}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          {/* <SvgFilters/> */}

          <div className="addbutton_container" onClick={handlePolicy}>
            <SvgAdd className="addicon" />
            <p className="addtext">{t("financeMasters.add")}</p>
          </div>
        </div>
      </div>

      <Card
      //   className="overallcard_container"
      >
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container">
          <div class="col-12 md:col-6 lg:col-10">
            {/* <div class="text-center p-3 border-round-sm bg-primary font-bold"> */}
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("financeMasters.searchByBankName")}
                className="searchinput_left"
              />
            </span>
          </div>
          {/* </div> */}
          <div class="col-12 md:col-6 lg:col-2">
            <Button
              label={t("financeMasters.sortBy")}
              outlined
              icon={<SvgFilters />}
              className="sorbyfilter_container"
            />
          </div>
        </div>
        <div className="listlable_textcontainer">
          <label className="listlable_text">{t("financeMasters.bankCheque")}</label>
        </div>

        <div className="card">
          <DataTable
            value={products}
            tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            className="datatable_container"
            scrollable={true}
            scrollHeight="40vh"
          >
            <Column
              field="name"
              header={t("financeMasters.chequeBookNumber")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="name"
              header={t("financeMasters.bankName")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="category"
              header={t("financeMasters.accountNumber")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="quantity"
              header={t("financeMasters.chequeLeafBeginning")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="name"
              header="Instrument End"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>

            <Column
              field="category"
              header={t("financeMasters.status")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>

            <Column
              body={(params) => <SvgArrow onClick={() => handleArrowClick()} />}
              header={t("financeMasters.view")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default BankChequeMaster;
