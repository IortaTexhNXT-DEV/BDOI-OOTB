import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import NavBar from "../../../../components/NavBar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgFilters from "../../../../assets/icons/SvgFilters";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
// import  {data} from "../BranchMasterInitial/mock"
import SvgArrow from "../../../../assets/icons/SvgArrow";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import ToggleButton from "../../../../components/ToggleButton";

const Index = () => {
  const { t } = useTranslation();
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
    width: "10rem",
    // backgroundColor: 'red',
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };

  const items = [{ label: t("financeMasters.department") }];
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
    navigate("/createvoucher");
  };
  const handleArrowClick = () => {
    navigate("/policyreceiptsview");
  };
  const handleEditClick = () => {
    navigate("/otherreceiptsview");
  };
  return (
    <div className="overall_department_master_initial_container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("financeMasters.department")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          <div className="addbutton_container" onClick={handlePolicy}>
            <SvgAdd className="addicon" />
            <p className="addtext">{t("generalMasters.add")}</p>
          </div>
        </div>
      </div>

      <Card>
        <div className="header_search_container">
          <div class="col-12 md:col-6 lg:col-9">
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("financeMasters.searchCustomers")}
                className="searchinput_left"
              />
            </span>
          </div>

          <div class="col-12 md:col-6 lg:col-3">
            <Button
              label={t("generalMasters.sortBy")}
              outlined
              icon={<SvgFilters />}
              className="sorbyfilter_container"
            />
          </div>
        </div>

        <div className="branch_text">Department List</div>
        <div className="card">
          <DataTable
            // value={data}
            tableStyle={{ minWidth: "50rem", color: "#1C2536" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
          >
            <Column
              field="departmentCode"
              header="Department Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="companyCode"
              header="Company Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="description"
              header="Description"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="shortDescription"
              header="Short Description"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="branchCode"
              header="Branch Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="date"
              header="Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              header="Status"
              headerStyle={headerStyle}
              field="status"
              className="fieldvalue_container"
              body={(columnData) => <ToggleButton id={columnData.id} />}
            />
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default Index;
