import React from "react";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgFilters from "../../../../assets/icons/SvgFilters";
import "../index.scss";
import { useMasterRecords } from "../../../GeneralMasters/common/useMasterOptions";

const CompanyMasterTable = () => {
  // Records of the Company master (GET /masters/company)
  const products = useMasterRecords("company");

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
            Row count :{" "}
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
    fontSize: 14,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  return (
    <div>
      <Card className="mt-4">
        <div className="header_search_container grid">
          <div class="col-12 md:col-6 lg:col-10">
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder="Search customers"
                className="searchinput_left"
              />
            </span>
          </div>
          <div class="col-12 md:col-6 lg:col-2">
            <Button
              label="Sort By"
              outlined
              icon={<SvgFilters />}
              className="sorbyfilter_container"
            />
          </div>
        </div>

        {/* </div> */}

        <div className="card" style={{ maxHeight: "50vh", overflowY: "auto" }}>
          <DataTable
            value={products}
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
              field="CompanyCode"
              header="Company code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="CompanyName"
              header="Company name"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="LicenseNumber"
              header="License Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="Country"
              header="Country"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="PhoneNumber"
              header="Phone Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="EmailID"
              header="Email"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="status"
              header="Status"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(columnData) => columnData.status}
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default CompanyMasterTable;
