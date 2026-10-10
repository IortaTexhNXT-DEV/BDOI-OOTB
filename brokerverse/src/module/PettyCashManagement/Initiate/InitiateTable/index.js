import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import StatusChip from "../../../../components/StatusChip";
import { openConfirm } from "../../../../components/ConfirmDialog";
import { isInitiator } from "../../../../components/ApprovalActions";
import pettyCashService from "../../../../services/pettyCashService";
import { useDispatch, useSelector } from "react-redux";
import {
  getInitiateDetailsMiddleware,
  getInitiateListMiddleware,
  getInitiateListSearchMiddleware,
} from "../store/pettyCashInitiateMiddleware";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";

const InitiateTable = () => {
  const { formatCurrency } = useFormatCurrency();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("Pettycashcode");

  const { InitiateList, InitiateListSearch } = useSelector(
    ({ pettyCashInitiateReducer }) => {
      return {
        loading: pettyCashInitiateReducer?.loading,
        InitiateList: pettyCashInitiateReducer?.InitiateList,
        InitiateListSearch: pettyCashInitiateReducer?.InitiateListSearch,
      };
    }
  );

  const searchs = [
    { name: t("pettyCash.pettyCashCode"), code: "Pettycashcode" },
    { name: t("pettyCash.transactionNumber"), code: "TransactionNumber" },
    { name: t("pettyCash.branchCode"), code: "Branchcode" },
    { name: t("pettyCash.departmentCode"), code: "Departmentcode" },
  ];

  useEffect(() => {
    dispatch(getInitiateListMiddleware());
  }, [dispatch]);

  const isEmpty = !InitiateList?.length;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("pettyCash.noDataEntered")}</div>
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

  // a fund waiting for approval is established or rejected by a user other than the one who initiated it
  const decide = async (rowData, action) => {
    const approve = action === "approve";
    const answer = await openConfirm({
      title: t(approve ? "pettyCash.fundApproval.approveTitle" : "pettyCash.fundApproval.rejectTitle"),
      severity: approve ? "neutral" : "danger",
      facts: [
        { label: t("pettyCash.pettyCashCode"), value: rowData.Pettycashcode },
        { label: t("pettyCash.pettyCashDescription"), value: rowData.PettyCashdescription },
        { label: t("pettyCash.branchCode"), value: rowData.Branchcode },
        { label: t("pettyCash.pettyCashSize"), value: rowData.Pettycashsize, type: "amount", emphasis: true },
      ],
      input: approve ? undefined : { type: "textarea", label: t("pettyCash.fundApproval.rejectReason"), required: true, minLength: 3, maxLength: 500 },
      confirmLabel: t(approve ? "pettyCash.fundApproval.approve" : "pettyCash.fundApproval.reject"),
      onConfirm: (reason) => pettyCashService.decideFund(rowData.id, action, reason),
    });
    if (answer === false || answer === null || answer === undefined) return;
    dispatch(getInitiateListMiddleware());
  };

  const renderViewButton = (rowData) => {
    const own = isInitiator({ id: rowData.createdBy });
    return (
      <div className="center-content">
        {rowData.status === "pending" && (
          <>
            <Button icon="pi pi-check" text size="small" disabled={own} onClick={() => decide(rowData, "approve")}
              aria-label={t("pettyCash.fundApproval.approve")} tooltip={own ? t("makerChecker.ownRecord") : t("pettyCash.fundApproval.approve")}
              tooltipOptions={{ position: "top", showOnDisabled: true }} />
            <Button icon="pi pi-times" text size="small" severity="danger" disabled={own} onClick={() => decide(rowData, "reject")}
              aria-label={t("pettyCash.fundApproval.reject")} tooltip={own ? t("makerChecker.ownRecord") : t("pettyCash.fundApproval.reject")}
              tooltipOptions={{ position: "top", showOnDisabled: true }} />
          </>
        )}
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleView(rowData)} aria-label={t("pettyCash.view")} tooltip={t("pettyCash.view")} tooltipOptions={{ position: "top" }} />
      </div>
    );
  };

  const handleView = (rowData) => {
    dispatch(getInitiateDetailsMiddleware(rowData));
    navigate("/accounts/pettycash/PettyCashCodeDetails");
  };
  const headerStyle = {
    // width: "12rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    paddingLeft: 6,
    color: "#000",
    border: "none",
  };
  const ViewheaderStyle = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: " none",
    display: "flex",
  };
  useEffect(() => {
    if (globalFilter?.length > 0) {
      if (search?.length > 0) {
        dispatch(
          getInitiateListSearchMiddleware({
            field: globalFilter,
            value: search,
          })
        );
      }
    }
  }, [search]);

  return (
    <div className="initiate__table">
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
          <div className="sub__title">Petty Cash Code history</div>
        </div>
        <div className="card">
          <DataTable
            value={search ? InitiateListSearch : InitiateList}
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
              field="Pettycashcode"
              header="Petty cash code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Pettycashcode?.toUpperCase()}
            ></Column>
            <Column
              field="Pettycashsize"
              header="Petty Cash Size"
              headerStyle={headerStyle}
              className="fieldvalue_container bv-nowrap"
              alignHeader="right"
              bodyStyle={{ textAlign: "right" }}
              body={(rowData) => formatCurrency(rowData.Pettycashsize)}
              sortable
            ></Column>
            <Column
              field="TransactionNumber"
              header="Transaction Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionNumber?.toUpperCase()}
              sortable
            ></Column>
            <Column
              field="MaxLimit"
              header="Max Limit"
              headerStyle={headerStyle}
              className="fieldvalue_container bv-nowrap"
              alignHeader="right"
              bodyStyle={{ textAlign: "right" }}
              body={(rowData) => formatCurrency(rowData.MaxLimit)}
            ></Column>
            <Column
              field="Branchcode"
              header="Branch code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Branchcode?.toUpperCase()}
            ></Column>
            <Column
              field="Departmentcode"
              header="Department code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Departmentcode?.toUpperCase()}
            ></Column>
            <Column body={(row) => formatAppDate(row.TransactionDate)}
              field="TransactionDate"
              header="Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="status"
              header={t("pettyCash.status")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => <StatusChip code={rowData.status} label={t(`pettyCash.fundStatus.${rowData.status}`, { defaultValue: rowData.status })} />}
            ></Column>
            <Column
              body={renderViewButton}
              header={t("pettyCash.actions")}
              headerStyle={ViewheaderStyle}
              className="fieldvalue_container centered"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default InitiateTable;
