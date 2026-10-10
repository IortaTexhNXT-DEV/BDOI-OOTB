import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SvgDot from "../../../assets/icons/SvgDot";
import DropDowns from "../../../components/DropDowns";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate, useParams } from "react-router-dom";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useDispatch, useSelector } from "react-redux";
import { getDisbursementDetailsMiddleware } from "../store/paymentVocherMiddleware";
import CustomToast from "../../../components/Toast";
import disbursementService from "../../../services/disbursementService";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import NextStep from "../../../components/NextStep";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import { RecordActivityLog } from "../../../components/ActivityLog";
import { printPdf } from "../../../components/Print";
import { statusLabel } from "../../../utils/statusSeverity";

function Detailview() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { id } = useParams();
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const [selectedProducts, setSelectedProducts] = useState(null);
  const [actionToast, setActionToast] = useState(null);
  const [activityKey, setActivityKey] = useState(0);
  const [coInsuranceMode, setCoInsuranceMode] = useState(true);
  const [selectedParticipatingInsurer, setSelectedParticipatingInsurer] =
    useState(null);
  const coInsuranceInitializedRef = useRef(null);

  useEffect(() => {
    dispatch(getDisbursementDetailsMiddleware(id));
  }, [id, dispatch]);

  const { disbursementDetails, loading } = useSelector(
    ({ paymentVoucherReducers }) => {
      return {
        loading: paymentVoucherReducers?.loading,
        disbursementDetails: paymentVoucherReducers?.disbursementDetails,
      };
    }
  );

  const Navigate = useNavigate();

  const policyBeneficiary = disbursementDetails?.policyBeneficiary;
  const isInsurerPayee =
    String(disbursementDetails?.payeeType || "").toLowerCase() === "insurer";
  const isRemittance = String(disbursementDetails?.transactionCode || "")
    .toUpperCase()
    .includes("REMT");
  const hasPolicyNumber = Boolean(
    disbursementDetails?.policyNumber || policyBeneficiary?.policyNumber
  );
  const showPolicyBeneficiary =
    isInsurerPayee && isRemittance && hasPolicyNumber && policyBeneficiary;
  const showAllocation = isInsurerPayee && policyBeneficiary;

  useEffect(() => {
    if (!policyBeneficiary || !disbursementDetails?.disbursementId) return;
    if (
      coInsuranceInitializedRef.current === disbursementDetails.disbursementId
    ) {
      return;
    }
    coInsuranceInitializedRef.current = disbursementDetails.disbursementId;
    const withCo =
      policyBeneficiary.isCoInsurance &&
      (policyBeneficiary.participants?.length || 0) > 1;
    setCoInsuranceMode(withCo);
    const source = withCo
      ? policyBeneficiary.participants
      : policyBeneficiary.leadOnlyParticipants;
    const match =
      source?.find(
        (p) =>
          p.insurerName?.toLowerCase() ===
          (policyBeneficiary.selectedInsurerName || "").toLowerCase()
      ) ||
      source?.[0] ||
      null;
    setSelectedParticipatingInsurer(
      match
        ? {
            name: match.optionLabel,
            code: match.insurerName,
            ...match,
          }
        : null
    );
  }, [policyBeneficiary, disbursementDetails?.disbursementId]);

  const activeParticipants = useMemo(() => {
    if (!policyBeneficiary) return [];
    return coInsuranceMode
      ? policyBeneficiary.participants || []
      : policyBeneficiary.leadOnlyParticipants || [];
  }, [policyBeneficiary, coInsuranceMode]);

  const participatingInsurerOptions = useMemo(() => {
    return activeParticipants.map((p) => ({
      name: p.optionLabel,
      code: p.insurerName,
      ...p,
    }));
  }, [activeParticipants]);

  const allocationAggregates = useMemo(() => {
    const share = activeParticipants.reduce(
      (sum, row) => sum + (Number(row.sharePercentage) || 0),
      0
    );
    const payable = activeParticipants.reduce(
      (sum, row) => sum + (parseFloat(row.payableAmount) || 0),
      0
    );
    return {
      sharePercentage: share,
      payableAmount: payable.toFixed(2),
    };
  }, [activeParticipants]);

  const handleCoInsuranceToggle = (withCoInsurance) => {
    if (
      withCoInsurance &&
      (policyBeneficiary?.participants?.length || 0) <= 1
    ) {
      return;
    }
    setCoInsuranceMode(withCoInsurance);
    const source = withCoInsurance
      ? policyBeneficiary?.participants || []
      : policyBeneficiary?.leadOnlyParticipants || [];
    const preferredName =
      selectedParticipatingInsurer?.code ||
      policyBeneficiary?.selectedInsurerName ||
      "";
    const match =
      (withCoInsurance &&
        source.find(
          (p) => p.insurerName?.toLowerCase() === preferredName.toLowerCase()
        )) ||
      source[0] ||
      null;
    setSelectedParticipatingInsurer(
      match
        ? {
            name: match.optionLabel,
            code: match.insurerName,
            ...match,
          }
        : null
    );
  };

  useEffect(() => {
    if (actionToast != null) {
      toastRef.current?.showToast();
    }
  }, [actionToast]);

  const items = [
    {
      label: t("paymentVoucher.title"),
      command: () => Navigate("/accounts/paymentvoucher/"),
    },
    {
      label: t("paymentVoucher.disbursementDetails"),
      to: "/accounts/paymentvoucher/detailview",
    },
  ];
  const statusBodyTemplate = (rowData) => <StatusChip label={rowData.status} />;

  const remittanceStatusBody = (status) => (
    <span
      className={`allocation-status-pill ${
        status !== "Pending" ? "approved" : "pending"
      }`}
    >
      {status}
    </span>
  );

  const roleBody = (role) =>
    role === "Lead Insurer" ? (
      <span className="allocation-role-pill lead">{role}</span>
    ) : (
      <span className="allocation-role-text">{role}</span>
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
        <React.Fragment>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("paymentVoucher.rowCount")}{" "}
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
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
    paddingLeft: 0,
  };
  const home = { label: t("paymentVoucher.accounts") };
  const getStatusClassName = (status) => {
    return status === "Printed" ? "disabled-row" : "";
  };

  const processedChequeBookData = useMemo(() => {
    // Every cheque of the voucher (on its invoice-list lines or on the voucher itself), whatever its status
    const cheques =
      disbursementDetails?.cheques ||
      (disbursementDetails?.invoiceList || []).flatMap((invoice) => invoice.checkbooks || []);
    return cheques.map((checkbook) => ({
      id: checkbook.checkbookId,
      VoucherNumber: checkbook.customerCode || "",
      TransactionNumber: checkbook.customerName || "",
      CustomerCode: checkbook.mainAccount || "",
      VoucheDate: checkbook.instrumentBookId || "",
      Amount: checkbook.instrumentNo || "",
      InstrumentDate: checkbook.instrumentDate || "",
      TotalAmount: checkbook.totaleAmount || "",
      status: checkbook.status || "",
      action: checkbook.checkbookId,
      rawData: checkbook,
    }));
  }, [disbursementDetails]);

  // What the voucher pays: commission lines of a referrer payout, else its invoice-list (payable) lines
  const paymentLines = useMemo(() => {
    if (disbursementDetails?.commissionLines?.length) {
      return disbursementDetails.commissionLines.map((l) => ({
        id: l.id,
        reference: l.policyNo,
        description: [l.productInsurer, l.cycle].filter(Boolean).join(" · "),
        gross: l.comsub,
        wht: l.wht,
        net: l.net,
        status: l.status,
      }));
    }
    return (disbursementDetails?.invoiceList || [])
      .filter((i) => i.disbursementId === disbursementDetails?.disbursementId)
      .map((i) => ({
        id: i.invoiceListId || i.id,
        reference: i.invoiceNumber,
        description: i.policyNumber || i.customerCode || "",
        gross: i.payables,
        wht: i.wht,
        net: i.totalAmount,
        status: i.status,
      }));
  }, [disbursementDetails]);
  const paymentModeText = (mode) => (mode ? t(`paymentVoucher.detail.modes.${String(mode).toLowerCase()}`, { defaultValue: statusLabel(mode) }) : null);
  // gross less withholding tax that the net does not explain (bank charges, offsets)
  const otherDeductions = useMemo(() => {
    const d = disbursementDetails || {};
    const gross = Number(d.grossAmount);
    const net = Number(d.amount);
    if (!Number.isFinite(gross) || !Number.isFinite(net) || !gross) return 0;
    const rest = Math.round((gross - Number(d.whtAmount || 0) - net) * 100) / 100;
    return rest > 0 ? rest : 0;
  }, [disbursementDetails]);
  const money = (v) => (v === null || v === undefined || v === "" ? "" : formatCurrency(v));

  const hasPendingItems = useMemo(() => {
    return processedChequeBookData.some((item) => item.status === "Pending");
  }, [processedChequeBookData]);
  const hasApprovedItems = useMemo(() => {
    return processedChequeBookData.some((item) => item.status === "Approved");
  }, [processedChequeBookData]);
  const actionable = (row) => row?.status === "Pending" || row?.status === "Approved";

  const chequeFacts = (row) => [
    { label: t("paymentVoucher.voucherNumber", "Voucher Number"), value: disbursementDetails?.voucherNumber },
    { label: t("paymentVoucher.payeeName", "Payee"), value: disbursementDetails?.payeeName },
    { label: t("paymentVoucher.instrumentNo"), value: row.Amount },
    { label: t("paymentVoucher.instrumentDate"), value: row.InstrumentDate, type: "date" },
    { label: t("paymentVoucher.totalAmount"), value: row.TotalAmount, type: "amount", emphasis: true },
  ];

  // Approved cheque -> Printed: the voucher becomes Paid and its print (PDF) is printed. The print starts inside the
  // confirmation click, so that a browser that prints the PDF in a tab of its own opens it there.
  // the voucher itself, printable in any status (a paid voucher is reprinted from here)
  const printVoucher = () => printPdf(async () => {
    const printed = await disbursementService.printDisbursement(id);
    if (!printed.success) throw new Error(printed.error);
    const response = await fetch(printed.data.url);
    if (!response.ok) throw new Error(t("print.failed"));
    return response.blob();
  }, { fileName: `${disbursementDetails?.voucherNumber || id}.pdf` }).catch((e) => toastRef.current?.showToast("error", t("common.error"), e.message));

  const handlePrint = async () => {
    const row = selectedProducts;
    const checkbookId = row?.rawData?.checkbookId;
    if (!checkbookId || row.status !== "Approved") return;
    const confirmed = await openConfirm({
      title: t("paymentVoucher.confirm.printTitle", { number: row.Amount }),
      severity: "warning",
      message: t("paymentVoucher.confirm.printMessage"),
      facts: chequeFacts(row),
      confirmLabel: t("paymentVoucher.confirm.print"),
      onConfirm: () => printPdf(async () => {
        const result = await disbursementService.updateCheckbook(checkbookId, { status: "Printed" });
        if (!result.success) throw new Error(result.error || t("paymentVoucher.failedToUpdateDisbursement"));
        const printed = await disbursementService.printDisbursement(id);
        if (!printed.success) throw new Error(printed.error);
        const response = await fetch(printed.data.url);
        if (!response.ok) throw new Error(t("print.failed"));
        return response.blob();
      }, { fileName: `${disbursementDetails?.voucherNumber || id}.pdf` }),
    });
    if (!confirmed) return;
    setActionToast("Printed");
    setSelectedProducts(null);
    setActivityKey((k) => k + 1);
    dispatch(getDisbursementDetailsMiddleware(id));
  };

  const handleApprove = async () => {
    if (!selectedProducts || !selectedProducts.rawData) {
      toastRef.current?.showToast(
        "error",
        t("common.error"),
        t("paymentVoucher.noCheckbookSelected")
      );
      return;
    }

    const checkbookData = selectedProducts.rawData;
    const checkbookId = checkbookData.checkbookId;

    if (!checkbookId) {
      toastRef.current?.showToast(
        "error",
        t("common.error"),
        t("paymentVoucher.invalidCheckbookData")
      );
      return;
    }

    if (checkbookData.status !== "Pending") {
      toastRef.current?.showToast(
        "error",
        t("common.error"),
        t("paymentVoucher.onlyPendingCanBeApproved")
      );
      return;
    }

    const confirmed = await openConfirm({
      title: t("paymentVoucher.confirm.approveTitle", { number: selectedProducts.Amount }),
      message: t("paymentVoucher.confirm.approveMessage"),
      facts: chequeFacts(selectedProducts),
      confirmLabel: t("paymentVoucher.confirm.approve"),
    });
    if (!confirmed) return;

    try {
      const result = await disbursementService.updateCheckbook(checkbookId, {
        status: "Approved",
      });

      if (result.success) {
        setActionToast("approved");
        setSelectedProducts(null);
        setActivityKey((k) => k + 1);
        dispatch(getDisbursementDetailsMiddleware(id));
      } else {
        toastRef.current?.showToast(
          "error",
          t("common.error"),
          result.error || t("paymentVoucher.failedToApproveCheckbook")
        );
      }
    } catch (error) {
      toastRef.current?.showToast(
        "error",
        t("common.error"),
        error.message || t("paymentVoucher.failedToApproveCheckbook")
      );
    }
  };

  const selectedInsurerName =
    selectedParticipatingInsurer?.code ||
    selectedParticipatingInsurer?.insurerName ||
    "";

  return (
    <div className="overall__detailview__container">
      <CustomToast
        ref={toastRef}
        message={
          actionToast === "approved"
            ? t("paymentVoucher.chequeBookApprovedSuccess")
            : `${actionToast} successfully`
        }
      />
      <div className="flex align-items-center gap-2">
        <button type="button" className="p-link" onClick={() => Navigate(-1)} aria-label={t("common.back")}>
          <SvgBackicon />
        </button>

        <label className="label_header">
          {t("paymentVoucher.disbursementDetails")}
        </label>
        {loading && (
          <span style={{ marginLeft: "10px", color: "#666" }}>
            {t("common.loading")}
          </span>
        )}
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />
      {/* a voucher without a cheque or transfer cannot be approved: say where it is issued */}
      {!loading && String(disbursementDetails?.status || "").toLowerCase() === "draft" && processedChequeBookData.length === 0 && (
        <NextStep title={t("paymentVoucher.nextStepIssue")} text={t("paymentVoucher.nextStepIssueText")}
          actions={[{ key: "issue", label: t("paymentVoucher.issuePayment"), to: `/accounts/paymentvoucher/invoicelist/${id}` }]} />
      )}
      {!loading && processedChequeBookData.some((r) => r.status === "Pending") && (
        <NextStep title={t("paymentVoucher.nextStepApprove")} text={t("paymentVoucher.nextStepApproveText")} />
      )}

      <Card className="cardstyle_container">
        <DetailHeader
          title={disbursementDetails?.voucherNumber || disbursementDetails?.transactionNumber || ""}
          subtitle={disbursementDetails?.payeeName}
          status={disbursementDetails?.status ? { code: String(disbursementDetails.status).toLowerCase(), label: statusLabel(disbursementDetails.status) } : null}
          meta={[
            { label: t("paymentVoucher.voucherDate", "Voucher Date"), value: disbursementDetails?.voucherDate, type: "date" },
            { label: t("paymentVoucher.paymentMode", "Payment Mode"), value: paymentModeText(disbursementDetails?.paymentMode) },
            { label: t("paymentVoucher.paidAt", "Paid On"), value: disbursementDetails?.paidAt, type: "date" },
          ]}
        />
        <KeyValueGrid
          columns={4}
          items={[
            { label: t("paymentVoucher.transactionNumber"), value: disbursementDetails?.transactionNumber },
            { label: t("paymentVoucher.grossAmount", "Gross Amount"), value: disbursementDetails?.grossAmount || disbursementDetails?.amount, type: "amount" },
            { label: t("paymentVoucher.whtAmount", "Withholding Tax"), value: disbursementDetails?.whtAmount, type: "amount" },
            { label: t("paymentVoucher.detail.otherDeductions"), value: otherDeductions, type: "amount", hidden: !otherDeductions },
            { label: t("paymentVoucher.netAmount", "Net Amount"), value: disbursementDetails?.amount, type: "amount" },
            { label: t("paymentVoucher.payeeType"), value: disbursementDetails?.payeeType },
            { label: t("paymentVoucher.customerCode"), value: disbursementDetails?.customerCode },
            { label: t("paymentVoucher.detail.policyNumber"), value: disbursementDetails?.policyNumber, hidden: !disbursementDetails?.policyNumber },
            { label: t("paymentVoucher.detail.insurer"), value: disbursementDetails?.insurerName, hidden: !disbursementDetails?.insurerName },
            { label: t("paymentVoucher.transactionType"), value: disbursementDetails?.transactionCode },
            { label: t("paymentVoucher.paymentDescription"), value: disbursementDetails?.transactionDescription, span: 2 },
            { label: t("paymentVoucher.paymentCurrency"), value: disbursementDetails?.instrumentCurrency },
            { label: t("paymentVoucher.departmentCode"), value: disbursementDetails?.departmentCode },
            { label: t("paymentVoucher.branchCode"), value: disbursementDetails?.branchCode },
            { label: t("paymentVoucher.criteria"), value: disbursementDetails?.criteria },
            { label: t("paymentVoucher.detail.remarks"), value: disbursementDetails?.remarks, span: "full", hidden: !disbursementDetails?.remarks },
          ]}
        />
      </Card>

      {showPolicyBeneficiary ? (
        <Card className="cardstyle_container policy-beneficiary-card">
          <div className="policy-beneficiary-header">
            <div>
              <div className="section-title">
                {t("paymentVoucher.policyBeneficiarySelection")}
              </div>
              <div className="section-subtitle">
                {t("paymentVoucher.policyBeneficiarySubtitle")}
              </div>
            </div>
            <div className="coinsurance-toggle">
              <button
                type="button"
                className={`coinsurance-toggle__btn ${
                  coInsuranceMode ? "active" : ""
                }`}
                onClick={() => handleCoInsuranceToggle(true)}
                disabled={(policyBeneficiary?.participants?.length || 0) <= 1}
              >
                {t("paymentVoucher.withCoInsurance")}
              </button>
              <button
                type="button"
                className={`coinsurance-toggle__btn ${
                  !coInsuranceMode ? "active" : ""
                }`}
                onClick={() => handleCoInsuranceToggle(false)}
              >
                {t("paymentVoucher.withoutCoInsurance")}
              </button>
            </div>
          </div>

          <div className="grid">
            <div className="col-4 md:col-4">
              <InputField
                classNames="field__container"
                label={t("paymentVoucher.policyNumberRequired")}
                value={
                  policyBeneficiary?.policyNumber ||
                  disbursementDetails?.policyNumber ||
                  ""
                }
                disabled={true}
              />
            </div>
            <div className="col-4 md:col-4">
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.participatingInsurer")}
                value={selectedParticipatingInsurer}
                onChange={(e) => setSelectedParticipatingInsurer(e.value)}
                options={participatingInsurerOptions}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
            <div className="col-4 md:col-4">
              <InputField
                classNames="field__container"
                label={t("paymentVoucher.contactRegistryDetail")}
                value={policyBeneficiary?.contactDetail || "—"}
                disabled={true}
              />
            </div>
          </div>

          {selectedInsurerName ? (
            <div className="policy-validation-banner">
              {t("paymentVoucher.insurerValidatedMessage", {
                insurer: selectedInsurerName,
                policy:
                  policyBeneficiary?.policyNumber ||
                  disbursementDetails?.policyNumber,
              })}
            </div>
          ) : null}
        </Card>
      ) : null}

      {showAllocation && activeParticipants.length > 0 ? (
        <Card className="cardstyle_container allocation-breakdown-card">
          <div className="allocation-header">
            <div>
              <div className="section-title">
                {t("paymentVoucher.allocationBreakdownDetails")}
              </div>
              <div className="section-subtitle">
                {t("paymentVoucher.allocationBreakdownSubtitle")}
              </div>
            </div>
            {coInsuranceMode ? (
              <span className="coinsurance-mode-badge">
                {t("paymentVoucher.coInsuranceMode")}
              </span>
            ) : null}
          </div>

          <div className="allocation-table-wrap">
            <table className="allocation-table">
              <thead>
                <tr>
                  <th>{t("paymentVoucher.allocationInsurer")}</th>
                  <th>{t("paymentVoucher.allocationRole")}</th>
                  <th>{t("paymentVoucher.allocationShare")}</th>
                  <th>{t("paymentVoucher.allocationPayable")}</th>
                  <th>{t("paymentVoucher.allocationRemittanceStatus")}</th>
                  <th>{t("paymentVoucher.allocationSettlementRef")}</th>
                </tr>
              </thead>
              <tbody>
                {activeParticipants.map((row) => {
                  const isSelected =
                    selectedInsurerName &&
                    row.insurerName?.toLowerCase() ===
                      selectedInsurerName.toLowerCase();
                  return (
                    <tr
                      key={`${row.insurerName}-${row.role}`}
                      className={isSelected ? "selected-row" : ""}
                    >
                      <td>{row.insurerName}</td>
                      <td>{roleBody(row.role)}</td>
                      <td className="share-cell">{`${row.sharePercentage}%`}</td>
                      <td className="amount-cell">{row.payableAmount}</td>
                      <td>{remittanceStatusBody(row.remittanceStatus)}</td>
                      <td>{row.settlementRef}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    {t("paymentVoucher.aggregateCoInsuranceShares")}
                  </td>
                  <td className="share-cell">
                    {`${allocationAggregates.sharePercentage}%`}
                  </td>
                  <td className="amount-cell">
                    {allocationAggregates.payableAmount}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : null}

      {paymentLines.length > 0 && (
        <DetailSection title={t("paymentVoucher.paymentLines", "Payment lines")} className="pv-detail__section">
          <div>
            <DataTable value={paymentLines} dataKey="id" tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}>
              <Column field="reference" header={t("paymentVoucher.reference", "Reference")} headerStyle={headerStyle} className="fieldvalue_container" />
              <Column field="description" header={t("paymentVoucher.description", "Description")} headerStyle={headerStyle} className="fieldvalue_container" />
              <Column field="gross" header={t("paymentVoucher.grossAmount", "Gross Amount")} body={(r) => money(r.gross)} headerStyle={headerStyle} className="fieldvalue_container" />
              <Column field="wht" header={t("paymentVoucher.whtAmount", "Withholding Tax")} body={(r) => money(r.wht)} headerStyle={headerStyle} className="fieldvalue_container" />
              <Column field="net" header={t("paymentVoucher.netAmount", "Net Amount")} body={(r) => money(r.net)} headerStyle={headerStyle} className="fieldvalue_container" />
              <Column field="status" header={t("paymentVoucher.status")} body={(r) => <StatusChip code={String(r.status || "").toLowerCase()} label={statusLabel(r.status)} />} headerStyle={headerStyle} className="fieldvalue_container" />
            </DataTable>
          </div>
        </DetailSection>
      )}

      <DetailSection title={t("paymentVoucher.chequeBookDetails")} className="pv-detail__section"
        actions={(
          <Button type="button" icon="pi pi-print" outlined size="small" label={t("paymentVoucher.detail.printVoucher")} onClick={printVoucher} disabled={!disbursementDetails?.disbursementId} />
        )}>
      <div>
        <DataTable
          value={processedChequeBookData}
          emptyMessage={t("paymentVoucher.noChequeIssued", "No cheque has been issued on this voucher")}
          tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
          paginator
          rows={20}
          rowsPerPageOptions={[20, 50, 100]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          scrollable={true}
          scrollHeight="40vh"
          rowClassName={(rowData) => {
            const baseClass = getStatusClassName(rowData.status);
            if (!actionable(rowData)) {
              return baseClass
                ? `${baseClass} non-selectable-row`
                : "non-selectable-row";
            }
            return baseClass;
          }}
          selection={selectedProducts}
          onSelectionChange={(e) => {
            if (e.value && actionable(e.value)) {
              setSelectedProducts(e.value);
            } else {
              setSelectedProducts(null);
            }
          }}
          selectionMode={hasPendingItems || hasApprovedItems ? "checkbox" : undefined}
          dataKey="id"
        >
          {(hasPendingItems || hasApprovedItems) && (
            <Column
              selectionMode="single"
              selectedItem
              headerStyle={{ width: "4rem", border: "0px solid #000" }}
              style={{ textAlign: "center" }}
            ></Column>
          )}
          <Column
            field="VoucherNumber"
            header={t("paymentVoucher.customerCode")}
            headerStyle={headerStyle}
            sortable
            className="fieldvalue_container"
          ></Column>
          <Column
            field="TransactionNumber"
            header={t("paymentVoucher.customerName")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="CustomerCode"
            header={t("paymentVoucher.mainAccount")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="VoucheDate"
            header={t("paymentVoucher.instrumentBookId")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="Amount"
            header={t("paymentVoucher.instrumentNo")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column body={(row) => formatAppDate(row.InstrumentDate)}
            field="InstrumentDate"
            header={t("paymentVoucher.instrumentDate")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="TotalAmount"
            body={(row) => money(row.TotalAmount)}
            header={t("paymentVoucher.totalAmount")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="status"
            header={t("paymentVoucher.status")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
            body={statusBodyTemplate}
          ></Column>
        </DataTable>
      </div>
      </DetailSection>

      {(hasPendingItems || hasApprovedItems) && (
        <div className="next_container">
          {hasApprovedItems && (
            <Button
              className="submit_button p-0 mr-2"
              label={t("paymentVoucher.print")}
              onClick={handlePrint}
              disabled={!selectedProducts || selectedProducts.status !== "Approved"}
              tooltip={!selectedProducts || selectedProducts.status !== "Approved" ? t("paymentVoucher.detail.selectApprovedCheque") : undefined}
              tooltipOptions={{ showOnDisabled: true, position: "top" }}
            />
          )}
          {hasPendingItems && (
            <Button
              className="submit_button p-0"
              label={t("paymentVoucher.approve")}
              onClick={handleApprove}
              disabled={
                !selectedProducts || selectedProducts.status !== "Pending"
              }
            />
          )}
        </div>
      )}

      {disbursementDetails?.disbursementId && (
        <DetailSection title={t("paymentVoucher.confirm.activity")}>
          <RecordActivityLog key={activityKey} entity="disbursement" recordId={disbursementDetails.disbursementId} />
        </DetailSection>
      )}
    </div>
  );
}

export default Detailview;
