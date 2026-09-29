import { Card } from "primereact/card";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import InputTextField from "../../../component/inputText";
import DropdownField from "../../../component/DropdwonField";
import DatepickerField from "../../../component/datePicker";
import useInsuranceCompanyOptions from "../../../component/useInsuranceCompanyOptions";
import { Button } from "primereact/button";
import { useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../../components/Toast";
import customHistory from "../../../../routes/customHistory";
import { useFormik } from "formik";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import SvgTable from "../../../../assets/icons/SvgTable";
import S3FileUpload from "../../../../components/S3FileUpload";
import policyService from "../../../../services/policyService";
import { useSelector } from "react-redux";
import { notifyError, notifyWarn } from "../../../../utility/dialogs";
import logger from "../../../../utility/logger";

const UploadPolicyCard = ({
  state,
  quotationDetails,
  quotationId: propQuotationId,
  policyId: policyIdProp,
  leadNumber,
}) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const InsuranceCompanyOptions = useInsuranceCompanyOptions();
  const [policyDocumentUrl, setPolicyDocumentUrl] = useState(null);
  const [showUploadError, setShowUploadError] = useState(false);
  const [resolvedPolicyData, setResolvedPolicyData] = useState(
    state?.policyData || null
  );
  const [resolvingPolicy, setResolvingPolicy] = useState(false);
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const { quotationId: urlQuotationId } = useParams();

  // Extract customer info and vehicle photos from state
  const customerInfo = state?.customerInfo || {};
  const vehiclePhotos = state?.vehiclePhotos || {};
  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
    })
  );

  const clientId =
    state?.ClientId ||
    state?.clientId ||
    policydetailedlist?.ClientId ||
    policydetailedlist?.clientId;


  const policyIdFromState = useMemo(() => {
    return (
      policyIdProp ||
      state?.policyId ||
      state?.policyData?.policyId ||
      state?.policyData?.id ||
      state?.policy?.policyId ||
      state?.policy?.id ||
      null
    );
  }, [policyIdProp, state?.policyId, state?.policyData, state?.policy]);

  useEffect(() => {
    if (resolvedPolicyData || !policyIdFromState) {
      return;
    }

    const fetchPolicy = async () => {
      setResolvingPolicy(true);
      try {
        const response = await policyService.getPolicyDetails(
          policyIdFromState
        );
        if (response.success && response.data) {
          setResolvedPolicyData(response.data);
        }
      } catch (error) {
        logger.error(
          "Failed to fetch policy details for upload screen:",
          error
        );
      } finally {
        setResolvingPolicy(false);
      }
    };

    fetchPolicy();
  }, [policyIdFromState, resolvedPolicyData]);

  const handlePayLater = async (value) => {
    // Validate policy document upload
    if (!policyDocumentUrl) {
      setShowUploadError(true);
      notifyWarn(t("agent.pleaseUploadPolicy"));
      // Scroll to upload section
      document
        .querySelector(".upload__policy__card__sub__title")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      return;
    }

    // Validate policy form data
    if (!value.PolicyNumber || !value.InsuranceCompany) {
      notifyWarn(t("agent.pleaseFillRequired"));
      return;
    }

    // Clear error if validation passes
    setShowUploadError(false);

    // Prepare additional policy data from the form and uploaded documents
    const additionalPolicyData = {
      // Policy form fields
      policyNumber: value.PolicyNumber,
      insuranceCompanyName: value.InsuranceCompany,
      production: value.Production?.toISOString?.() || value.Production,
      inception: value.Inception?.toISOString?.() || value.Inception,
      issuedDate: value.IssuedDate?.toISOString?.() || value.IssuedDate,
      expiry: value.Expiry?.toISOString?.() || value.Expiry,

      // Customer info fields from previous step (Motor + Fire)
      idCardNumber: customerInfo.IdCardNumber,
      insuredName: customerInfo.insuredName || customerInfo.InsuredName || state?.insuredName,
      motorNumber: customerInfo.MotorNumber,
      chassisNumber: customerInfo.ChassisNumber,
      mortgage: customerInfo.Mortgage,
      certNumber: customerInfo.CertNumber,
      plateNumber: customerInfo.PlateNumber,
      MvFileNumber: customerInfo.MVFileNumber,
      authenCode: customerInfo.AuthenCode,
      aluminum: customerInfo.Aluminium,
      airBag: customerInfo.AirBag,
      TNVS: customerInfo.TNVS,
      truckType: customerInfo.TruckType,

      // Vehicle photos from previous step (map to flat structure)
      vehicleLeftSidePhoto: vehiclePhotos.leftSide,
      vehicleRightSidePhoto: vehiclePhotos.rightSide,
      vehicleFrontSidePhoto: vehiclePhotos.front,
      vehicleRearSidePhoto: vehiclePhotos.rear,
      vehicleInteriorDashboardPhoto: vehiclePhotos.interior,

      // Policy document
      policyDocument: policyDocumentUrl,
      paymentStatus: "Pending",
    };

    // Get quotation ID - prioritize URL param as source of truth
    const detailsQuotationId =
      quotationDetails?.quotationId || quotationDetails?.id;
    const quotationId = propQuotationId || urlQuotationId || detailsQuotationId;

    if (!quotationId) {
      notifyWarn(t("agent.quotationIdMissing"));
      return;
    }

    // Get existing policy ID (should always exist at this point)
    const existingPolicyId =
      policyIdFromState ||
      resolvedPolicyData?.policyId ||
      resolvedPolicyData?.id;

    if (!existingPolicyId) {
      notifyError(t("agent.policyNotFound"));
      return;
    }

    try {
      // Update the existing policy with new details
      const updatePayload = {
        policyNumber: additionalPolicyData.policyNumber,
        insuranceCompanyName: additionalPolicyData.insuranceCompanyName,
        production: additionalPolicyData.production,
        inception: additionalPolicyData.inception,
        issuedDate: additionalPolicyData.issuedDate,
        expiry: additionalPolicyData.expiry,
        idCardNumber: additionalPolicyData.idCardNumber,
        insuredName: additionalPolicyData.insuredName,
        motorNumber: additionalPolicyData.motorNumber,
        chassisNumber: additionalPolicyData.chassisNumber,
        mortgage: additionalPolicyData.mortgage,
        certNumber: additionalPolicyData.certNumber,
        plateNumber: additionalPolicyData.plateNumber,
        MvFileNumber: additionalPolicyData.MvFileNumber,
        authenCode: additionalPolicyData.authenCode,
        aluminum: additionalPolicyData.aluminum,
        airBag: additionalPolicyData.airBag,
        TNVS: additionalPolicyData.TNVS,
        truckType: additionalPolicyData.truckType,
        vehicleLeftSidePhoto: additionalPolicyData.vehicleLeftSidePhoto,
        vehicleRightSidePhoto: additionalPolicyData.vehicleRightSidePhoto,
        vehicleFrontSidePhoto: additionalPolicyData.vehicleFrontSidePhoto,
        vehicleRearSidePhoto: additionalPolicyData.vehicleRearSidePhoto,
        vehicleInteriorDashboardPhoto:
          additionalPolicyData.vehicleInteriorDashboardPhoto,
        policyDocument: additionalPolicyData.policyDocument,
        paymentStatus: "Pending",
      };

      await policyService.updatePolicy(existingPolicyId, updatePayload);

      // Pay later: nothing is received, so no receipt and no journal. The bill raised at issuance stays open
      // and the payment is captured later on the policy payment screen.
      const payLater = await policyService.recordPayLater(existingPolicyId);
      if (!payLater.success) {
        logger.warn("Pay later could not be recorded:", payLater.error);
      }
      navigate(`/agent/policydetail/${existingPolicyId}`, {});
    } catch (error) {
      notifyError(
        `Error: ${error.message || "Failed to process. Please try again."}`
      );
    }
  };
  const handleSubmit = async (value) => {
    // Validate policy document upload
    if (!policyDocumentUrl) {
      setShowUploadError(true);
      notifyWarn(t("agent.pleaseUploadPolicy"));
      // Scroll to upload section
      document
        .querySelector(".upload__policy__card__sub__title")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      return;
    }

    // Validate policy form data
    if (!value.PolicyNumber || !value.InsuranceCompany) {
      notifyWarn(t("agent.pleaseFillRequired"));
      return;
    }

    // Clear error if validation passes
    setShowUploadError(false);

    // Prepare additional policy data from the form and uploaded documents
    const additionalPolicyData = {
      // Policy form fields
      policyNumber: value.PolicyNumber,
      insuranceCompanyName: value.InsuranceCompany,
      production: value.Production?.toISOString?.() || value.Production,
      inception: value.Inception?.toISOString?.() || value.Inception,
      issuedDate: value.IssuedDate?.toISOString?.() || value.IssuedDate,
      expiry: value.Expiry?.toISOString?.() || value.Expiry,

      // Customer info fields from previous step (Motor + Fire)
      idCardNumber: customerInfo.IdCardNumber,
      insuredName: customerInfo.insuredName || customerInfo.InsuredName || state?.insuredName,
      motorNumber: customerInfo.MotorNumber,
      chassisNumber: customerInfo.ChassisNumber,
      mortgage: customerInfo.Mortgage,
      certNumber: customerInfo.CertNumber,
      plateNumber: customerInfo.PlateNumber,
      MvFileNumber: customerInfo.MVFileNumber,
      authenCode: customerInfo.AuthenCode,
      aluminum: customerInfo.Aluminium,
      airBag: customerInfo.AirBag,
      TNVS: customerInfo.TNVS,
      truckType: customerInfo.TruckType,

      // Vehicle photos from previous step (map to flat structure)
      vehicleLeftSidePhoto: vehiclePhotos.leftSide,
      vehicleRightSidePhoto: vehiclePhotos.rightSide,
      vehicleFrontSidePhoto: vehiclePhotos.front,
      vehicleRearSidePhoto: vehiclePhotos.rear,
      vehicleInteriorDashboardPhoto: vehiclePhotos.interior,

      // Policy document
      policyDocument: policyDocumentUrl,
      paymentStatus: "Pending",
    };

    // Get quotation ID - prioritize URL param as source of truth
    const detailsQuotationId =
      quotationDetails?.quotationId || quotationDetails?.id;
    const quotationId = propQuotationId || urlQuotationId || detailsQuotationId;

    if (!quotationId) {
      notifyWarn(t("agent.quotationIdMissing"));
      return;
    }

    const existingPolicyId =
      policyIdFromState ||
      resolvedPolicyData?.policyId ||
      resolvedPolicyData?.id;

    if (!existingPolicyId) {
      notifyWarn(t("agent.policyReferenceMissing"));
      return;
    }

    try {
      await policyService.updatePolicy(existingPolicyId, {
        policyNumber: additionalPolicyData.policyNumber,
        insuranceCompanyName: additionalPolicyData.insuranceCompanyName,
        production: additionalPolicyData.production,
        inception: additionalPolicyData.inception,
        issuedDate: additionalPolicyData.issuedDate,
        expiry: additionalPolicyData.expiry,
        idCardNumber: additionalPolicyData.idCardNumber,
        insuredName: additionalPolicyData.insuredName,
        motorNumber: additionalPolicyData.motorNumber,
        chassisNumber: additionalPolicyData.chassisNumber,
        mortgage: additionalPolicyData.mortgage,
        certNumber: additionalPolicyData.certNumber,
        plateNumber: additionalPolicyData.plateNumber,
        MvFileNumber: additionalPolicyData.MvFileNumber,
        authenCode: additionalPolicyData.authenCode,
        aluminum: additionalPolicyData.aluminum,
        airBag: additionalPolicyData.airBag,
        TNVS: additionalPolicyData.TNVS,
        truckType: additionalPolicyData.truckType,
        vehicleLeftSidePhoto: additionalPolicyData.vehicleLeftSidePhoto,
        vehicleRightSidePhoto: additionalPolicyData.vehicleRightSidePhoto,
        vehicleFrontSidePhoto: additionalPolicyData.vehicleFrontSidePhoto,
        vehicleRearSidePhoto: additionalPolicyData.vehicleRearSidePhoto,
        vehicleInteriorDashboardPhoto:
          additionalPolicyData.vehicleInteriorDashboardPhoto,
        policyDocument: additionalPolicyData.policyDocument,
        paymentStatus: "Pending",
      });
    } catch (error) {
      logger.error("Failed to update policy with uploaded details:", error);
    }

    // Prepare complete policy data for payment flow
    const completePolicyForPayment =
      resolvedPolicyData || state?.policyData || {};

    navigate(`/agent/policy/paymentoptions/${existingPolicyId}`, {
      state: {
        ...state,
        quotation: quotationDetails,
        quotationId: quotationId,
        customerInfo: customerInfo,
        vehiclePhotos: vehiclePhotos,
        additionalPolicyData: additionalPolicyData,
        policyDocument: policyDocumentUrl,
        policyId: existingPolicyId,
        leadNumber: leadNumber,
        clientId: clientId,
        policyData: completePolicyForPayment,
        policy: completePolicyForPayment, // Also pass as 'policy' for consistency
        fromUploadPolicy: true,
        fromWaitingPage: true,
        paymentStatus: "Pending",
        // Include premium fields at top level for easier access
        grossPremium:
          completePolicyForPayment?.grossPremium ||
          quotationDetails?.grossPremium,
        netPremium:
          completePolicyForPayment?.netPremium || quotationDetails?.netPremium,
        documentaryStampTax:
          completePolicyForPayment?.documentaryStampTax ||
          quotationDetails?.documentaryStampTax,
        localGovernmentTax:
          completePolicyForPayment?.localGovernmentTax ||
          quotationDetails?.localGovernmentTax,
        valueAddedTax:
          completePolicyForPayment?.valueAddedTax ||
          quotationDetails?.valueAddedTax,
        accountPremiumOthers:
          completePolicyForPayment?.accountPremiumOthers ||
          quotationDetails?.accountPremiumOthers,
        discount:
          completePolicyForPayment?.discount || quotationDetails?.discount,
      },
    });
  };
  // Derive initial form values from policy data, state, or quotation (works for Fire, Motor, and other LOBs)
  const getDefaultExpiryDate = () => {
    const currentDate = new Date();
    const oneYearLater = new Date(currentDate);
    oneYearLater.setFullYear(currentDate.getFullYear() + 1);
    return oneYearLater.toISOString().split("T")[0];
  };

  const policySource = resolvedPolicyData || state?.policyData || state?.policy;
  const inceptionFromSource = state?.inception || policySource?.inception || new Date().toISOString().split("T")[0];
  const expiryFromSource = state?.expiry || policySource?.expiry || getDefaultExpiryDate();
  const insuranceCompanyFromQuote =
    quotationDetails?.participantDetails?.[0]?.insuranceCompanyName ||
    quotationDetails?.participantDetails?.[0]?.participantName ||
    policySource?.insuranceCompanyName ||
    "";
  const normalizedInsuranceCompany =
    insuranceCompanyFromQuote === "N/A" || insuranceCompanyFromQuote === "NA"
      ? ""
      : insuranceCompanyFromQuote;

  const initialValues = useMemo(
    () => ({
      PolicyNumber:
        policySource?.policyNumber || state?.policyNumber || "001",
      InsuranceCompany: normalizedInsuranceCompany,
      Production: state?.production
        ? new Date(state.production)
        : policySource?.production
        ? new Date(policySource.production)
        : new Date(inceptionFromSource),
      Inception: new Date(inceptionFromSource),
      IssuedDate: state?.issuedDate
        ? new Date(state.issuedDate)
        : policySource?.issuedDate
        ? new Date(policySource.issuedDate)
        : new Date(inceptionFromSource),
      Expiry: new Date(expiryFromSource),
      file: null,
    }),
    [
      policySource?.policyNumber,
      policySource?.insuranceCompanyName,
      policySource?.inception,
      policySource?.expiry,
      policySource?.production,
      policySource?.issuedDate,
      state?.policyNumber,
      state?.inception,
      state?.expiry,
      state?.production,
      state?.issuedDate,
      inceptionFromSource,
      expiryFromSource,
      quotationDetails?.participantDetails,
      normalizedInsuranceCompany,
    ]
  );

  const [, setExpieyDateData] = useState("");

  const handleBackNavigation = () => {
    customHistory.back();
  };

  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    onSubmit: handleSubmit,
  });
  const handleIssuedDateChange = (e) => {
    // PrimeReact Calendar passes the value directly in e.value, not e.target.value
    const issuedDate = e.value || e.target?.value || e;
    const expiryDate = new Date(issuedDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    setExpieyDateData(expiryDate);
    formik.setFieldValue("IssuedDate", issuedDate);
    formik.setFieldValue("Expiry", expiryDate);
  };

  // Get participant details from quotation (Motor, etc.) or build for Fire/Allied Perils when empty
  // risk_participants from the API (lead first, amounts split by share) when the quotation carries them
  const participantDetails = quotationDetails?.participants?.length
    ? quotationDetails.participants.map((p) => ({
        participantName: p.insuranceCompanyName,
        sumInsuredCurrency: quotationDetails.currency,
        premiumCurrency: quotationDetails.currency,
        sharePercentage: String(p.sharePercent),
        sumInsured: p.sumInsured,
        premium: p.premiumTotal,
      }))
    : quotationDetails?.participantDetails || [];
  const lob = state?.lob || quotationDetails?.productType || "";

  // For Fire and Allied Perils: when participantDetails is empty, show insured name and premium
  const fireInsuredName =
    customerInfo?.insuredName ||
    customerInfo?.InsuredName ||
    (quotationDetails?.lead
      ? `${quotationDetails.lead.firstName || ""} ${quotationDetails.lead.lastName || ""}`.trim()
      : null) ||
    state?.insuredName;

  const fireTotalPremium =
    quotationDetails?.firePremiumDetails?.totalPremium ||
    quotationDetails?.grossPremium ||
    quotationDetails?.totalPremium;

  const fireSumInsured = quotationDetails?.firePremiumDetails?.sumInsured
    ? Object.values(quotationDetails.firePremiumDetails.sumInsured).reduce(
        (a, b) => (parseFloat(a) || 0) + (parseFloat(b) || 0),
        0
      )
    : null;

  const TableList = useMemo(() => {
    if (participantDetails.length > 0) {
      return participantDetails.map((participant) => ({
        ParticipantName: participant.participantName,
        SumInsuredcurrency: participant.sumInsuredCurrency,
        Premiumcurrencys: participant.premiumCurrency,
        Sharepercentage: participant.sharePercentage,
        sumInsured: participant.sumInsured,
        premium: participant.premium,
      }));
    }
    // Fire and Allied Perils fallback: single row with insured name and premium
    if (
      (lob === "FIRE" || quotationDetails?.productType === "Fire and Allied Perils") &&
      fireInsuredName
    ) {
      return [
        {
          ParticipantName: fireInsuredName,
          SumInsuredcurrency:
            fireSumInsured != null ? formatCurrency(fireSumInsured) : "-",
          Premiumcurrencys:
            fireTotalPremium != null ? formatCurrency(fireTotalPremium) : "-",
          Sharepercentage: "100",
          sumInsured: fireSumInsured,
          premium: fireTotalPremium,
        },
      ];
    }
    return [];
  }, [
    participantDetails,
    lob,
    quotationDetails?.productType,
    fireInsuredName,
    fireTotalPremium,
    fireSumInsured,
  ]);

  const isEmpty = TableList.length === 0;

  // Check if any participant has sumInsured or premium values
  const hasSumInsuredValues = TableList.some(
    (participant) =>
      participant.sumInsured &&
      participant.sumInsured !== 0 &&
      participant.sumInsured !== ""
  );
  const hasPremiumValues = TableList.some(
    (participant) =>
      participant.premium &&
      participant.premium !== 0 &&
      participant.premium !== ""
  );

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
  if (resolvingPolicy) {
    return (
      <div className="upload__policy__card__container mt-4">
        <Card>
          <div className="p-4 text-center">{t("agent.loadingPolicyDetails")}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="upload__policy__card__container mt-4">
      <CustomToast ref={toastRef} message={t("uploadPolicy.policyConvertedSuccess")} />
      <Card>
        <div className="upload__policy__card__container__title">
          {t("uploadPolicy.uploadPolicyTitle")}
        </div>

        <div className="card" style={{ marginBottom: 24, marginTop: 24 }}>
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
            {hasSumInsuredValues && (
              <Column
                header={t("tables.sumInsured")}
                field="sumInsured"
                style={{ paddingLeft: 20 }}
              ></Column>
            )}
            {hasPremiumValues && (
              <Column
                header={t("tables.premium")}
                field="premium"
                style={{ paddingLeft: 20 }}
              ></Column>
            )}
          </DataTable>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={`${t("agent.policyNumber")}*`}
              value={formik.values.PolicyNumber}
              onChange={formik.handleChange("PolicyNumber")}
              disabled={!!(policySource?.policyNumber || state?.policyNumber)}
            />
            {formik.touched.PolicyNumber && formik.errors.PolicyNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.PolicyNumber}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={`${t("agent.insuranceCompany")}*`}
              value={formik.values.InsuranceCompany}
              options={InsuranceCompanyOptions}
              onChange={(e) =>
                formik.setFieldValue("InsuranceCompany", e.value)
              }
              optionLabel="label"
              placeholder={t("agent.selectInsuranceCompany", "Select Insurance Company")}
            />
            {formik.touched.InsuranceCompany &&
              formik.errors.InsuranceCompany && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.InsuranceCompany}
                </div>
              )}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label={`${t("agent.production")}*`}
              value={formik.values.Production}
              onChange={(e) => {
                formik.setFieldValue("Production", e.target.value);
              }}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.Production && formik.errors.Production && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.Production}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label={`${t("agent.inception")}*`}
              value={formik.values.Inception}

              onChange={(e) => {
                handleIssuedDateChange();
                formik.setFieldValue("Inception", e.target.value);
              }}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.Inception && formik.errors.Inception && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.Inception}
              </div>
            )}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label={`${t("agent.issuedDate")}*`}
              value={formik.values.IssuedDate}
              onChange={handleIssuedDateChange}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.IssuedDate && formik.errors.IssuedDate && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.IssuedDate}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label={`${t("agent.expiry")}*`}
              value={formik.values.Expiry}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.Expiry && formik.errors.Expiry && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.Expiry}
              </div>
            )}
          </div>
        </div>

        <div className="upload__policy__card__sub__title mt-2 mb-2">
          {t("agent.uploadPolicyDocument")}*
        </div>

        {!policyDocumentUrl && (
          <div className="text-sm text-600 mb-2" style={{ color: "#6c757d" }}>
            {t("agent.uploadPolicyDocumentHint")}
          </div>
        )}

        <S3FileUpload
          accept=".pdf,.png,.jpg,.jpeg"
          maxFileSize={10 * 1024 * 1024} // 10MB for policy documents
          multiple={false}
          showPreview={false}
          autoUpload
          uploadPath="policy-documents"
          onRemove={() => {
            setPolicyDocumentUrl(null);
            formik.setFieldValue("file", "");
          }}
          onUploadSuccess={(url, file) => {
            // Extract URL from various possible formats
            let documentUrl = null;

            if (typeof url === "string" && url) {
              // Direct URL string
              documentUrl = url;
            } else if (url && typeof url === "object") {
              // Object format - check all possible locations
              documentUrl =
                url.url || url.data?.url || url.key || url.data?.key;
            }

            if (!documentUrl) {
              notifyError(t("agent.uploadUrlFailed"));
              return;
            }

            setPolicyDocumentUrl(documentUrl);
            formik.setFieldValue("file", documentUrl);
            setShowUploadError(false);
          }}
          onUploadError={(error) => {
            notifyError(t("agent.uploadFailed") + ": " + error.message);
          }}
        />

        {policyDocumentUrl && (
          <div
            className="text-sm mt-2"
            style={{ color: "#28a745", fontWeight: 500 }}
          >
            ✓ {t("agent.policyDocumentUploaded")}
          </div>
        )}

        {showUploadError && !policyDocumentUrl && (
          <div
            className="text-sm mt-2"
            style={{ color: "#dc3545", fontWeight: 500 }}
          >
            ⚠ {t("agent.uploadPolicyDocumentRequired")}
          </div>
        )}

        <div className="grid m-0">
          <div className="col-12 md:col-12 lg:col-12 back__complete__btn__container p-0 mt-4">
            <div className="back__btn__container">
              <Button className="back__btn" onClick={handleBackNavigation}>
                {t("agent.back")}
              </Button>
            </div>
            <div className="next__btn__container">
              <Button
                className="pay__later__btn"
                onClick={(e) => handlePayLater(formik.values)}
                tooltipOptions={{ position: "top" }}
                disabled={!policyDocumentUrl}
              >
                {t("agent.payLater")}
              </Button>
            </div>
            <div className="complete__btn__container">
              <Button
                className="complete__btn"
                onClick={() => {
                  formik.handleSubmit();
                }}
                disabled={!policyDocumentUrl}
                tooltip={
                  !policyDocumentUrl
                    ? t("agent.pleaseUploadToContinue")
                    : ""
                }
                tooltipOptions={{ position: "top" }}
              >
                {t("agent.proceedToPayment")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default UploadPolicyCard;
