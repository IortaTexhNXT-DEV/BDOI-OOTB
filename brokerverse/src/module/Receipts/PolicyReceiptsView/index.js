import React, { useState, useEffect } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import NavBar from "../../../components/NavBar";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import SvgBack from "../../../assets/icons/SvgBack";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

function PolicyReceipts() {
  const { t } = useTranslation();
  const { receiptDetailList, loading, total, paymentDetails } = useSelector(
    ({ receiptsTableReducers }) => {
      return {
        loading: receiptsTableReducers?.loading,
        receiptDetailList: receiptsTableReducers?.receiptDetailList,
        total: receiptsTableReducers,
        paymentDetails: receiptsTableReducers?.paymentDetails,
      };
    }
  );

  const navigate = useNavigate();
  const items = [
    {
      label: t("sidebar.Receipts"),
      command: () => navigate("/accounts/receipts"),
    },
    {
      label: t("accounts.receiptDetailView"),
    },
  ];

  const home = { label: t("sidebar.Accounts") };

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: "none",
    textalign: "center",
  };

  return (
    <div className="overall__policy_receipts_view__container">
      <span onClick={() => navigate(-1)}>
        <SvgBack />
      </span>

      <label className="label_header">{t("accounts.receiptDetailView")}</label>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <div className="listlable_textcontainer">
        <label className="listlable_text">{t("accounts.receiptsList")}</label>
      </div>

      <div className="card">
        <DataTable
          value={receiptDetailList}
          tableStyle={{
            minWidth: "50rem",
            color: "#2e2e2e",
            maxHeight: "50vh",
            overflowy: "auto",
          }}
          className="datatable_container"
          scrollable={true}
          scrollHeight="40vh"
        >
          <Column
            field="policies"
            header={t("accounts.policies")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="netPremium"
            header={t("accounts.netPremium")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="paid"
            header={t("accounts.paid")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="unPaid"
            header={t("accounts.unpaid")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="discounts"
            header={t("accounts.discounts")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="dst"
            header="DST"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="lgt"
            header="LGT"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>

          <Column
            field="vat"
            header="VAT"
            headerStyle={headerStyle}
            className="fieldvalue_containers"
          ></Column>
          <Column
            field="ewt"
            header="EWT"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="fcAmount"
            header={t("accounts.fcAmount")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="lcAmount"
            header={t("accounts.lcAmount")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
        </DataTable>
      </div>
    </div>
  );
}

export default PolicyReceipts;
