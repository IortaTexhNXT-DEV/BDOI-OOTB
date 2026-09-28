import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgFilters from "../../../../assets/icons/SvgFilter";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import "./index.scss";
import { TieredMenu } from "primereact/tieredmenu";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";
import { useDispatch, useSelector } from "react-redux";
import {
  getRequestListMiddleware,
  getRequestSearchMiddleware,
  geteditrequestMiddleware,
} from "../store/pettyCashRequestMiddleware";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import SvgEdit from "../../../../assets/icons/SvgEdits";

const RequestTable = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("ReceiptNo");

  const { RequestList, loading, RequestSearch } = useSelector(
    ({ pettyCashRequestReducer }) => {
      return {
        loading: pettyCashRequestReducer?.loading,
        RequestList: pettyCashRequestReducer?.RequestList,
        RequestSearch: pettyCashRequestReducer?.RequestSearch,
      };
    }
  );

  useEffect(() => {
    dispatch(getRequestListMiddleware());
  }, [dispatch]);
  const searchs = [
    { name: t("pettyCash.receiptNo"), code: "ReceiptNo" },
    { name: t("pettyCash.requestNumber"), code: "RequestNumber" },
    { name: t("pettyCash.requesterName"), code: "RequesterName" },
    { name: t("pettyCash.branchCode"), code: "Branchcode" },
    { name: t("pettyCash.departmentCode"), code: "Departmentcode" },
    { name: t("pettyCash.totalAmount"), code: "TotalAmount" },
    { name: t("pettyCash.date"), code: "Date" },
  ];

  const isEmpty = !RequestList?.length;

  const handleViewer = (columnData) => {
    console.log("columnData", columnData);
    // dispatch(getAccountDetailsView(columnData));
    dispatch(geteditrequestMiddleware(columnData));
    navigate(`/accounts/pettycash/editrequestform/view/${columnData?.id}`);
  };
  const handleEdit = (rowData) => {
    console.log(rowData?.id, "rowData");
    // dispatch(getPatchAccountDetailsView(columnData));
    dispatch(geteditrequestMiddleware(rowData));
    navigate(`/accounts/pettycash/editrequestform/edit/${rowData?.id}`);
  };

  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );
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
        <div className="paginatoroverall__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              {t("pettyCash.rowCount")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdowninner_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };

  // const renderViewButton = (rowData) => {
  //   return (
  //     <div className="center-content">
  //       <Button
  //         icon={<SvgEyeIcon />}
  //         className="eye__btn"
  //         onClick={() => handleView(rowData)}
  //       />
  //     </div>
  //   );
  // };

  const menu = useRef(null);

  const handleView = (rowData) => {
    console.log("View clicked:", rowData);
    navigate("/accounts/pettycash/PettyCashCodeDetails");
  };
  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    paddingLeft: "0.5rem",
    color: "#000",
    border: "none",
  };
  const headeractionStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    paddingLeft: "0.5rem",
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
  };

  useEffect(() => {
    if (globalFilter?.length > 0) {
      if (search?.length > 0) {
        dispatch(
          getRequestSearchMiddleware({
            field: globalFilter,
            value: search,
          })
        );
      }
    }
  }, [search]);

  return (
    <div className="Request__table">
      <Card className="mt-1">
        <div className="header_search_container grid">
          <div class="col-12 md:col-6 lg:col-10">
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder="Search by Petty cash Code"
                className="searchinput_left"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>
          <div class="col-12 md:col-6 lg:col-2">
            <Dropdown
              value={search}
              onChange={(e) => setGlobalFilter(e.value)}
              options={searchs}
              optionLabel="name"
              optionValue="code"
              placeholder="Search by"
              className="sorbyfilter_container"
              dropdownIcon={<SvgDropdownicon />}
            />
          </div>
          <div className="sub__title">Request history</div>
        </div>
        <div className="card">
          <DataTable
            value={search ? RequestSearch : RequestList}
            tableStyle={{
              minWidth: "50rem",
              color: "#2e2e2e",
            }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            {/* <Column
              field="PettycashCode"
              header="Petty cash Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              
            ></Column> */}

            <Column
              field="RequesterName"
              header="Requester Name"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
              body={(rowData) => rowData.RequesterName?.toUpperCase()}
            ></Column>
            <Column
              field="RequestDate"
              header="Requester Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.RequestDate?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionNumber"
              header="Transaction Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionNumber?.toUpperCase()}
            ></Column>
            <Column
              field="Date"
              header="Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="TotalAmount"
              header="Total Amount"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              body={(columnData) => (
                <div className="action_icons">
                  <SvgIconeye onClick={() => handleViewer(columnData)} />
                  <SvgEdit onClick={() => handleEdit(columnData)} />
                </div>
              )}
              header="Action"
              headerStyle={headeractionStyle}
              className="fieldvalue_container"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default RequestTable;
