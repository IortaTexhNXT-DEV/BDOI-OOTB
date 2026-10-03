import React, { useEffect, useState } from "react";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import "./index.scss";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";
import { useDispatch, useSelector } from "react-redux";
import {
  getDisbursmentListMiddleware,
  getDisbursmentSearchMiddleware,
  getDisbursmentViewMiddleware,
} from "../store/pettyCashDisbursementMiddleware";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const DisbursementTable = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [globalFilter, setGlobalFilter] = useState("Pettycash Code");
  const [search, setSearch] = useState("");
  const cities = [
    { name: "Pettycash Code", code: "PettycashCode" },
    { name: "Transaction code", code: "Transactioncode" },
    { name: "Transaction Number", code: "TransactionNumber" },
  ];
  const { DisbursmentList, DisbursmentSearch } = useSelector(
    ({ pettyCashDisbursementReducers }) => {
      return {
        loading: pettyCashDisbursementReducers?.loading,
        DisbursmentList: pettyCashDisbursementReducers?.DisbursmentList,
        DisbursmentSearch: pettyCashDisbursementReducers?.DisbursmentSearch,
      };
    }
  );
  useEffect(() => {
    if (globalFilter?.length > 0) {
      if (search?.length > 0) {
        dispatch(
          getDisbursmentSearchMiddleware({
            field: globalFilter,
            value: search,
          })
        );
      }
    }
  }, [search]);

  useEffect(() => {
    dispatch(getDisbursmentListMiddleware());
  }, [dispatch]);

  const isEmpty = !DisbursmentList?.length;

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
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

      return (
        <div className="paginator__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              Row count :{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdownunique_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };

  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleView(rowData)} aria-label="View" tooltip="View" tooltipOptions={{ position: "top" }} />
      </div>
    );
  };

  const handleView = (rowData) => {
    dispatch(getDisbursmentViewMiddleware(rowData));
    navigate("/accounts/pettycash/disbursementdetailview");
  };
  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };


  return (
    <div className="disbursement__table">
      <Card className="mt-1 tabel__card__header">
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
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.value)}
              options={cities}
              optionLabel="name"
              optionValue="code"
              placeholder="Search by"
              className="sorbyfilter_container"
              dropdownIcon={<SvgDropdownicon />}
            />
          </div>
          <div className="sub__title">Disbursement history</div>
        </div>
        <div className="card">
          <DataTable
            value={search ? DisbursmentSearch : DisbursmentList}
            tableStyle={{
              color: "#2e2e2e",
            }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column
              field="PettyCashCode"
              header="Petty cash Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.PettyCashCode?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionCode"
              header="Transaction code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionCode?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionNumber"
              header="Transaction Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
              body={(rowData) => rowData.TransactionNumber?.toUpperCase()}
            ></Column>
            <Column body={(row) => formatAppDate(row.Date)}
              field="Date"
              header="Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="View"
              header="View"
              body={renderViewButton}
              headerStyle={headerStyle}
              className="fieldvalue_container_date"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default DisbursementTable;
