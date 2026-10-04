import { Card } from "primereact/card";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DropdownField from "../../../component/DropdownField";
import InputTextField from "../../../component/inputText";
import { Button } from "primereact/button";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { PolicyTypes, InstallmentType } from "../mock";
import useQuoteOptions from "./useQuoteOptions";
import useInsuranceCompanyOptions from "../../../component/useInsuranceCompanyOptions";
import { postPolicyDetailsMiddleware } from "../store/policyDetailsMiddleware";
import {
  setQuotePolicyDetails,
  setQuoteLeadRefId,
} from "../../Store/quotationReducer";
import { deleteCoInsurer } from "../store/policyDetailsReducer";
import { Checkbox } from "primereact/checkbox";
import DialogList from "./DialogList";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgUploadArrowIcon from "../../../../assets/icons/SvgUploadArrowIcon";
import useMotorTariff, { findVehicleClass } from "../../utils/useMotorTariff";
import { confirmAction, notifyWarn } from "../../../../utility/dialogs";

const PolicyDetailsCard = ({ action, flow, lead }) => {
  const { t } = useTranslation();
  const InsuranceCompanyOptions = useInsuranceCompanyOptions();
  const { id: leadRefId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Get Redux state
  const { currentQuoteCreation, TableList, leadtabledata } = useSelector(
    ({ quotationReducers, policydetailreducer, leadReducers }) => ({
      currentQuoteCreation: quotationReducers?.currentQuoteCreation,
      TableList: policydetailreducer?.TableList,
      leadtabledata: leadReducers?.leadtabledata,
    })
  );

  // Determine if we're in edit mode and get existing data
  const isEditMode = currentQuoteCreation?.isEditMode || false;
  const existingPolicyDetails = currentQuoteCreation?.policyDetails;
  const sanitizeInsuranceCompany = (value) =>
    value === "N/A" || value === "NA" ? "" : value || "";

  // Helper function to get form values
  const getFormValues = () => {
    // If editing and we have existing data in Redux, use that
    if (isEditMode && existingPolicyDetails) {
      return {
        InsuranceCompanyName: sanitizeInsuranceCompany(
          existingPolicyDetails.insuranceCompanyName
        ),
        InsurancePolicyType: existingPolicyDetails.insurancePolicyType || "",
        AccountCode: existingPolicyDetails.accountCode || "",
        VehicleBrand: existingPolicyDetails.vehicleBrand || "",
        VehicleType: existingPolicyDetails.vehicleType || "",
        ModelYear: existingPolicyDetails.modelYear || "",
        VehicleUse: existingPolicyDetails.vehicleUse || "",
        VehicleModel: existingPolicyDetails.vehicleModel || "",
        ModelVariant: existingPolicyDetails.modelVariant || "",
        VehicleColor: existingPolicyDetails.vehicleColor || "",
        SeatingCapacity: existingPolicyDetails.seatingCapacity || "",
        PaymentType: existingPolicyDetails.paymentType || "",
        InstallmentType: existingPolicyDetails.installmentType || "",
        PrimarySharePercentage:
          existingPolicyDetails.primarySharePercentage || "50",
      };
    }
    // Otherwise use empty values for create
    return {
      InsuranceCompanyName: "",
      InsurancePolicyType: "",
      AccountCode: "",
      VehicleBrand: "",
      VehicleType: "",
      ModelYear: "",
      VehicleUse: "",
      VehicleModel: "",
      ModelVariant: "",
      VehicleColor: "",
      SeatingCapacity: "",
      PaymentType: "",
      InstallmentType: "",
      PrimarySharePercentage: "50",
    };
  };

  const initialValue = getFormValues();
  const handleclick = (values) => {
    // Validate co-insurance setup
    if (checked) {
      if (!values.InsuranceCompanyName) {
        notifyWarn(t("agent.primaryInsuranceCompanyRequired"));
        return;
      }

      if (!TableList || TableList.length === 0) {
        notifyWarn(t("agent.addOneCoInsurerRequired"));
        return;
      }

      // Validate total share percentage = 100%
      const primaryShare = parseFloat(values.PrimarySharePercentage || 50);
      const coInsurerShares = TableList.reduce(
        (sum, p) =>
          sum + parseFloat(p.sharePercentage || p.Sharepercentage || 0),
        0
      );
      const totalShare = primaryShare + coInsurerShares;

      if (Math.abs(totalShare - 100) > 0.01) {
        notifyWarn(
          t("agent.totalShareMustBe100", {
            total: totalShare.toFixed(2),
            primary: primaryShare,
            coInsurers: coInsurerShares,
          })
        );
        return;
      }
    }

    // Store leadRefId in Redux if not already set
    if (leadRefId && !currentQuoteCreation.leadRefId) {
      dispatch(setQuoteLeadRefId(leadRefId));
    }

    // Prepare policy details data
    const policyDetailsData = {
      insuranceCompanyName: values.InsuranceCompanyName,
      insurancePolicyType: values.InsurancePolicyType,
      accountCode: values.AccountCode,
      vehicleBrand: values.VehicleBrand,
      vehicleType: values?.VehicleType,
      modelYear: values.ModelYear,
      vehicleUse: values.VehicleUse || null,
      vehicleModel: values.VehicleModel,
      modelVariant: values.ModelVariant,
      vehicleColor: values.VehicleColor,
      seatingCapacity: values.SeatingCapacity,
      paymentType: values.PaymentType,
      installmentType: values.InstallmentType || null,
      isCoInsurance: checked,
      primarySharePercentage: values.PrimarySharePercentage || null,
      participantDetails: TableList || [], // Include participant details for co-insurance
    };

    // Save to Redux state
    dispatch(setQuotePolicyDetails(policyDetailsData));

    // Also dispatch to old middleware for backward compatibility
    dispatch(postPolicyDetailsMiddleware(values));

    // Determine navigation path
    const currentPath = window.location.pathname;
    const isEditFlow = currentPath.includes("/editquote/");
    const idParam = isEditMode ? currentQuoteCreation.quotationId : leadRefId;
    const basePath = isEditFlow ? "/agent/editquote" : "/agent/createquote";
    const payloadState = {
      coInsurance: checked,
      installemtType: values.InstallmentType,
    };
    // Navigate to coverage details
    if (action === "quotedetails") {
      navigate(
        `${basePath}/coveragedetails/coveragedetail/${idParam}`,
        payloadState
      );
    } else {
      const propsState = {
        path: `${basePath}/coveragedetails/coveragecreate/${idParam}`,
        state: payloadState,
        quotationData: policyDetailsData,
        leadId: lead?.generatedLeadId || state?.lead?.generatedLeadId,
      };
      navigate("/agent/createquote/product-recommendation", {
        state: { ...propsState },
      });
      //implement a navigate to page for product recommendation
    }
  };

  const formik = useFormik({
    initialValues: initialValue,
    enableReinitialize: true, // Allow form to reinitialize when quotation data changes
    validate: (values) => {
      // CTPL (fixed tariff) and Auto Passenger PA are priced from the vehicle class and the seats.
      const errors = {};
      if (!values.VehicleType) errors.VehicleType = t("agent.vehicleTypeRequired");
      const seats = Number(values.SeatingCapacity);
      if (!Number.isInteger(seats) || seats < 1 || seats > 99) {
        errors.SeatingCapacity = t("agent.seatingCapacityInvalid");
      }
      return errors;
    },
    onSubmit: (values) => {
      handleclick(values);
    },
  });

  // Initialize checkboxes based on existing data
  const [checked, setChecked] = useState(
    existingPolicyDetails?.isCoInsurance || false
  );
  const [paychecked, setPayChecked] = useState(
    existingPolicyDetails?.installmentType ? true : false
  );
  const [visible, setVisible] = useState(false);

  // Insurance Commission vehicle classes from the motor tariff; older quotes stored the label, so map it to the code.
  const motorTariff = useMotorTariff();
  const vehicleTypeOptions = motorTariff.vehicleTypes.map(({ label, value }) => ({ label, value }));
  useEffect(() => {
    const cls = findVehicleClass(motorTariff, formik.values.VehicleType);
    if (cls && cls.value !== formik.values.VehicleType) formik.setFieldValue("VehicleType", cls.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motorTariff, formik.values.VehicleType]);

  const {
    policyTypeOptions,
    accountCodeOptions,
    brandOptions,
    modelOptions,
    variantOptions,
    modelYearOptions,
    colourOptions,
  } = useQuoteOptions({
    brand: formik.values.VehicleBrand,
    model: formik.values.VehicleModel,
    current: formik.values,
  });

  const category = leadtabledata[leadtabledata.length - 1]?.category;

  const isEmpty = TableList.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found" style={{ textAlign: "center" }}>
        {t("agent.noDataEntered")}
      </div>
    </div>
  );
  const Handleinsurance = () => {
    setVisible(true);
  };

  const handleDeleteCoInsurer = async (rowData) => {
    if (
      await confirmAction(
        t("agent.removeCoInsurerConfirm", {
          name: rowData.ParticipantName || "",
        })
      )
    ) {
      dispatch(deleteCoInsurer(rowData.id));
    }
  };

  const actionsTemplate = (rowData) => {
    return (
      <Button
        icon="pi pi-trash"
        className="p-button-rounded p-button-danger p-button-text"
        onClick={() => handleDeleteCoInsurer(rowData)}
        tooltip={t("agent.removeCoInsurer")}
        tooltipOptions={{ position: "top" }} aria-label={t("agent.removeCoInsurer")}
      />
    );
  };

  return (
    <div className="policy__details__card__container mt-4">
      <Card>
        <div className="heading__details_add">
          <div className="policy__details__card__container__title">
            {action === "quotedetails"
              ? t("agent.editQuote")
              : t("agent.createQuote")}
          </div>
          {category === "Corporate" && (
            <div className="card flex flex-wrap justify-content-spacebetween gap-13">
              <Button
                label={t("agent.upload")}
                icon={<SvgUploadArrowIcon />}
                style={{ gap: "8px", padding: 10 }}
              />
            </div>
          )}
        </div>
        {/* //changes */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="policy__details__card__container__sub__title mt-2 mb-2">
            {t("agent.policyDetailsLabel")}
          </div>
          <div className="flex align-items-center">
            <Checkbox
              id="co-insurance"
              onChange={(e) => setChecked(e.checked)}
              checked={checked}
            />
            <label htmlFor="co-insurance" className="ml-2">
              {t("agent.coInsurance")}
            </label>
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            <DropdownField
              label={t("agent.insuranceCompanyName")}
              value={formik.values.InsuranceCompanyName}
              options={InsuranceCompanyOptions}
              onChange={(e) => {
                formik.setFieldValue("InsuranceCompanyName", e.value);
              }}
              optionLabel="label"
              placeholder={t("agent.selectInsuranceCompany", "Select Insurance Company")}
            />
          </div>
        </div>

        {checked && (
          <div>
            <div className="grid mt-2">
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("agent.primaryInsurerShare")}
                  name="PrimarySharePercentage"
                  value={formik.values.PrimarySharePercentage}
                  onChange={formik.handleChange}
                  placeholder={t("agent.placeholderPrimaryShare")}
                />
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {t("agent.primaryInsurerShareHint")}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  paddingTop: 24,
                  paddingBottom: 28,
                  fontSize: 20,
                  fontWeight: "400",
                  fontFamily: "Nunito, Arial, sans-serif",
                }}
              >
                {t("agent.participantDetails")}
              </div>
              <Button
                style={{ marginTop: 24, marginBottom: 24 }}
                onClick={Handleinsurance}
              >
                {t("agent.addInsuranceCompany")}
              </Button>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <DataTable
                value={TableList}
                tableStyle={{ minWidth: "50rem" }}
                scrollable={true}
                scrollHeight="26vh"
                emptyMessage={isEmpty ? emptyTableIcon : null}
              >
                <Column
                  header={t("tables.participantName")}
                  field="ParticipantName"
                  style={{ paddingLeft: 20 }}
                ></Column>
                <Column
                  header={t("tables.siCurrency")}
                  field="SumInsuredcurrency"
                  style={{ paddingLeft: 20 }}
                ></Column>
                <Column
                  header={t("tables.premiumCurrency")}
                  field="Premiumcurrencys"
                  style={{ paddingLeft: 20 }}
                ></Column>
                <Column
                  header={t("tables.sharePercent")}
                  field="Sharepercentage"
                  style={{ paddingLeft: 20 }}
                ></Column>
                <Column
                  header={t("tables.actions")}
                  body={actionsTemplate}
                  style={{ paddingLeft: 20, width: "100px" }}
                  alignHeader="center"
                ></Column>
              </DataTable>
            </div>
          </div>
        )}

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.insurancePolicyType")}
              value={formik.values.InsurancePolicyType}
              options={policyTypeOptions}
              onChange={(e) => {
                formik.setFieldValue("InsurancePolicyType", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.InsurancePolicyType &&
              formik.errors.InsurancePolicyType && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.InsurancePolicyType}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.accountCode")}
              value={formik.values.AccountCode}
              options={accountCodeOptions}
              onChange={(e) => {
                formik.setFieldValue("AccountCode", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.AccountCode && formik.errors.AccountCode && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.AccountCode}
              </div>
            )}
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.paymentType")}
              value={formik.values.PaymentType}
              options={PolicyTypes}
              onChange={(e) => {
                formik.setFieldValue("PaymentType", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.PaymentType && formik.errors.PaymentType && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.PaymentType}
              </div>
            )}
          </div>
          {formik.values.PaymentType === "Credit" && (
            <div className="col-12 md:col-6 lg:col-6">
              <div
                className="flex align-items-center"
                style={{ alignItems: "center", display: "flex", height: 64 }}
              >
                <Checkbox
                  id="pay-installments"
                  onChange={(e) => setPayChecked(e.checked)}
                  checked={paychecked}
                />
                <label htmlFor="pay-installments" className="ml-2">
                  {t("agent.payInInstallments")}
                </label>
              </div>
            </div>
          )}
        </div>

        {paychecked && (
          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <DropdownField
                label={t("agent.installmentType")}
                value={formik.values.InstallmentType}
                options={InstallmentType}
                onChange={(e) => {
                  formik.setFieldValue("InstallmentType", e.value);
                }}
                optionLabel="label"
              />
              {formik.touched.InstallmentType &&
                formik.errors.InstallmentType && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                    {formik.errors.InstallmentType}
                  </div>
                )}
            </div>
          </div>
        )}

        <div className="policy__details__card__sub__title mt-2">
          {t("agent.insuranceVehicleDetails")}
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.vehicleType")}
              value={formik.values.VehicleType}
              options={vehicleTypeOptions}
              onChange={(e) => {
                formik.setFieldValue("VehicleType", e.value);
                const cls = findVehicleClass(motorTariff, e.value);
                if (cls?.defaultSeats && !formik.values.SeatingCapacity) {
                  formik.setFieldValue("SeatingCapacity", String(cls.defaultSeats));
                }
              }}
              optionLabel="label"
            />
            {formik.touched.VehicleType && formik.errors.VehicleType && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.VehicleType}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.vehicleBrand")}
              value={formik.values.VehicleBrand}
              options={brandOptions}
              onChange={(e) => {
                formik.setFieldValue("VehicleBrand", e.value);
                if (e.value !== formik.values.VehicleBrand) {
                  formik.setFieldValue("VehicleModel", "");
                  formik.setFieldValue("ModelVariant", "");
                }
              }}
              optionLabel="label"
            />
            {formik.touched.VehicleBrand && formik.errors.VehicleBrand && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.VehicleBrand}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {/* acceptance rules of the product test the vehicle use (e.g. a PUV is declined); empty = assumed from the vehicle class */}
            <DropdownField
              label={t("agent.vehicleUse")}
              value={formik.values.VehicleUse}
              options={["Private", "Commercial", "PUV", "TNVS"].map((v) => ({ label: t(`agent.vehicleUses.${v}`), value: v }))}
              onChange={(e) => formik.setFieldValue("VehicleUse", e.value)}
              optionLabel="label"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.modelYear")}
              value={formik.values.ModelYear}
              options={modelYearOptions}
              onChange={(e) => {
                formik.setFieldValue("ModelYear", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.ModelYear && formik.errors.ModelYear && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.ModelYear}
              </div>
            )}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.vehicleModel")}
              value={formik.values.VehicleModel}
              options={modelOptions}
              onChange={(e) => {
                formik.setFieldValue("VehicleModel", e.value);
                if (e.value !== formik.values.VehicleModel) {
                  formik.setFieldValue("ModelVariant", "");
                }
              }}
              optionLabel="label"
            />
            {formik.touched.VehicleModel && formik.errors.VehicleModel && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.VehicleModel}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.modelVariant")}
              value={formik.values.ModelVariant}
              options={variantOptions}
              onChange={(e) => {
                formik.setFieldValue("ModelVariant", e.value);
                const seating = variantOptions.find((v) => v.value === e.value)?.seatingCapacity;
                if (seating && !formik.values.SeatingCapacity) {
                  formik.setFieldValue("SeatingCapacity", String(seating));
                }
              }}
              optionLabel="label"
            />
            {formik.touched.ModelVariant && formik.errors.ModelVariant && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.ModelVariant}
              </div>
            )}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("agent.vehicleColor")}
              value={formik.values.VehicleColor}
              options={colourOptions}
              onChange={(e) => {
                formik.setFieldValue("VehicleColor", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.VehicleColor && formik.errors.VehicleColor && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.VehicleColor}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("agent.seatingCapacity")}
              value={formik.values.SeatingCapacity}
              onChange={formik.handleChange("SeatingCapacity")}
            />
            {formik.touched.SeatingCapacity &&
              formik.errors.SeatingCapacity && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.SeatingCapacity}
                </div>
              )}
          </div>
        </div>
        <div className="policy__details__card__btn__container">
          <div className="next__btn__container">
            <Button
              className="next__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
            >
              {t("agent.next")}
            </Button>
          </div>
        </div>
      </Card>

      <DialogList setVisible={setVisible} visible={visible} />
    </div>
  );
};

export default PolicyDetailsCard;
