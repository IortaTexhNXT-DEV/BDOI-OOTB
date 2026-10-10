import React from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgFilters from "../../../../assets/icons/SvgFilters";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import SvgArrow from "../../../../assets/icons/SvgArrow";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { useMasterRecords } from "../../../GeneralMasters/common/useMasterOptions";
import PageActions from "../../../../components/PageActions";

const Index = () => {
  const { t } = useTranslation();
  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
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
    // backgroundColor: 'var(--color-danger)',
    fontSize: 14,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };

  const items = [{ label: t("financeMasters.branch") }];
  const home = { label: t("financeMasters.master") };

  const navigate = useNavigate();
  const records = useMasterRecords("branch", (row) => ({
    ...row,
    branchCode: row.BranchCode,
    companyName: row.CompanyName,
    manager: row.Description,
    country: row.Country,
    email: row.EmailID,
  }));

  const handlePolicy = () => {
    navigate("/master/finance/branch/branchadding");
  };

  return (
    <div className="overall_branch_master_initial_container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("financeMasters.branch")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          <PageActions onAdd={handlePolicy} />
        </div>
      </div>

      <Card>
        <div className="header_search_container">
          <div class="col-12 md:col-6 lg:col-9">
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder="Search customers"
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

        <div className="branch_text">Branch List</div>
        <div className="card">
          <DataTable
            value={records}
            tableStyle={{ minWidth: "50rem", color: "var(--text-color)" }}
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
          >
            <Column
              field="branchCode"
              header="Branch Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="companyName"
              header="Company Name"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="manager"
              header="Manager"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="country"
              header="Country"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="email"
              header="Email"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="status"
              header="Status"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(columnData) => <MasterStatusToggle type="branch" record={columnData} />}
            ></Column>
            <Column
              header="View"
              headerStyle={headerStyle}
              field="view"
              className="fieldvalue_container"
              body={() => <SvgArrow />}
            />
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default Index;
