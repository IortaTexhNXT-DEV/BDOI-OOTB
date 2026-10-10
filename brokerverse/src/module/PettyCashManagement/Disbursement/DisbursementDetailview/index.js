import React from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import { useSelector } from "react-redux";
import DetailHeader from "../../../../components/DetailHeader";
import DetailSection from "../../../../components/DetailSection";
import KeyValueGrid, { formatValue } from "../../../../components/KeyValueGrid";
import { statusLabel } from "../../../../utils/statusSeverity";

/** A posted petty cash disbursement, read only: its facts, the accounts it posted to and the request line it paid. */
const DisbursementDetailview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { view, lines } = useSelector(({ pettyCashDisbursementReducers }) => ({
    view: pettyCashDisbursementReducers?.getViewDisbursment || {},
    lines: pettyCashDisbursementReducers?.AddDisbursmentTable || [],
  }));

  const items = [
    { label: t("pettyCash.pettyCashLabel"), command: () => navigate("/accounts/pettycash/disbursement") },
    { label: t("pettyCash.disbursementDetailView"), to: "/accounts/pettycash/disbursementdetailview" },
  ];
  const home = { label: t("pettyCash.accounts") };
  const line = lines[0] || {};
  const amount = (v) => formatValue(v === "" ? null : v, { type: "amount" });

  return (
    <div className="add__disbursement__view__container">
      <div className="grid m-0">
        <div className="col-12">
          <button type="button" className="pettycash__title" onClick={() => navigate("/accounts/pettycash/disbursement")}>
            <SvgBackArrow />
            {t("pettyCash.disbursementDetailView")}
          </button>
          <div className="mt-3">
            <BreadCrumb model={items} home={home} className="breadCrums" separatorIcon={<SvgDot color="currentColor" />} />
          </div>
        </div>
      </div>

      <DetailHeader
        title={view.TransactionNumber || ""}
        subtitle={view.Remarks}
        status={view.status ? { code: String(view.status).toLowerCase(), label: statusLabel(view.status) } : null}
        meta={[
          { label: t("pettyCash.date"), value: view.Date },
          { label: t("pettyCash.pettyCashCode"), value: view.PettyCashCode },
          { label: t("pettyCash.requestNumber"), value: line.RequestNumber },
          { label: t("pettyCash.view.netAmount"), value: line.NetAmount, type: "amount" },
        ]}
      />

      <DetailSection title={t("pettyCash.view.posting")}>
        <KeyValueGrid columns={4} items={[
          { label: t("pettyCash.transactionCode"), value: view.TransactionCode },
          { label: t("pettyCash.view.criteria"), value: view.Criteria },
          { label: t("pettyCash.view.expenseAccount"), value: line.ExpenseCode },
          { label: t("pettyCash.vatMainAccount"), value: view.VATMainAccount },
          { label: t("pettyCash.whtMainAccount"), value: view.WHTMainAccount },
        ]} />
      </DetailSection>

      <DetailSection title={t("pettyCash.view.lines")} flush>
        <DataTable value={lines} dataKey="id" size="small" emptyMessage={t("pettyCash.view.noLines")}>
          <Column field="RequestNumber" header={t("pettyCash.requestNumber")} />
          <Column field="ExpenseCode" header={t("pettyCash.view.expenseAccount")} />
          <Column field="Remarks" header={t("pettyCash.remarks")} />
          <Column header={t("pettyCash.amount")} body={(r) => amount(r.Amount)} bodyClassName="bv-num" headerClassName="bv-num" />
          <Column header={t("pettyCash.view.vat")} body={(r) => amount(r.VAT)} bodyClassName="bv-num" headerClassName="bv-num" />
          <Column header={t("pettyCash.view.wht")} body={(r) => amount(r.WHT)} bodyClassName="bv-num" headerClassName="bv-num" />
          <Column header={t("pettyCash.view.netAmount")} body={(r) => amount(r.NetAmount)} bodyClassName="bv-num" headerClassName="bv-num" />
        </DataTable>
      </DetailSection>
    </div>
  );
};

export default DisbursementDetailview;
