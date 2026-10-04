import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import DropDowns from "../../../components/DropDowns";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputNumber } from "primereact/inputnumber";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../components/LabelWrapper";
import { useSelector, useDispatch } from "react-redux";
import {
  getDraftReceiptsMiddleware,
  getReceiptByIdMiddleware,
} from "../store/receiptsMiddleware";
import { showErrorMessage } from "../../../utility/toastUtils";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import { receiptsService } from "../../../services/receiptsService";
import mastersService from "../../../services/mastersService";
import profileService from "../../../services/profileService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { getDisplayCurrencyConfig, numberLocale } from "../../../utility/currencyConverter";
import { calendarDateFormat, formatDate as formatAppDate } from "../../../utility/dateFormat";
import useMasterOptions from "../../GeneralMasters/common/useMasterOptions";

/** Receipt modes shown to the user, with the payment mode the receipts API records (cash / check / bank-transfer / online). */
const RECEIPT_MODES = [
  { key: "modeDollarPeso", code: "Dollar/Peso", paymentMode: "cash" },
  { key: "modeDirectCredit", code: "Direct Credit/Transfer to Account", paymentMode: "bank-transfer" },
  { key: "modeCheque", code: "Cheque", paymentMode: "check", cheque: true },
  { key: "modeAuthorityToDebit", code: "Authority to Debit", paymentMode: "bank-transfer" },
  { key: "modeTelegraphicTransfer", code: "Telegraphic Transfer", paymentMode: "bank-transfer" },
  { key: "modeManagersCheck", code: "Managers Check/Demand Draft", paymentMode: "check", cheque: true },
  { key: "modeCreditTicket", code: "Credit Ticket-Inter Office", paymentMode: "bank-transfer" },
  { key: "modeOnlineBanking", code: "Online Banking", paymentMode: "online" },
];

/** Receipt transaction codes are the credit-basis entries of the Transaction Code master (e.g. OR – Official Receipt). */
const FALLBACK_TRANSACTION_CODES = [{ name: "PAYMENT – Premium collection", code: "PAYMENT" }];

const toNameCode = (option) => ({ name: option.label, code: option.code });
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const apiError = (error) =>
  error?.response?.data?.error?.message || error?.response?.data?.message || error?.message;
const pad = (n) => String(n).padStart(2, "0");
const toDateText = (date) =>
  date instanceof Date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : date || undefined;

const errorText = (text) => (text ? <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{text}</div> : null);

function BranchAdding() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, draftReceiptsList } = useSelector(({ receiptsTableReducers }) => ({
    loading: receiptsTableReducers?.loading,
    draftReceiptsList: receiptsTableReducers?.draftReceiptsList,
  }));

  const [openReceivables, setOpenReceivables] = useState([]);
  const [receivablesLoading, setReceivablesLoading] = useState(false);
  const [masters, setMasters] = useState({ branches: [], departments: [], transactionCodes: [] });
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [amountReceived, setAmountReceived] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const drafts = useMemo(() => (Array.isArray(draftReceiptsList) ? draftReceiptsList : []), [draftReceiptsList]);

  const items = [
    { label: t("accounts.receipts.title"), command: () => navigate("/accounts/receipts") },
    { label: t("accounts.addReceiptsLabel"), to: "/accounts/receipts/addreceipts" },
  ];
  const home = { label: t("sidebar.Accounts") };
  const receiptTypeOptions = [
    { name: t("accounts.addReceipts.typePayment"), code: "Payment" },
    { name: t("accounts.addReceipts.typeRefund"), code: "Refund" },
  ];
  const receiptModeOptions = RECEIPT_MODES.map((m) => ({ name: t(`accounts.addReceipts.${m.key}`), code: m.code }));
  const defaultCurrency = getDisplayCurrencyConfig().currency;
  // Currency codes from the Currency master (Master > Finance > Currency)
  const currencyOptions = useMasterOptions("currency", { valueKey: "code", labelKey: "code" });

  const loadOpenReceivables = useCallback(async () => {
    setReceivablesLoading(true);
    try {
      setOpenReceivables(await receiptsService.getOpenReceivables());
    } catch (error) {
      showErrorMessage(apiError(error) || t("accounts.addReceipts.failedToLoadReceivables"), t("accounts.receipts.error"));
    } finally {
      setReceivablesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOpenReceivables();
    dispatch(getDraftReceiptsMiddleware());
  }, [dispatch, loadOpenReceivables]);

  const validate = (values) => {
    const errors = {};
    if (!values.receiptDate) errors.receiptDate = t("accounts.addReceipts.validationDateRequired");
    if (!values.receiptType) errors.receiptType = t("accounts.addReceipts.validationReceiptTypeRequired");
    if (!values.branchCode) errors.branchCode = t("accounts.addReceipts.validationBranchCodeRequired");
    if (!values.departmentCode) errors.departmentCode = t("accounts.addReceipts.validationDepartmentCodeRequired");
    if (!values.customerCode) errors.customerCode = t("accounts.addReceipts.validationCustomerCodeRequired");
    if (!values.customerName) errors.customerName = t("accounts.addReceipts.validationCustomerNameRequired");
    if (!values.policyNumber) errors.policyNumber = t("accounts.addReceipts.validationPolicyNumberRequired");
    if (!values.currencyCode) errors.currencyCode = t("accounts.addReceipts.validationCurrencyCodeRequired");
    if (!values.transactionCode) errors.transactionCode = t("accounts.addReceipts.validationTransactionCodeRequired");
    if (!values.receiptMode) errors.receiptMode = t("accounts.addReceipts.validationReceiptModeRequired");
    return errors;
  };

  const formik = useFormik({
    initialValues: {
      receiptDate: new Date(),
      receiptNumber: "",
      receiptType: "Payment",
      branchCode: "",
      departmentCode: "",
      customerCode: "",
      customerName: "",
      policyNumber: "",
      currencyCode: defaultCurrency,
      transactionCode: "",
      receiptMode: "",
      chequeNumber: "",
      chequeDate: new Date(),
      referenceNo: "",
      remarks: "",
    },
    validate,
    onSubmit: () => {},
  });
  const { values, setFieldValue } = formik;

  // Branch / department from the same masters as the Payment Voucher screen; transaction codes from the
  // Transaction Code master (credit basis = receipts). Branch defaults to the signed-in user's branch.
  useEffect(() => {
    let alive = true;
    const load = (type, params) =>
      mastersService.options(type, params).then((rows) => rows.map(toNameCode)).catch(() => []);
    Promise.all([
      load("branch"),
      load("department"),
      mastersService
        .options("transaction-code", { TransactionBasis: "Credit" })
        .then((rows) => rows.map((o) => ({ name: `${o.code} – ${o.label}`, code: o.code })))
        .catch(() => []),
      profileService.getProfile().catch(() => null),
    ]).then(([branches, departments, codes, profile]) => {
      if (!alive) return;
      const transactionCodes = codes.length ? codes : FALLBACK_TRANSACTION_CODES;
      setMasters({ branches, departments, transactionCodes });
      const ownBranch = profile?.branchCode && branches.find((b) => b.code === profile.branchCode);
      if (ownBranch) setFieldValue("branchCode", ownBranch.code);
      else if (branches.length === 1) setFieldValue("branchCode", branches[0].code);
      if (departments.length === 1) setFieldValue("departmentCode", departments[0].code);
      const receipt = transactionCodes.find((c) => c.code === "OR") || transactionCodes[0];
      setFieldValue("transactionCode", receipt.code);
    });
    return () => {
      alive = false;
    };
  }, [setFieldValue]);

  // Customers: every client with an open (unpaid / partial) bill, plus those with a draft receipt.
  const customers = useMemo(() => {
    const byCode = new Map();
    openReceivables.forEach((r) => {
      if (!r.customerCode) return;
      const c = byCode.get(r.customerCode) || { code: r.customerCode, customerName: r.customerName, balance: 0, drafts: 0 };
      c.balance = round2(c.balance + Number(r.balance || 0));
      byCode.set(r.customerCode, c);
    });
    drafts.forEach((d) => {
      if (!d.customerCode) return;
      const c = byCode.get(d.customerCode) || { code: d.customerCode, customerName: d.customerName, balance: 0, drafts: 0 };
      c.customerName = c.customerName || d.customerName;
      c.drafts += 1;
      byCode.set(d.customerCode, c);
    });
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [openReceivables, drafts]);

  const customerOptions = customers.map((c) => ({
    code: c.code,
    name: `${c.code} – ${c.customerName || t("accounts.addReceipts.unknown")}${
      c.balance > 0 ? ` (${t("accounts.addReceipts.openBalance")} ${formatCurrency(c.balance)})` : ""
    }${c.drafts > 0 ? ` · ${t("accounts.addReceipts.draftCount", { count: c.drafts })}` : ""}`,
  }));

  const customerBills = useMemo(
    () => openReceivables.filter((r) => r.customerCode === values.customerCode),
    [openReceivables, values.customerCode]
  );
  const customerDrafts = useMemo(
    () => drafts.filter((d) => d.customerCode === values.customerCode),
    [drafts, values.customerCode]
  );

  // Policies of the customer that have an open bill (or a draft receipt).
  const policyOptions = useMemo(() => {
    const byNumber = new Map();
    customerBills.forEach((r) => {
      const p = byNumber.get(r.policyNumber) || { code: r.policyNumber, balance: 0, bills: 0, draft: false };
      p.balance = round2(p.balance + Number(r.balance || 0));
      p.bills += 1;
      byNumber.set(r.policyNumber, p);
    });
    customerDrafts.forEach((d) => {
      if (!d.policyNumber) return;
      const p = byNumber.get(d.policyNumber) || { code: d.policyNumber, balance: 0, bills: 0, draft: false };
      p.draft = true;
      byNumber.set(d.policyNumber, p);
    });
    return [...byNumber.values()].map((p) => ({
      code: p.code,
      name: `${p.code}${p.bills ? ` – ${t("accounts.addReceipts.billsOpen", { count: p.bills })}, ${formatCurrency(p.balance)}` : ""}${
        p.draft ? ` · ${t("accounts.addReceipts.draftReceipt")}` : ""
      }`,
    }));
  }, [customerBills, customerDrafts, formatCurrency, t]);

  const policyBills = useMemo(
    () => customerBills.filter((r) => r.policyNumber === values.policyNumber),
    [customerBills, values.policyNumber]
  );
  const policyDraft = useMemo(
    () => customerDrafts.find((d) => d.policyNumber === values.policyNumber),
    [customerDrafts, values.policyNumber]
  );
  const selectedBill = policyBills.find((b) => b.receivableId === selectedBillId) || null;

  // One open bill: select it for the user.
  useEffect(() => {
    if (policyBills.length === 1) setSelectedBillId(policyBills[0].receivableId);
    else if (!policyBills.some((b) => b.receivableId === selectedBillId)) setSelectedBillId(null);
  }, [policyBills, selectedBillId]);

  const handleCustomerCodeChange = (e) => {
    const customer = customers.find((c) => c.code === e.value);
    setFieldValue("customerCode", e.value || "");
    setFieldValue("customerName", customer?.customerName || "");
    setFieldValue("policyNumber", "");
    setSelectedBillId(null);
    setAmountReceived(null);
  };
  const handlePolicyChange = (e) => {
    setFieldValue("policyNumber", e.value || "");
    setSelectedBillId(null);
    setAmountReceived(null);
  };

  const receiptMode = RECEIPT_MODES.find((m) => m.code === values.receiptMode);
  const amountError = (() => {
    if (!selectedBill || amountReceived === null || amountReceived === undefined) return "";
    if (!(Number(amountReceived) > 0)) return t("accounts.addReceipts.validationAmountPositive");
    if (round2(amountReceived) > round2(selectedBill.balance)) {
      return t("accounts.addReceipts.validationAmountExceedsBalance", {
        balance: formatCurrency(selectedBill.balance),
        bill: selectedBill.billNumber,
      });
    }
    return "";
  })();
  const headerComplete = Object.keys(validate(values)).length === 0;
  const chequeMissing = receiptMode?.cheque && !values.chequeNumber.trim();
  const canRecord =
    !!selectedBill && headerComplete && !!receiptMode && !chequeMissing && Number(amountReceived) > 0 && !amountError && !submitting;

  const recordPayment = async () => {
    const bill = selectedBill;
    const amount = round2(amountReceived);
    setSubmitting(true);
    try {
      const reference = receiptMode?.cheque ? values.chequeNumber.trim() : values.referenceNo.trim();
      const modeNote = receiptMode?.cheque
        ? t("accounts.addReceipts.chequeRemark", { mode: values.receiptMode, number: reference, date: toDateText(values.chequeDate) || "" })
        : values.receiptMode;
      const response = await receiptsService.createReceipt({
        receivableId: bill.receivableId,
        amount,
        customerCode: values.customerCode,
        name: values.customerName,
        policyRefId: bill.policyId,
        receiptType: values.receiptType,
        receiptDate: toDateText(values.receiptDate),
        branchCode: values.branchCode,
        departmentCode: values.departmentCode,
        currencyCode: values.currencyCode,
        transactionCode: values.transactionCode,
        paymentMode: receiptMode.paymentMode,
        referenceNo: reference || undefined,
        remarks: [values.remarks.trim(), `${modeNote} – ${bill.billNumber}`].filter(Boolean).join(" | "),
      });
      const receipt = response?.data || response;
      const remaining = round2(bill.balance - amount);
      // back to the receipts list, where the new receipt is shown first and highlighted
      navigate("/accounts/receipts", {
        state: { recorded: { receiptId: receipt?.receiptId, receiptNumber: receipt?.receiptNumber, billNumber: bill.billNumber, amount, remaining, customerName: values.customerName, clientEmail: receipt?.clientEmail || "" } },
      });
    } catch (error) {
      showErrorMessage(apiError(error) || t("accounts.addReceipts.paymentFailed"), t("accounts.receipts.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRecordPayment = () => {
    formik.setTouched(Object.fromEntries(Object.keys(formik.initialValues).map((k) => [k, true])));
    if (!canRecord) return;
    const remaining = round2(selectedBill.balance - round2(amountReceived));
    confirmDialog({
      header: t("accounts.addReceipts.confirmTitle"),
      message: t("accounts.addReceipts.confirmMessage", {
        amount: formatCurrency(amountReceived),
        bill: selectedBill.billNumber,
        balance: formatCurrency(remaining),
      }),
      icon: "pi pi-question-circle",
      acceptLabel: t("accounts.addReceipts.recordPayment"),
      rejectLabel: t("accounts.addReceipts.cancel"),
      accept: recordPayment,
    });
  };

  // Existing pay-later flow: open the draft receipt for this customer / policy on the receipt edit screen.
  const openDraftReceipt = async () => {
    if (!policyDraft?.receiptId) {
      showErrorMessage(t("accounts.addReceipts.receiptNotFound"));
      return;
    }
    try {
      const response = await dispatch(getReceiptByIdMiddleware(policyDraft.receiptId)).unwrap();
      const receivableTableList = (response.receiptsList || []).map((item) => ({
        id: item.receiptListId,
        policies: item.policies,
        netPremium: item.netPremium,
        paid: item.paid,
        unPaid: item.unPaid,
        discounts: item.discounts,
        dst: item.dst,
        lgt: item.lgt,
        vat: item.vat,
        other: item.other,
        fcAmount: item.fcAmount,
        lcAmount: item.lcAmount,
        status: item.status || "Pending",
      }));
      navigate("/accounts/receipts/addreceiptedit", {
        state: {
          customerData: {
            customerCode: values.customerCode,
            customerName: values.customerName,
            policyNumber: values.policyNumber,
            receiptId: response.receiptId,
            receiptNumber: response.receiptNumber,
            receiptType: values.receiptType,
            branchCode: values.branchCode,
            departmentCode: values.departmentCode,
            currencyCode: values.currencyCode,
            transactionCode: values.transactionCode,
            remarks: values.remarks || response.remarks || "",
            transactionNumber: response.transactionNumber,
            policyRefId: response.policyRefId,
            receiptStatus: response.receiptStatus,
          },
          receivableTableList,
        },
      });
    } catch (error) {
      showErrorMessage(t("accounts.addReceipts.failedToLoadReceiptDetails"));
    }
  };

  const touchedError = (field) => (formik.touched[field] ? formik.errors[field] : "");
  const money = (field) => (row) => formatCurrency(row[field]);

  return (
    <div className="overall_add_policy_receipts_container">
      <ConfirmDialog />
      <div>
        <Button
          type="button"
          text
          className="back_button"
          aria-label={t("accounts.addReceipts.back")}
          onClick={() => navigate(-1)}
        >
          <SvgBackicon />
        </Button>
        <label className="label_header">{t("accounts.addReceipts.title")}</label>
      </div>
      <BreadCrumb model={items} home={home} className="breadcrumbs_container" separatorIcon={<SvgDot color={"#000"} />} />
      <Card>
        <div className="grid">
          <div className="sm-col-12  md:col-3 lg-col-4 col-offset-9">
            <LabelWrapper className="calenderlable__container">{t("accounts.addReceipts.receiptDate")}</LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={values.receiptDate}
              onChange={(e) => setFieldValue("receiptDate", e.target.value)}
              dateFormat={calendarDateFormat()}
              disabled={true}
            />
            {errorText(touchedError("receiptDate"))}
          </div>
        </div>
        <div className="grid">
          <div className="sm-col-12 col-12 md:col-3 lg-col-4">
            <InputField
              value={values.receiptNumber}
              classNames="field__container"
              label={t("accounts.addReceipts.receiptNumber")}
              placeholder={t("accounts.addReceipts.autoGenerated")}
              disabled={true}
            />
          </div>
          <div className="sm-col-12  md:col-3 lg-col-4">
            <DropDowns
              value={values.receiptType}
              onChange={(e) => setFieldValue("receiptType", e.value)}
              className="dropdown__container"
              label={t("accounts.addReceipts.receiptType")}
              options={receiptTypeOptions}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {errorText(touchedError("receiptType"))}
          </div>
          <div className="sm-col-12  md:col-3 lg-col-4">
            <DropDowns
              value={values.branchCode}
              onChange={(e) => setFieldValue("branchCode", e.value)}
              className="dropdown__container"
              label={t("accounts.addReceipts.branchCode")}
              options={masters.branches}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {errorText(touchedError("branchCode"))}
          </div>
          <div className="sm-col-12  md:col-3 lg-col-4">
            <DropDowns
              value={values.departmentCode}
              onChange={(e) => setFieldValue("departmentCode", e.value)}
              className="dropdown__container"
              label={t("accounts.addReceipts.departmentCode")}
              options={masters.departments}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {errorText(touchedError("departmentCode"))}
          </div>
        </div>

        <div className="grid">
          <div className="col-12 md:col-4">
            <DropDowns
              value={values.customerCode}
              onChange={handleCustomerCodeChange}
              className="dropdown__container"
              label={t("accounts.addReceipts.customerCode")}
              options={customerOptions}
              optionLabel="name"
              optionValue="code"
              placeholder={
                receivablesLoading || loading ? t("common.loading") : t("accounts.addReceipts.selectCustomerCode")
              }
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={receivablesLoading}
            />
            {errorText(touchedError("customerCode"))}
            {!receivablesLoading && customerOptions.length === 0 && (
              <small className="field_hint">{t("accounts.addReceipts.noOpenReceivables")}</small>
            )}
          </div>
          <div className="col-12 md:col-4">
            <InputField
              value={values.customerName}
              classNames="field__container"
              label={t("accounts.addReceipts.customerName")}
              placeholder={t("accounts.addReceipts.customerNameAuto")}
              disabled={true}
            />
            {errorText(touchedError("customerName"))}
          </div>
          <div className="col-12 md:col-4">
            <DropDowns
              value={values.policyNumber}
              onChange={handlePolicyChange}
              className="dropdown__container"
              label={t("accounts.addReceipts.policyNumber")}
              options={policyOptions}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.selectPolicyNumber")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={!values.customerCode}
            />
            {errorText(touchedError("policyNumber"))}
          </div>
        </div>
        <div className="grid">
          <div className="col-12 md:col-4">
            <DropDowns
              value={values.currencyCode}
              onChange={(e) => setFieldValue("currencyCode", e.value)}
              className="dropdown__container"
              label={t("accounts.addReceipts.currencyCode")}
              options={currencyOptions}
              optionLabel="label"
              optionValue="code"
              placeholder={t("accounts.addReceipts.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {errorText(touchedError("currencyCode"))}
          </div>
          <div className="col-12 md:col-4">
            <DropDowns
              value={values.transactionCode}
              onChange={(e) => setFieldValue("transactionCode", e.value)}
              className="dropdown__container"
              label={t("accounts.addReceipts.transactionCode")}
              options={masters.transactionCodes}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {errorText(touchedError("transactionCode"))}
          </div>
          <div className="col-12 md:col-4">
            <DropDowns
              value={values.receiptMode}
              onChange={(e) => {
                setFieldValue("receiptMode", e.value);
                setFieldValue("chequeNumber", "");
                setFieldValue("chequeDate", new Date());
                setFieldValue("referenceNo", "");
              }}
              className="dropdown__container"
              label={t("accounts.addReceipts.receiptMode")}
              options={receiptModeOptions}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.selectReceiptMode")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {errorText(touchedError("receiptMode"))}
          </div>
        </div>
        {receiptMode?.cheque && (
          <div className="grid">
            <div className="col-12 md:col-4">
              <InputField
                value={values.chequeNumber}
                onChange={formik.handleChange("chequeNumber")}
                classNames="field__container"
                label={t("accounts.addReceipts.chequeNumber")}
                placeholder={t("accounts.addReceipts.enterChequeNumber")}
              />
              {selectedBill && chequeMissing && errorText(t("accounts.addReceipts.validationChequeNumberRequired"))}
            </div>
            <div className="col-12 md:col-4">
              <LabelWrapper className="calenderlable__container">{t("accounts.addReceipts.chequeDate")}</LabelWrapper>
              <Calendar
                classNames="calender__container"
                showIcon
                value={values.chequeDate}
                onChange={(e) => setFieldValue("chequeDate", e.target.value)}
                dateFormat={calendarDateFormat()}
              />
            </div>
          </div>
        )}
        {receiptMode && !receiptMode.cheque && receiptMode.paymentMode !== "cash" && (
          <div className="grid">
            <div className="col-12 md:col-4">
              <InputField
                value={values.referenceNo}
                onChange={formik.handleChange("referenceNo")}
                classNames="field__container"
                label={t("accounts.addReceipts.referenceNoOptional")}
                placeholder={t("accounts.addReceipts.enter")}
              />
            </div>
          </div>
        )}
        <div className="grid">
          <div className="col-12 md:col-8">
            <InputField
              value={values.remarks}
              onChange={formik.handleChange("remarks")}
              classNames="field__container"
              label={t("accounts.addReceipts.remarksOptional")}
              placeholder={t("accounts.addReceipts.enter")}
            />
          </div>
        </div>
      </Card>

      {values.policyNumber && (
        <Card className="mt-3 open_bills_card">
          <h3 className="section_title">{t("accounts.addReceipts.openBillsTitle", { policy: values.policyNumber })}</h3>
          {policyBills.length === 0 ? (
            <p className="field_hint">{t("accounts.addReceipts.noOpenBillsForPolicy")}</p>
          ) : (
            <DataTable
              value={policyBills}
              dataKey="receivableId"
              selectionMode="radiobutton"
              selection={selectedBill}
              onSelectionChange={(e) => {
                setSelectedBillId(e.value?.receivableId || null);
                setAmountReceived(null);
              }}
              className="datatable_container"
              responsiveLayout="scroll"
            >
              <Column selectionMode="single" headerStyle={{ width: "3rem" }} />
              <Column
                field="billNumber"
                header={t("accounts.addReceipts.billNumber")}
                body={(row) => (row.oldBillNumber ? t("accounts.addReceipts.billWithOldNumber", { bill: row.billNumber, old: row.oldBillNumber }) : row.billNumber)}
              />
              <Column
                field="source"
                header={t("accounts.addReceipts.billType")}
                body={(row) => t(`accounts.addReceipts.billSource.${row.source}`, { defaultValue: row.source })}
              />
              <Column field="amount" header={t("accounts.addReceipts.billAmount")} body={money("amount")} />
              <Column field="paidAmount" header={t("accounts.addReceipts.billPaid")} body={money("paidAmount")} />
              <Column field="balance" header={t("accounts.addReceipts.billBalance")} body={money("balance")} />
              <Column body={(row) => formatAppDate(row.dueDate)} field="dueDate" header={t("accounts.addReceipts.billDueDate")} />
              <Column
                field="status"
                header={t("accounts.addReceipts.billStatus")}
                body={(row) => t(`accounts.addReceipts.billStatusLabel.${row.status}`, { defaultValue: row.status })}
              />
            </DataTable>
          )}

          {selectedBill && (
            <div className="grid mt-3 payment_capture">
              <div className="col-12 md:col-4">
                <div className="calenderlable__container">
                  <label htmlFor="amountReceived">{t("accounts.addReceipts.amountReceived")}</label>
                </div>
                <InputNumber
                  inputId="amountReceived"
                  value={amountReceived}
                  onValueChange={(e) => setAmountReceived(e.value)}
                  mode="decimal"
                  locale={numberLocale()}
                  minFractionDigits={2}
                  maxFractionDigits={2}
                  min={0}
                  placeholder={formatCurrency(selectedBill.balance)}
                  className="amount_input"
                />
                {errorText(amountError)}
                <small className="field_hint">
                  {t("accounts.addReceipts.balanceHint", { balance: formatCurrency(selectedBill.balance) })}
                </small>
              </div>
              <div className="col-12 md:col-4 payment_capture_actions">
                <Button
                  type="button"
                  label={t("accounts.addReceipts.payFullBalance")}
                  className="p-button-outlined"
                  onClick={() => setAmountReceived(round2(selectedBill.balance))}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="next_container">
        <div className="exit_print_buttons">
          {policyDraft && (
            <Button
              type="button"
              label={t("accounts.addReceipts.openDraftReceipt")}
              className="p-button-outlined"
              onClick={openDraftReceipt}
              loading={loading}
            />
          )}
          <Button
            type="button"
            label={t("accounts.addReceipts.recordPayment")}
            className="print"
            onClick={confirmRecordPayment}
            disabled={!canRecord}
            loading={submitting}
          />
        </div>
      </div>
    </div>
  );
}

export default BranchAdding;
