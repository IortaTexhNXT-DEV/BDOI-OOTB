import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SubmitButton from "../../../components/SubmitButton";
import SvgEdit from "../../../assets/icons/SvgEdit";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgDot from "../../../assets/icons/SvgDot";
import { Paginator } from "primereact/paginator";
import { Dialog } from "primereact/dialog";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import NavBar from "../../../components/NavBar";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import { Dropdown } from "primereact/dropdown";
import SvgEditicon from "../../../assets/icons/SvgEdit";
import SvgEditIcon from "../../../assets/icons/SvgEditicons";
import { useSelector, useDispatch } from "react-redux";
import {
  getpaymentCheckbookDetailsMiddleware,
  patchpaymentVocherInvoiceListMiddleware,
  getDisbursementDetailsMiddleware,
} from "../store/paymentVocherMiddleware";
import { useFormik } from "formik";
import CustomToast from "../../../components/Toast";
import disbursementService from "../../../services/disbursementService";

function SpecificVoucher() {
  const { t } = useTranslation();
  const { disbursementId } = useParams();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const Navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const location = useLocation();
  const { disbursementData: disbursementDataFromState } = location.state || {};
  const [visible, setVisible] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [EditID, setEditID] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disbursementData, setDisbursementData] = useState(null);
  const [invoiceListData, setInvoiceListData] = useState([]);
  const [isAgentPayee, setIsAgentPayee] = useState(false);

  const payeeTypeFromState =
    disbursementDataFromState?.PayeeType?.code ||
    disbursementDataFromState?.PayeeType?.name ||
    disbursementDataFromState?.PayeeType;
  const referrerIdFromState =
    disbursementDataFromState?.AgentReferrer?.code ||
    disbursementDataFromState?.referrerId;

  const resolveCustomerCodeFromState = () => {
    const fromState = disbursementDataFromState?.CustomerCode;
    if (!fromState) return null;
    if (typeof fromState === "string") return fromState || null;
    return fromState.code || fromState.label || fromState.name || null;
  };

  const resolveCustomerCode = async () => {
    const fromState = resolveCustomerCodeFromState();
    if (fromState) return fromState;

    if (!disbursementId) return null;

    const result = await disbursementService.getDisbursementById(disbursementId);
    if (!result.success) {
      console.error("Failed to fetch disbursement for customerCode:", result.error);
      return null;
    }

    const disbursement = result.data?.data || result.data;
    return disbursement?.customerCode || null;
  };

  const handlebankdetail = async () => {
    const ids = selectedProducts?.map((item) => item.id);
    const commissionLineIds = selectedProducts
      ?.map((item) => item.commissionLineId || item.id)
      .filter(Boolean);

    dispatch({
      type: "paymentVoucher/setSelectedInvoiceIds",
      payload: ids,
    });
    dispatch({
      type: "paymentVoucher/setCurrentDisbursementId",
      payload: disbursementId,
    });
    dispatch({
      type: "paymentVoucher/setSelectedCommissionLineIds",
      payload: commissionLineIds,
    });

    if (isAgentPayee) {
      Navigate("/accounts/paymentvoucher/bankdetailselection", {
        state: {
          disbursementData: disbursementDataFromState || {
            referrerName: disbursementData?.referrer?.name,
          },
          selectedInvoice: selectedProducts,
          commissionLineIds,
          isAgentPayee: true,
          disbursementId,
        },
      });
      return;
    }

    const createCheckbookData = await disbursementService.createCheckbook({
      disbursementId,
      customerCode: disbursementDataFromState?.CustomerCode?.code,
      customerName: disbursementDataFromState?.CustomerName?.name,
      totaleAmount: selectedProducts
        .reduce((acc, curr) => acc + parseFloat(curr.rawData.totalAmount), 0)
        .toString(),
      invoiceListRefId: selectedProducts.map((item) => item.id)[0],
    });
    if (!createCheckbookData.success) {
      toastRef.current?.showToast({
        severity: "error",
        summary: t("common.error"),
        detail: createCheckbookData.error,
      });
      return;
    }
    if (createCheckbookData.success) {
      Navigate("/accounts/paymentvoucher/bankdetailselection", {
        state: {
          disbursementData: disbursementDataFromState,
          selectedInvoice: selectedProducts,
        },
      });
    }
  };

  // Fetch disbursement details / agent approved lines on mount
  useEffect(() => {
    const fetchDisbursementDetails = async () => {
      if (!disbursementId) {
        console.warn("No disbursement ID found in URL params");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Opened from the list or a link (no navigation state): read the payee from the saved voucher,
        // so the checker can open a pending agent payout.
        let payeeType = payeeTypeFromState;
        let referrerId = referrerIdFromState;
        let voucherInvoicesOnly = false;
        if (!payeeType && !referrerId) {
          voucherInvoicesOnly = true;
          const saved = await disbursementService.getDisbursementById(disbursementId);
          const voucher = saved.data?.data || saved.data;
          payeeType = voucher?.payeeType;
          referrerId = voucher?.referrerId;
        }
        const agentPayee = payeeType === "Agent/Referrer" || Boolean(referrerId);
        setIsAgentPayee(agentPayee);

        if (agentPayee && referrerId) {
          const result = await disbursementService.getAgentInvoiceLines(
            referrerId
          );
          if (result.success) {
            const payload = result.data?.data || result.data;
            const list = payload?.invoiceList || [];
            setDisbursementData(payload);
            const transformedData = list.map((invoice, index) => ({
              id: invoice.commissionLineId || invoice.invoiceListId || index,
              commissionLineId: invoice.commissionLineId || invoice.invoiceListId,
              VoucherNumber: formatCurrency(invoice.payables ?? 0),
              TransactionNumber: formatCurrency(invoice.outstanding ?? 0),
              fcamount: invoice.fcAmount ? formatCurrency(invoice.fcAmount) : "-",
              VoucheDate: invoice.lcAmount ? formatCurrency(invoice.lcAmount) : "-",
              discount: invoice.excess ? formatCurrency(invoice.excess) : "-",
              Amount: invoice.balAmount ? formatCurrency(invoice.balAmount) : "-",
              vat: invoice.vat ? formatCurrency(invoice.vat) : "-",
              wht: invoice.wht ? formatCurrency(invoice.wht) : "-",
              comsub: invoice.comsub,
              policyNumber: invoice.policyNumber,
              totalAmount: formatCurrency(invoice.totalAmount ?? 0),
              checkbooks: invoice.checkbooks || [],
              rawData: invoice,
            }));
            setInvoiceListData(transformedData);
          } else {
            console.error("Failed to fetch agent invoice lines:", result.error);
          }
        } else {
          const insurerVoucher = voucherInvoicesOnly && payeeType === "Insurer";
          const customerCode = insurerVoucher ? null : await resolveCustomerCode();

          if (!insurerVoucher && !customerCode) {
            setInvoiceListData([]);
            toastRef.current?.showToast({
              severity: "error",
              summary: t("common.error"),
              detail: t("paymentVoucher.customerCodeMissingForInvoiceList"),
            });
            return;
          }

          // an insurer voucher (e.g. raised by a remittance settlement) lists its own invoices
          const result =
            insurerVoucher
              ? await disbursementService.getInvoiceListByDisbursement(disbursementId)
              : await disbursementService.getInvoiceListByCustomerCode(customerCode);
          const { success, data } = result;

          if (success) {
            // once the voucher's lines carry a live cheque, the next step is its approval on the detail view
            const hasCheque = (data.data || []).some((inv) =>
              (inv.checkbooks || []).some((c) => !["Cancelled"].includes(c.status))
            );
            if (insurerVoucher && hasCheque) {
              Navigate(`/accounts/paymentvoucher/detailview/${disbursementId}`, { replace: true });
              return;
            }
            setDisbursementData(data.data);

            if (data.data) {
              const transformedData = data.data.map((invoice, index) => ({
                id: invoice.invoiceListId || index,
                VoucherNumber: formatCurrency(invoice.payables ?? 0),
                TransactionNumber: formatCurrency(invoice.outstanding ?? 0),
                fcamount: invoice.fcAmount ? formatCurrency(invoice.fcAmount) : "-",
                VoucheDate: invoice.lcAmount ? formatCurrency(invoice.lcAmount) : "-",
                discount: invoice.excess ? formatCurrency(invoice.excess) : "-",
                Amount: invoice.balAmount ? formatCurrency(invoice.balAmount) : "-",
                vat: invoice.vat ? formatCurrency(invoice.vat) : "-",
                wht: invoice.wht ? formatCurrency(invoice.wht) : "-",
                comsub: invoice.comsub,
                totalAmount: formatCurrency(invoice.totalAmount ?? 0),
                checkbooks: invoice.checkbooks || [],
                rawData: invoice,
              }));
              setInvoiceListData(transformedData);
            }
          } else {
            console.error(
              "Failed to fetch invoice list by customer code:",
              result.error
            );
            toastRef.current?.showToast({
              severity: "error",
              summary: t("common.error"),
              detail:
                result.error || t("paymentVoucher.failedToLoadDisbursementDetails"),
            });
          }
        }
      } catch (error) {
        console.error("Error fetching disbursement details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDisbursementDetails();
  }, [disbursementId, dispatch, payeeTypeFromState, referrerIdFromState]);

  useEffect(() => {
    if (EditID != null) {
      setFormikValues();
    }
  }, [EditID]);
  const setFormikValues = () => {
    console.log("find action");
    const targetInvoice = invoiceListData.find((item) => item.id === EditID);
    console.log(targetInvoice, "find data");
    const fcAmount = targetInvoice?.fcamount;
    const discount = targetInvoice?.discount;
    const vat = targetInvoice?.vat;
    const wht = targetInvoice?.wht;
    const updatedValues = {
      fcAmount: `${fcAmount}`,
      discount: `${discount}`,
      vat: `${vat}`,
      wht: `${wht}`,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const initialValues = {
    fcAmount: "",
    discount: "",
    vat: "",
    wht: "",
  };
  const handleSubmit = (values) => {
    setSelectedProducts([]);
    const valueWithId = {
      ...values,
      id: EditID,
    };
    dispatch(patchpaymentVocherInvoiceListMiddleware(valueWithId));
    toastRef.current.showToast();
    {
      setTimeout(() => {}, 3000);
    }
    setVisible(false);
  };

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: handleSubmit,
  });

  const navigate = useNavigate();
  const items = [
    {
      label: t("paymentVoucher.title"),
      command: () => navigate("/accounts/paymentvoucher"),
    },
    { label: t("paymentVoucher.createDisbursement") },
  ];
  const home = { label: t("paymentVoucher.accounts") };

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
    width: "9rem",
    // backgroundColor: 'red',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    // padding: 4,
    color: "#000",
    border: "none",
    padding: "1rem",
    margin: 20,
  };

  if (loading) {
    return (
      <div className="overall__specific__container">
        <div className="loading-message">{t("paymentVoucher.loadingDisbursementDetails")}</div>
      </div>
    );
  }

  // if (!disbursementData) {
  //   return (
  //     <div className="overall__specific__container">
  //       <div className="error-message">
  //         Failed to load disbursement details.
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="overall__specific__container">
      <CustomToast
        ref={toastRef}
        message={t("paymentVoucher.invoiceDetailsUpdatedSuccess")}
      />
      <div>
        <span
          onClick={() => Navigate("/accounts/paymentvoucher")}
          style={{ cursor: "pointer" }}
        >
          <SvgBackicon />
        </span>
        <label className="label_header">{t("paymentVoucher.createDisbursement")}</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <label className="headlist_lable">{t("paymentVoucher.invoiceList")}</label>

      <div className="tablegap_container">
        <DataTable
          value={invoiceListData}
          tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
          paginator
          rows={5}
          rowsPerPageOptions={[5, 10, 25, 50]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          scrollable={true}
          scrollHeight="40vh"
          selection={selectedProducts}
          onSelectionChange={(e) => setSelectedProducts(e.value)}
          selectionMode="checkbox"
          dataKey="id"
        >
          <Column
            selectionMode="multiple"
            headerStyle={{ width: "4rem", border: "0px solid #e5e7eb" }}
            style={{ textAlign: "center" }}
          ></Column>
          <Column
            field="VoucherNumber"
            header={t("paymentVoucher.payables")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="TransactionNumber"
            header={t("paymentVoucher.outstanding")}
            sortable
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="fcamount"
            header={t("paymentVoucher.fcAmount")}
            style={{ width: "20rem" }}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="VoucheDate"
            header={t("paymentVoucher.lcAmount")}
            style={{ width: "20rem" }}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="discount"
            header={t("paymentVoucher.excessDiscounts")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="Amount"
            header={t("paymentVoucher.balOsAmount")}
            style={{ width: "20rem" }}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          {isAgentPayee ? (
            <Column
              field="comsub"
              header="COMSUB(GROSS)"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(row) => {
                const n = Number(row.comsub ?? row.rawData?.comsub);
                if (Number.isNaN(n)) return "-";
                return formatCurrency(n);
              }}
            ></Column>
          ) : null}
          <Column
            field="vat"
            header={t("paymentVoucher.vatPercent")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="wht"
            header={t("paymentVoucher.whtPercent")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="totalAmount"
            header={t("paymentVoucher.totalAmount")}
            style={{ width: "20rem" }}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
        </DataTable>
      </div>

      <div className="next_container">
        <Button
          label={t("paymentVoucher.next")}
          className="submitbutton_container"
          onClick={() => handlebankdetail()}
          disabled={selectedProducts.length === 0}
        />
      </div>

      <Dialog
        header={t("paymentVoucher.invoiceDetails")}
        visible={visible}
        className="dialog_fields"
        onHide={() => setVisible(false)}
      >
        <div class="grid">
          <div class="sm-col-12  md:col-6 lg-col-6">
            <InputField
              disabled={true}
              classNames="field__container"
              label={t("paymentVoucher.policy")}
              value="Motor"
            />
          </div>
          <div class="sm-col-12  md:col-6 lg-col-6">
            <InputField
              disabled={true}
              classNames="field__container"
              label={t("paymentVoucher.outstanding")}
              value="4000.00"
            />
          </div>
        </div>
        <div class="grid">
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("paymentVoucher.fcAmount")}
              value={formik.values.fcAmount}
              onChange={formik.handleChange("fcAmount")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("paymentVoucher.excessDiscounts")}
              value={formik.values.discount}
              onChange={formik.handleChange("discount")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("paymentVoucher.vatPercent")}
              value={formik.values.vat}
              onChange={formik.handleChange("vat")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("paymentVoucher.whtPercent")}
              value={formik.values.wht}
              onChange={formik.handleChange("wht")}
            />
          </div>
        </div>
        <div className="update_btn">
          <Button
            label={t("paymentVoucher.update")}
            className="update_btnlabel"
            onClick={formik.handleSubmit}
            // onClick={() => setVisible(false)}
          />
        </div>
      </Dialog>
    </div>
  );
}

export default SpecificVoucher;
