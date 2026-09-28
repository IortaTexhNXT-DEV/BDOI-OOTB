import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SubmitButton from "../../../components/SubmitButton";
import SvgDot from "../../../assets/icons/SvgDot";
import DropDowns from "../../../components/DropDowns";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate, useLocation } from "react-router-dom";
import NavBar from "../../../components/NavBar";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import DatePicker from "../../../components/DatePicker";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../components/LabelWrapper";
import { useFormik } from "formik";
import { Toast } from "primereact/toast";

import { useDispatch, useSelector } from "react-redux";
import {
  postpaymentVocherCreateDataMiddleware,
  paymentVocherMiddleware,
} from "../store/paymentVocherMiddleware";
import mastersService from "../../../services/mastersService";
import clientService from "../../../services/clientService";
import policyService from "../../../services/policyService";
import CommissionService from "../../../services/commissionService";

const initialValues = {
  VoucherDate: new Date(),
  DepartmentCode: "",
  BranchCode: "",
  PayeeType: "",
  Criteria: "",
  AgentReferrer: "",
  CustomerCode: "",
  CustomerName: "",
  Insurer: "",
  PolicyNumber: "",
  Transactioncode: "",
  TransactionDescription: "",
  SelectInstrumentCurrency: "",
  Remarks: "",
};

/** Master options as { name, code } for the dropdowns of this form. */
const toNameCode = (option) => ({ name: option.label, code: option.code });

const getInsurerOptionsForPolicy = (selectedPolicy, allInsurers) => {
  if (!selectedPolicy) {
    return allInsurers;
  }

  const names = [];
  const primary = selectedPolicy.insuranceCompanyName;
  if (primary && String(primary).trim()) {
    names.push(String(primary).trim());
  }

  const participants =
    selectedPolicy.participantDetails ||
    selectedPolicy.quotation?.participantDetails ||
    [];
  if (Array.isArray(participants)) {
    participants.forEach((participant) => {
      const name = participant?.insuranceCompanyName;
      if (name && String(name).trim()) {
        names.push(String(name).trim());
      }
    });
  }

  const seen = new Set();
  const unique = [];
  names.forEach((name) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ name, code: name });
    }
  });

  return unique;
};

function Createvoucher() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const Navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientsData, setClientsData] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [policyOptions, setPolicyOptions] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyFilterValue, setPolicyFilterValue] = useState("");
  const [referrerOptions, setReferrerOptions] = useState([]);
  const [referrersLoading, setReferrersLoading] = useState(false);
  const toast = useRef(null);
  const policyFilterTimeoutRef = useRef(null);
  const policyFilterRequestIdRef = useRef(0);
  const preselectAppliedRef = useRef(false);

  // Fetch disbursements data to extract customer codes
  useEffect(() => {
    dispatch(paymentVocherMiddleware({ page: 1, pageSize: 100 })); // Fetch more records to get more customer codes
  }, [dispatch]);

  // Fetch agents/referrers (same list as Commission & Referral)
  useEffect(() => {
    const fetchReferrers = async () => {
      setReferrersLoading(true);
      try {
        const res = await CommissionService.getReferrerAccounts();
        const data = res?.data || res;
        const list = data?.referrers || [];
        setReferrerOptions(
          list.map((r) => ({
            name: r.name,
            code: r.id,
            type: r.type,
            level: r.level,
          }))
        );
      } catch (error) {
        console.error("Error fetching referrers:", error);
        setReferrerOptions([]);
      } finally {
        setReferrersLoading(false);
      }
    };
    fetchReferrers();
  }, []);

  // Fetch clients data from API
  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const response = await clientService.getClients(1, 1000); // Fetch more clients for dropdown
        if (response.success && response.data?.data?.clients) {
          setClientsData(response.data.data.clients);
        } else {
          console.error("Failed to fetch clients:", response.error);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
  }, []);

  const loadPolicyOptions = async (clientId, query = "") => {
    const requestId = ++policyFilterRequestIdRef.current;
    setPoliciesLoading(true);
    try {
      const filters = {};
      if (clientId) filters.clientId = clientId;
      if (query) filters.query = query;

      const result = await policyService.getPolicies(1, 10, filters);
      // Ignore stale responses from older keystrokes
      if (requestId !== policyFilterRequestIdRef.current) return;

      if (result.success) {
        const policiesData =
          result.data?.data || result.data?.policies || result.data || [];
        const list = Array.isArray(policiesData) ? policiesData : [];
        setPolicyOptions(
          list
            .map((policy) => {
              const policyNumber = policy.policyNumber || policy.policyNo || "";
              if (!policyNumber) return null;
              return {
                name: policyNumber,
                code: policyNumber,
                policyId: policy.policyId || policy.id,
                insuranceCompanyName: policy.insuranceCompanyName || "",
                participantDetails:
                  policy.quotation?.participantDetails ||
                  policy.participantDetails ||
                  [],
              };
            })
            .filter(Boolean)
        );
      } else {
        setPolicyOptions([]);
      }
    } catch (error) {
      if (requestId !== policyFilterRequestIdRef.current) return;
      console.error("Error fetching policies:", error);
      setPolicyOptions([]);
    } finally {
      if (requestId === policyFilterRequestIdRef.current) {
        setPoliciesLoading(false);
      }
    }
  };

  // Initial policy load (10 policies, no customer filter)
  useEffect(() => {
    loadPolicyOptions();
    return () => {
      if (policyFilterTimeoutRef.current) {
        clearTimeout(policyFilterTimeoutRef.current);
      }
    };
  }, []);

  const [masterOptions, setMasterOptions] = useState({
    departments: [],
    branches: [],
    insurers: [],
    currencies: [],
  });
  useEffect(() => {
    const load = (type) =>
      mastersService.options(type).then((rows) => rows.map(toNameCode)).catch(() => []);
    Promise.all(["department", "branch", "insurance-company", "currency"].map(load)).then(
      ([departments, branches, insurers, currencies]) =>
        setMasterOptions({ departments, branches, insurers, currencies })
    );
  }, []);
  const DepartmentCode = masterOptions.departments;
  const BranchCode = masterOptions.branches;
  const PayeeType = [
    { name: "Customer", code: "Customer" },
    { name: "Insurer", code: "Insurer" },
    { name: "Agent/Referrer", code: "Agent/Referrer" },
    { name: "Supplier", code: "Supplier" },
  ];
  const Criteria = [
    { name: "Specific", code: "Specific" },
    { name: "Payall", code: "Payall" },
  ];
  const TRANSACTION_OPTIONS_BY_PAYEE = {
    Insurer: [{ name: "REMT – Remittance", code: "REMT" }],
    "Agent/Referrer": [
      { name: "COMM – Commission Payout", code: "COMM" },
      { name: "COMSUB – Comsub Payout", code: "COMSUB" },
      { name: "Incent – Incentive", code: "Incent" },
    ],
    Customer: [
      { name: "REFUND – Premium Refund", code: "REFUND" },
      { name: "CLM – Claim Settlement", code: "CLM" },
      { name: "EXCESS – Excess Refund", code: "EXCESS" },
    ],
    Supplier: [
      { name: "PRM", code: "PRM" },
      { name: "COMM", code: "COMM" },
      { name: "REMT", code: "REMT" },
    ],
  };
  const SelectInstrumentCurrency = masterOptions.currencies;
  const navigate = useNavigate();
  const home = { label: t("paymentVoucher.accounts") };
  const items = [
    {
      label: t("paymentVoucher.title"),
      command: () => navigate("/accounts/paymentvoucher"),
    },
    {
      label: t("paymentVoucher.createDisbursement"),
      to: "/accounts/paymentvoucher/createvoucher",
    },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const { paymentVocherList, loading } = useSelector(
    ({ paymentVoucherReducers }) => {
      return {
        loading: paymentVoucherReducers?.loading,
        paymentVocherList: paymentVoucherReducers?.paymentVocherList,
      };
    }
  );

  // Transform clients data to dropdown options for Customer Code
  const getCustomerCodeOptions = () => {
    return clientsData.map((client) => ({
      name: client.generatedClientId || client.clientId,
      code: client.generatedClientId || client.clientId,
      clientId: client.clientId,
      firstName: client.firstName,
      lastName: client.lastName,
      companyName: client.companyName,
    }));
  };

  // Function to get customer names based on selected customer code from API data
  const getCustomerNamesFromAPI = (customerCode) => {
    if (!customerCode || !clientsData.length) return [];

    const code =
      typeof customerCode === "object" ? customerCode.code : customerCode;
    const selectedClient = clientsData.find(
      (client) => (client.generatedClientId || client.clientId) === code
    );

    if (!selectedClient) return [];

    // Return only the combined first name and last name
    const fullName = `${selectedClient.firstName || ""} ${selectedClient.lastName || ""
      }`.trim();

    // Only return the full name if it's not empty
    if (fullName) {
      return [{ name: fullName, code: fullName }];
    }

    return [];
  };

  // Function to get customer names based on selected customer code
  const getCustomerNames = (customerCode) => {
    return getCustomerNamesFromAPI(customerCode);
  };

  // Handle customer code change - reset customer name and policy when customer code changes
  const handleCustomerCodeChange = (e) => {
    formik.setFieldValue("CustomerCode", e.value);
    formik.setFieldValue("CustomerName", "");
    formik.setFieldValue("PolicyNumber", "");
    setPolicyFilterValue("");
    const clientId = e.value?.clientId || null;
    loadPolicyOptions(clientId);
  };

  // Handle payee type change - reset related fields when payee type changes
  const handlePayeeTypeChange = (e) => {
    formik.setFieldValue("PayeeType", e.value);
    formik.setFieldValue("AgentReferrer", "");
    formik.setFieldValue("CustomerCode", "");
    formik.setFieldValue("CustomerName", "");
    formik.setFieldValue("Insurer", "");
    formik.setFieldValue("PolicyNumber", "");
    formik.setFieldValue("Transactioncode", "");
    setPolicyFilterValue("");
    loadPolicyOptions();
  };

  const handleAgentReferrerChange = (e) => {
    formik.setFieldValue("AgentReferrer", e.value);
  };

  const handlePolicyFilter = (event) => {
    const query = event?.filter ?? "";
    setPolicyFilterValue(query);
    if (policyFilterTimeoutRef.current) {
      clearTimeout(policyFilterTimeoutRef.current);
    }
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed.length < 3) {
      return;
    }
    policyFilterTimeoutRef.current = setTimeout(() => {
      const clientId = formik.values.CustomerCode?.clientId || null;
      loadPolicyOptions(clientId, trimmed);
    }, 300);
  };

  const handleSubmit = async (value) => {
    setIsSubmitting(true);

    try {
      const result = await dispatch(
        postpaymentVocherCreateDataMiddleware(value)
      );

      if (!result.type?.endsWith("/fulfilled")) {
        throw new Error(result.error?.message || "Failed to create disbursement");
      }

      const created = result.payload?.disbursementData?.data || result.payload?.disbursementData;
      const disbursementId =
        created?.disbursementId || created?.id || value?.AgentReferrer?.code;

      const disbursementData = {
        ...value,
        disbursementId,
        voucherNumber: created?.voucherNumber,
        referrerId: value.AgentReferrer?.code,
        referrerName: value.AgentReferrer?.name,
      };

      Navigate(`/accounts/paymentvoucher/invoicelist/${disbursementId}`, {
        state: { disbursementData },
      });
    } catch (error) {
      console.error("Error creating disbursement:", error);
      toast.current?.show({
        severity: "error",
        summary: t("common.error"),
        detail: error.message || t("paymentVoucher.unexpectedError"),
        life: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const customValidation = (values) => {
    const errors = {};
    const payeeCode =
      typeof values.PayeeType === "object"
        ? values.PayeeType?.code
        : values.PayeeType;
    const isInsurerPayee = payeeCode === "Insurer";
    const isAgentPayee = payeeCode === "Agent/Referrer";

    if (!values.DepartmentCode) {
      errors.DepartmentCode = t("paymentVoucher.thisFieldCodeRequired");
    }
    if (!values.BranchCode) {
      errors.BranchCode = t("paymentVoucher.thisFieldRequired");
    }
    if (!values.PayeeType) {
      errors.PayeeType = t("paymentVoucher.thisFieldRequired");
    }
    if (!values.Criteria) {
      errors.Criteria = t("paymentVoucher.thisFieldRequired");
    }
    if (isAgentPayee && !values.AgentReferrer) {
      errors.AgentReferrer = t("paymentVoucher.thisFieldRequired");
    }
    // Agent commission payouts are not tied to one customer, so the customer is optional there.
    if (!isInsurerPayee) {
      if (!isAgentPayee && !values.CustomerCode) {
        errors.CustomerCode = t("paymentVoucher.thisFieldRequired");
      }
      if (!values.CustomerName && values.CustomerCode) {
        errors.CustomerName = t(
          "paymentVoucher.customerNameRequiredWhenCodeSelected"
        );
      }
    }
    if (!values.Transactioncode) {
      errors.Transactioncode = t("paymentVoucher.thisFieldRequired");
    }
    if (!values.SelectInstrumentCurrency) {
      errors.SelectInstrumentCurrency = t("paymentVoucher.thisFieldRequired");
    }
    return errors;
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: handleSubmit,
  });

  // Pre-select agent from Generate payout / navigation state
  useEffect(() => {
    if (preselectAppliedRef.current || referrerOptions.length === 0) return;
    const preselectedId =
      location.state?.preselectedReferrerId ||
      location.state?.referrerId;
    if (!preselectedId) return;
    const match = referrerOptions.find((r) => r.code === preselectedId);
    if (!match) return;
    preselectAppliedRef.current = true;
    formik.setFieldValue("PayeeType", {
      name: "Agent/Referrer",
      code: "Agent/Referrer",
    });
    formik.setFieldValue("AgentReferrer", match);
    if (!formik.values.Criteria) {
      formik.setFieldValue("Criteria", { name: "Specific", code: "Specific" });
    }
    if (!formik.values.Transactioncode) {
      formik.setFieldValue("Transactioncode", {
        name: "COMSUB – Comsub Payout",
        code: "COMSUB",
      });
    }
  }, [referrerOptions, location.state]);

  const transactionCodeOptions = useMemo(() => {
    const payeeCode =
      typeof formik.values.PayeeType === "object"
        ? formik.values.PayeeType?.code
        : formik.values.PayeeType;
    return TRANSACTION_OPTIONS_BY_PAYEE[payeeCode] || [];
  }, [formik.values.PayeeType]);

  const isInsurerPayee = useMemo(() => {
    const payeeCode =
      typeof formik.values.PayeeType === "object"
        ? formik.values.PayeeType?.code
        : formik.values.PayeeType;
    return payeeCode === "Insurer";
  }, [formik.values.PayeeType]);

  const isAgentPayee = useMemo(() => {
    const payeeCode =
      typeof formik.values.PayeeType === "object"
        ? formik.values.PayeeType?.code
        : formik.values.PayeeType;
    return payeeCode === "Agent/Referrer";
  }, [formik.values.PayeeType]);

  const showCustomerFields =
    !isInsurerPayee &&
    (isAgentPayee ||
      formik.values.Criteria === "" ||
      formik.values.Criteria?.name === "Specific");

  const showAgentReferrerField =
    isAgentPayee &&
    (formik.values.Criteria === "" ||
      formik.values.Criteria?.name === "Specific" ||
      formik.values.Criteria?.name === "Payall");

  const insurerOptions = useMemo(
    () =>
      getInsurerOptionsForPolicy(
        formik.values.PolicyNumber || null,
        masterOptions.insurers
      ),
    [formik.values.PolicyNumber, masterOptions.insurers]
  );

  const handlePolicyNumberChange = (e) => {
    formik.setFieldValue("PolicyNumber", e.value);
    formik.setFieldValue("Insurer", "");
    if (e.value) setPolicyFilterValue("");
  };

  return (
    <div className="overall__createvoucher__container">
      <Toast ref={toast} />
      <div>
        <span onClick={() => Navigate(-1)}>
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

      <Card>
        <div class="grid">
          <div class="sm-col-12  md:col-3 lg-col-4 col-offset-9">
            <LabelWrapper className="calenderlable__container">
              {t("paymentVoucher.disbursementDate")}
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={formik.values.VoucherDate}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("VoucherDate", e.target.value);
              }}
              dateFormat="yy-mm-dd"
              disabled={true}
            />
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.departmentCode")}
                value={formik.values.DepartmentCode}
                onChange={(e) =>
                  formik.setFieldValue("DepartmentCode", e.value)
                }
                options={DepartmentCode}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.DepartmentCode &&
                formik.errors.DepartmentCode && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.DepartmentCode}
                  </div>
                )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.branchCode")}
                value={formik.values.BranchCode}
                onChange={(e) => formik.setFieldValue("BranchCode", e.value)}
                options={BranchCode}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.BranchCode && formik.errors.BranchCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.BranchCode}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12  md:col-3 lg-col-4">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.payeeType")}
                value={formik.values.PayeeType}
                onChange={handlePayeeTypeChange}
                options={PayeeType}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.PayeeType && formik.errors.PayeeType && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.PayeeType}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.criteria")}
                value={formik.values.Criteria}
                onChange={(e) => formik.setFieldValue("Criteria", e.value)}
                options={Criteria}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.Criteria && formik.errors.Criteria && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.Criteria}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid">
          {showAgentReferrerField ? (
            <div className="col-3 md:col-3 lg-col-3">
              <DropDowns
                className="dropdown__container"
                label="Agent/Referrer"
                value={formik.values.AgentReferrer}
                onChange={handleAgentReferrerChange}
                options={referrerOptions}
                optionLabel="name"
                placeholder={
                  referrersLoading ? t("common.loading") : t("paymentVoucher.select")
                }
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={referrersLoading}
              />
              {formik.touched.AgentReferrer && formik.errors.AgentReferrer && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.AgentReferrer}
                </div>
              )}
            </div>
          ) : null}
          {showCustomerFields ? (
            <>
              <div className="col-3 md:col-3 lg-col-3">
                <DropDowns
                  className="dropdown__container"
                  label={isAgentPayee ? `${t("paymentVoucher.customerCode")} (Optional)` : t("paymentVoucher.customerCode")}
                  value={formik.values.CustomerCode}
                  onChange={handleCustomerCodeChange}
                  options={getCustomerCodeOptions()}
                  optionLabel="name"
                  placeholder={clientsLoading ? t("common.loading") : t("paymentVoucher.select")}
                  dropdownIcon={<SvgDropdown color={"#000"} />}
                  disabled={clientsLoading}
                />
                {formik.touched.CustomerCode && formik.errors.CustomerCode && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.CustomerCode}
                  </div>
                )}
              </div>
              <div className="col-3 md:col-3 lg-col-3">
                <DropDowns
                  className="dropdown__container"
                  label={isAgentPayee ? `${t("paymentVoucher.customerName")} (Optional)` : t("paymentVoucher.customerName")}
                  value={formik.values.CustomerName}
                  onChange={formik.handleChange("CustomerName")}
                  options={getCustomerNames(formik.values.CustomerCode)}
                  optionLabel="name"
                  placeholder={t("paymentVoucher.select")}
                  dropdownIcon={<SvgDropdown color={"#000"} />}
                  disabled={!formik.values.CustomerCode}
                />
                {formik.touched.CustomerName &&
                  formik.errors.CustomerName && (
                    <div style={{ fontSize: 12, color: "red" }}>
                      {formik.errors.CustomerName}
                    </div>
                  )}
              </div>
            </>
          ) : null}
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label={t("paymentVoucher.policyNumber")}
              value={formik.values.PolicyNumber}
              onChange={handlePolicyNumberChange}
              onFilter={handlePolicyFilter}
              filterValue={policyFilterValue}
              options={policyOptions}
              optionLabel="name"
              placeholder={t("paymentVoucher.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          {isInsurerPayee ? (
            <div className="col-3 md:col-3 lg-col-3">
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.insurer")}
                value={formik.values.Insurer}
                onChange={(e) => formik.setFieldValue("Insurer", e.value)}
                options={insurerOptions}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          ) : null}
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label={t("paymentVoucher.transactionType")}
              value={formik.values.Transactioncode}
              onChange={(e) => formik.setFieldValue("Transactioncode", e.value)}
              options={transactionCodeOptions}
              optionLabel="name"
              placeholder={t("paymentVoucher.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={!formik.values.PayeeType}
            />
            {formik.touched.Transactioncode &&
              formik.errors.Transactioncode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.Transactioncode}
                </div>
              )}
          </div>
          <div className="col-3 md:col-3 lg-col-3">
            <InputField
              disabled={true}
              classNames="field__container"
              label={t("paymentVoucher.paymentDescription")}
              value={
                formik.values.Transactioncode
                  ? t("paymentVoucher.paymentFor", { name: formik.values.Transactioncode?.name || "" })
                  : ""
              }
              onChange={formik.handleChange("TransactionDescription")}
            />
          </div>
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label={t("paymentVoucher.paymentCurrency")}
              value={formik.values.SelectInstrumentCurrency}
              onChange={(e) =>
                formik.setFieldValue("SelectInstrumentCurrency", e.value)
              }
              options={SelectInstrumentCurrency}
              optionLabel="name"
              placeholder={t("paymentVoucher.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.SelectInstrumentCurrency &&
              formik.errors.SelectInstrumentCurrency && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.SelectInstrumentCurrency}
                </div>
              )}
          </div>
          <div className="col-6 md:col-6 lg-col-6">
            <InputField
              classNames="field__container"
              label={t("paymentVoucher.paymentNotesOptional")}
              placeholder={t("paymentVoucher.enterPaymentNotes")}
              value={formik.values.Remarks}
              onChange={formik.handleChange("Remarks")}
            />
          </div>
        </div>
      </Card>

      <div className="next_container">
        <Button
          className="submit_button p-0"
          label={isSubmitting ? t("paymentVoucher.submitting") : t("paymentVoucher.next")}
          disabled={!formik.isValid || isSubmitting}
          onClick={() => {
            formik.handleSubmit();
          }}
        />
      </div>
    </div>
  );
}

export default Createvoucher;
