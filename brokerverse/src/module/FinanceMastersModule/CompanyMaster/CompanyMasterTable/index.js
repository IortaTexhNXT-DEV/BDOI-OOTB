import React from "react";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgFilters from "../../../../assets/icons/SvgFilters";
import "../index.scss";
import { useMasterRecords } from "../../../GeneralMasters/common/useMasterOptions";

const CompanyMasterTable = () => {
  // Records of the Company master (GET /masters/company)
  const products = useMasterRecords("company");

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
            scrollable={true}
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
