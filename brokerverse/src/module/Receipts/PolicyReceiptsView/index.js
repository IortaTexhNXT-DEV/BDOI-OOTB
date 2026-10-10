import React, { useEffect, useState } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgBack from "../../../assets/icons/SvgBack";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import documentTemplateService from "../../../services/documentTemplateService";
import emailService from "../../../services/emailService";
import EmailDocumentDialog from "../../../components/EmailDocumentDialog";
import { printPdf } from "../../../components/Print";
import DetailSection from "../../../components/DetailSection";
import { RecordActivityLog } from "../../../components/ActivityLog";
import { showErrorMessage } from "../../../utility/toastUtils";
import DetailHeader from "../../../components/DetailHeader";
import { statusLabel } from "../../../utils/statusSeverity";
import { formatCurrency } from "../../../utility/currencyConverter";
import ReceiptProof from "./ReceiptProof";
import ReceiptReversal from "./ReceiptReversal";
import { getReceiptsListByIdMiddleware } from "../store/receiptsMiddleware";

// the amounts of the applied policies as the header shows the receipt amount; the foreign amount has no home symbol
const amountBody = (field, foreign = false) => (row) => {
  const v = row[field];
  if (v === null || v === undefined || v === "") return "—";
  return foreign ? Number(v).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : formatCurrency(v);
};

function PolicyReceipts() {
  const { t } = useTranslation();
  const [selectedRows, setSelectedRows] = useState([]);
  // the print being prepared ("all" or "selected"), until its print dialog opens
  const [printing, setPrinting] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const { receiptDetailList, loading, currentReceiptId, receiptNumber, clientEmail, receiptStatus, header } =
    useSelector(({ receiptsTableReducers }) => {
      return {
        loading: receiptsTableReducers?.loading,
        receiptDetailList: receiptsTableReducers?.receiptDetailList || [],
        currentReceiptId: receiptsTableReducers?.currentReceiptId,
        receiptNumber:
          receiptsTableReducers?.currentReceiptDetails?.receiptNumber,
        clientEmail: receiptsTableReducers?.currentReceiptDetails?.clientEmail,
        receiptStatus: receiptsTableReducers?.currentReceiptDetails?.receiptStatus,
        header: receiptsTableReducers?.currentReceiptDetails?.header || null,
      };
    });

  const navigate = useNavigate();
  const dispatch = useDispatch();
  // a link to one receipt (My Work, a notification): ?receipt=<id>
  const [params] = useSearchParams();
  const linked = params.get("receipt");
  useEffect(() => {
    if (linked && linked !== currentReceiptId) dispatch(getReceiptsListByIdMiddleware(linked));
  }, [linked, currentReceiptId, dispatch]);
  const reload = () => dispatch(getReceiptsListByIdMiddleware(currentReceiptId));
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

  // prints the official receipt (the whole receipt or the lines chosen) from the server PDF
  const printReceipt = (lineIds, fileName, which) => {
    setPrinting(which);
    const done = () => setPrinting((current) => (current === which ? null : current));
    printPdf(documentTemplateService.receiptPdfPath(currentReceiptId, { lineIds }), { fileName, onReady: done })
      .catch((error) => showErrorMessage(error?.message || t("accounts.addReceiptEdit.failedToPrintReceipt"), t("common.error")))
      .finally(done);
  };

  const handlePrintAll = () => {
    if (!currentReceiptId) {
      showErrorMessage(t("accounts.addReceiptEdit.receiptIdMissing"));
      return;
    }
    printReceipt([], `receipt-${receiptNumber || currentReceiptId}.pdf`, "all");
  };

  const handlePrintSelected = () => {
    if (!currentReceiptId) {
      showErrorMessage(t("accounts.addReceiptEdit.receiptIdMissing"));
      return;
    }
    if (!selectedRows || selectedRows.length === 0) {
      showErrorMessage(t("accounts.addReceiptEdit.selectOneToPrint"));
      return;
    }
    const lineIds = selectedRows.map((row) => row.receiptListId || row.id).filter(Boolean);
    printReceipt(lineIds, `receipt-${receiptNumber || currentReceiptId}-selected.pdf`, "selected");
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

      {header ? (
        <DetailHeader
          className="mt-3"
          title={receiptNumber || ""}
          subtitle={header.payerName}
          status={receiptStatus ? { code: String(receiptStatus).toLowerCase(), label: receiptStatus } : null}
          meta={[
            { label: t("accounts.receiptDialogs.receiptDate"), value: header.receiptDate, type: "date" },
            { label: t("accounts.receiptDialogs.customerCode"), value: header.customerCode },
            { label: t("accounts.receiptDialogs.paymentMode"), value: header.paymentMode ? t(`paymentVoucher.detail.modes.${String(header.paymentMode).toLowerCase()}`, { defaultValue: statusLabel(header.paymentMode) }) : null },
            { label: t("accounts.receiptDialogs.reference"), value: header.referenceNo },
            { label: t("accounts.receiptDialogs.channel"), value: header.paymentChannel ? t(`accounts.receiptDialogs.channels.${header.paymentChannel}`) : null },
            { label: t("accounts.receiptDialogs.amount"), value: header.amount, type: "amount", currency: header.currencyCode || undefined },
          ]}
        />
      ) : null}

      <div className="listlable_textcontainer">
        <label className="listlable_text">{t("accounts.appliedPolicies")}</label>
      </div>

      <div className="card">
        <DataTable
          value={receiptDetailList}
          tableStyle={{
            minWidth: "50rem",
            color: "var(--text-color)",
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
            body={amountBody("netPremium")}
            align="right"
            header={t("accounts.netPremium")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="paid"
            body={amountBody("paid")}
            align="right"
            header={t("accounts.paid")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="unPaid"
            body={amountBody("unPaid")}
            align="right"
            header={t("accounts.unpaid")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="discounts"
            body={amountBody("discounts")}
            align="right"
            header={t("accounts.discounts")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="dst"
            body={amountBody("dst")}
            align="right"
            header="DST"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="lgt"
            body={amountBody("lgt")}
            align="right"
            header="LGT"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>

          <Column
            field="vat"
            body={amountBody("vat")}
            align="right"
            header="VAT"
            headerStyle={headerStyle}
            className="fieldvalue_containers"
          ></Column>
          <Column
            field="ewt"
            body={amountBody("ewt")}
            align="right"
            header="EWT"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="fcAmount"
            body={amountBody("fcAmount", true)}
            align="right"
            header={t("accounts.fcAmount")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="lcAmount"
            body={amountBody("lcAmount")}
            align="right"
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
          label={t("emailDocument.emailReceipt")}
          icon="pi pi-envelope"
          outlined
          onClick={() => setEmailOpen(true)}
          disabled={!currentReceiptId || loading || receiptStatus === "Cancelled"}
          style={{ minWidth: "150px", padding: "10px 20px" }}
        />
        <Button
          label={t("accounts.addReceiptEdit.printAll")}
          onClick={handlePrintAll}
          disabled={!currentReceiptId || !!printing || loading}
          loading={printing === "all"}
          outlined
          style={{
            minWidth: "150px",
            padding: "10px 20px",
          }}
        />
        <Button
          label={t("accounts.addReceiptEdit.printSelected")}
          onClick={handlePrintSelected}
          disabled={
            !currentReceiptId ||
            !selectedRows ||
            selectedRows.length === 0 ||
            !!printing ||
            loading
          }
          loading={printing === "selected"}
          style={{
            minWidth: "160px",
            padding: "10px 20px",
          }}
        />
      </div>
      {currentReceiptId && header ? (
        <ReceiptProof receiptId={currentReceiptId} proof={header.proof} collectedBy={header.collectedBy} cancelled={receiptStatus === "Cancelled"} />
      ) : null}
      {currentReceiptId && header ? (
        <ReceiptReversal receiptId={currentReceiptId} receiptNumber={receiptNumber || ""} reversal={header.reversal} cancelled={receiptStatus === "Cancelled"} onChanged={reload} />
      ) : null}
      {currentReceiptId ? (
        <DetailSection title={t("accounts.receiptDialogs.activity")} className="mt-4">
          <RecordActivityLog entity="receipt" recordId={currentReceiptId} />
        </DetailSection>
      ) : null}
      <EmailDocumentDialog
        visible={emailOpen}
        onHide={() => setEmailOpen(false)}
        title={t("emailDocument.emailReceiptTitle", { number: receiptNumber || "" })}
        defaultTo={clientEmail || ""}
        fileName={`receipt-${receiptNumber || currentReceiptId}.pdf`}
        send={(body) => emailService.emailReceipt(currentReceiptId, body)}
      />
    </div>
  );
}

export default PolicyReceipts;
