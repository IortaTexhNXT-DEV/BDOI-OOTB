import React, { useState } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgBack from "../../../assets/icons/SvgBack";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import documentTemplateService from "../../../services/documentTemplateService";
import {
  showSuccessMessage,
  showErrorMessage,
} from "../../../utility/toastUtils";

function PolicyReceipts() {
  const { t } = useTranslation();
  const [selectedRows, setSelectedRows] = useState([]);
  const [printLoading, setPrintLoading] = useState(false);

  const { receiptDetailList, loading, currentReceiptId, receiptNumber } =
    useSelector(({ receiptsTableReducers }) => {
      return {
        loading: receiptsTableReducers?.loading,
        receiptDetailList: receiptsTableReducers?.receiptDetailList || [],
        currentReceiptId: receiptsTableReducers?.currentReceiptId,
        receiptNumber:
          receiptsTableReducers?.currentReceiptDetails?.receiptNumber,
      };
    });

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

  const handlePrintAll = async () => {
    if (!currentReceiptId) {
      showErrorMessage(t("accounts.addReceiptEdit.receiptIdMissing"));
      return;
    }

    try {
      setPrintLoading(true);
      showSuccessMessage(
        t("accounts.addReceiptEdit.generatingPdf"),
        t("common.success")
      );

      const result = await documentTemplateService.getReceiptPdf(
        currentReceiptId,
        {
          fileName: `receipt-${receiptNumber || currentReceiptId}.pdf`,
        }
      );

      if (!result.success) {
        throw new Error(
          result.error || t("accounts.addReceiptEdit.failedToPrintReceipt")
        );
      }

      showSuccessMessage(
        t("accounts.addReceiptEdit.pdfDownloadedSuccess"),
        t("common.success")
      );
    } catch (error) {
      showErrorMessage(
        error?.message || t("accounts.addReceiptEdit.failedToPrintReceipt"),
        t("common.error")
      );
    } finally {
      setPrintLoading(false);
    }
  };

  const handlePrintSelected = async () => {
    if (!currentReceiptId) {
      showErrorMessage(t("accounts.addReceiptEdit.receiptIdMissing"));
      return;
    }

    if (!selectedRows || selectedRows.length === 0) {
      showErrorMessage(t("accounts.addReceiptEdit.selectOneToPrint"));
      return;
    }

    try {
      setPrintLoading(true);
      showSuccessMessage(
        t("accounts.addReceiptEdit.generatingPdf"),
        t("common.success")
      );

      const lineIds = selectedRows
        .map((row) => row.receiptListId || row.id)
        .filter(Boolean);

      const result = await documentTemplateService.getReceiptPdf(
        currentReceiptId,
        {
          lineIds,
          fileName: `receipt-${receiptNumber || currentReceiptId}-selected.pdf`,
        }
      );

      if (!result.success) {
        throw new Error(
          result.error || t("accounts.addReceiptEdit.failedToPrintReceipt")
        );
      }

      showSuccessMessage(
        t("accounts.addReceiptEdit.pdfDownloadedSuccess"),
        t("common.success")
      );
    } catch (error) {
      showErrorMessage(
        error?.message || t("accounts.addReceiptEdit.failedToPrintReceipt"),
        t("common.error")
      );
    } finally {
      setPrintLoading(false);
    }
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
          selection={selectedRows}
          onSelectionChange={(e) =>
            setSelectedRows(Array.isArray(e.value) ? e.value : [])
          }
          selectionMode="checkbox"
          dataKey="id"
        >
          <Column
            selectionMode="multiple"
            exportable={false}
            style={{ textAlign: "center", width: "3rem" }}
            headerStyle={{
              ...headerStyle,
              display: "flex",
              justifyContent: "center",
            }}
          />
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

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          marginTop: "20px",
          flexWrap: "wrap",
        }}
      >
        <Button
          label={t("accounts.addReceiptEdit.printAll")}
          onClick={handlePrintAll}
          disabled={!currentReceiptId || printLoading || loading}
          loading={printLoading}
          style={{
            minWidth: "150px",
            padding: "10px 20px",
            backgroundColor: "#28a745",
            borderColor: "#28a745",
          }}
        />
        <Button
          label={t("accounts.addReceiptEdit.printSelected")}
          onClick={handlePrintSelected}
          disabled={
            !currentReceiptId ||
            !selectedRows ||
            selectedRows.length === 0 ||
            printLoading ||
            loading
          }
          loading={printLoading}
          style={{
            minWidth: "160px",
            padding: "10px 20px",
            backgroundColor: "#198754",
            borderColor: "#198754",
          }}
        />
      </div>
    </div>
  );
}

export default PolicyReceipts;
