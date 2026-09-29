import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import useClaimHeader from "../useClaimHeader";
import { Button } from "primereact/button";
import DropdownField from "../../component/DropdownField";
import InputTextField from "../../component/inputText";
import DatepickerField from "../../component/datePicker";
import { FileUpload } from "primereact/fileupload";
import SvgImageUpload from "../../../assets/icons/SvgImageUpload";
import "./index.scss";
import CustomToast from "../../../components/Toast";
import customHistory from "../../../routes/customHistory";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { postSettlementClaimMiddleware } from "./Store/claimSettlementMiddleware";
import SvgUploadClose from "../../../assets/agentIcon/SvgUploadClose";
import claimsService from "../../../services/claimsService";
import { formatCurrency } from "../../../utility/currencyConverter";
import logger from "../../../utility/logger";

const initialValues = {
  settlementType: "",
  settlementAmount: "",
  settlementIssueDate: new Date(),
  settlementDate: new Date(),
  settlementDocument: null,
};

const parseAmount = (value) => {
  const parsed = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const round2 = (value) => Number((value || 0).toFixed(2));

const SettlementDetails = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const params = useParams();
  const { id } = params;
  const [loading, setLoading] = useState(false);
  const [claimData, setClaimData] = useState(null);

  const items = [
    { label: t("settlementDetails.cash"), value: "Cash" },
    { label: t("settlementDetails.card"), value: "Card" },
    { label: t("settlementDetails.cheque"), value: "Cheque" },
  ];

  const claimId = id || location.state?.claimId || location.state?.id;

  const {
    policyHolderName: reduxPolicyHolderName,
    claimNumber: reduxClaimNumber,
  } = useSelector(({ claimDetailsMainReducers }) => ({
    policyHolderName: claimDetailsMainReducers?.policyHolderName || "",
    policyNumber: claimDetailsMainReducers?.policyNumber || "",
    claimNumber: claimDetailsMainReducers?.claimNumber || "",
  }));

  const header = useClaimHeader(claimId);
  const policyHolderName = header.policyHolderName || reduxPolicyHolderName || t("common.loading");
  const headerClaimNumber = header.claimNumber || reduxClaimNumber;

  useEffect(() => {
    let cancelled = false;

    const fetchClaim = async () => {
      if (!claimId) return;
      const result = await claimsService.getClaimDetails(claimId);
      if (cancelled) return;
      if (result.success) {
        const payload = result.data?.data || result.data || null;
        setClaimData(payload);
      }
    };

    fetchClaim();
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  const formik = useFormik({
    initialValues: initialValues,
    validate: (v) => {
      const e = {};
      if (!v.settlementType) e.settlementType = t("settlementDetails.typeRequired", "Select the settlement type");
      const amt = Number(String(v.settlementAmount ?? "").replace(/,/g, ""));
      if (!v.settlementAmount || !Number.isFinite(amt) || amt <= 0) e.settlementAmount = t("settlementDetails.amountRequired", "Enter a settlement amount greater than zero");
      if (!v.settlementIssueDate) e.settlementIssueDate = t("settlementDetails.issueDateRequired", "Issue date is required");
      if (!v.settlementDate) e.settlementDate = t("settlementDetails.settleDateRequired", "Settle date is required");
      if (v.settlementIssueDate && v.settlementDate && new Date(v.settlementDate) < new Date(new Date(v.settlementIssueDate).toDateString())) {
        e.settlementDate = t("settlementDetails.settleBeforeIssue", "Settle date cannot be before the issue date");
      }
      return e;
    },
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  const coInsuranceRows = useMemo(() => {
    const isCoInsurance = Boolean(
      claimData?.isCoInsurancePolicy ||
        claimData?.isCoInsurance ||
        claimData?.quotation?.isCoInsurance ||
        claimData?.policy?.isCoInsurance
    );
    if (!isCoInsurance) return [];

    const baseRows = (claimData?.coInsuranceSettlementRows || []).filter(
      (row) => !row.isTotal
    );
    const participants =
      baseRows.length > 0
        ? baseRows
        : (claimData?.quotation?.participantDetails || []).map(
            (participant, index) => {
              const sharePercentage = parseAmount(participant.sharePercentage);
              const share = Number.isFinite(sharePercentage)
                ? sharePercentage
                : 0;
              const totalClaim = Number(claimData?.estimatedClaimAmount) || 0;
              const settlementBase =
                Number(
                  claimData?.claimSettlementAmountFinal ??
                    claimData?.settlementAmount ??
                    claimData?.estimatedClaimAmount
                ) || 0;
              return {
                participantId: participant.id || `participant-${index}`,
                insurer:
                  participant.insuranceCompanyName ||
                  participant.participantName ||
                  "N/A",
                role:
                  index === 0
                    ? t("settlementDetails.leadInsurer")
                    : t("settlementDetails.coInsurer"),
                sharePercentage: share,
                claimAmount: round2((totalClaim * share) / 100),
                settlementAmount: round2((settlementBase * share) / 100),
                status: claimData?.claimStatus || "",
                isTotal: false,
              };
            }
          );

    if (participants.length === 0) return [];

    const formSettlement = parseAmount(formik.values.settlementAmount);
    const useFormSettlement = Number.isFinite(formSettlement);

    const mapped = participants.map((row, index) => {
      const share = Number(row.sharePercentage) || 0;
      const settlementAmount = useFormSettlement
        ? round2((formSettlement * share) / 100)
        : Number(row.settlementAmount) || 0;

      return {
        ...row,
        role:
          row.role === "Lead Insurer" || index === 0
            ? t("settlementDetails.leadInsurer")
            : t("settlementDetails.coInsurer"),
        settlementAmount,
      };
    });

    const totalShare = round2(
      mapped.reduce((sum, row) => sum + (Number(row.sharePercentage) || 0), 0)
    );
    const totalClaimAmount = round2(
      mapped.reduce((sum, row) => sum + (Number(row.claimAmount) || 0), 0)
    );
    const totalSettlementAmount = round2(
      mapped.reduce((sum, row) => sum + (Number(row.settlementAmount) || 0), 0)
    );

    return [
      ...mapped,
      {
        participantId: "total",
        insurer: t("settlementDetails.total"),
        role: "",
        sharePercentage: totalShare,
        claimAmount: totalClaimAmount,
        settlementAmount: totalSettlementAmount,
        status: claimData?.claimStatus || mapped[0]?.status || "",
        isTotal: true,
      },
    ];
  }, [claimData, formik.values.settlementAmount, t]);

  const handleSubmit = async (values) => {
    if (!claimId) {
      logger.error("No claim ID available for settlement");
      return;
    }

    setLoading(true);

    try {
      const settlementData = {
        settlementType: values.settlementType,
        settlementAmount: values.settlementAmount,
        settlementIssueDate: values.settlementIssueDate.toISOString(),
        settlementDate: values.settlementDate.toISOString(),
        settlementDocument: values.settlementDocument,
      };

      const result = await dispatch(
        postSettlementClaimMiddleware({
          claimId: claimId,
          settlementData: settlementData,
        })
      );

      if (result.type.endsWith("/fulfilled")) {
        // with maker-checker on, the settlement waits for a second claims user
        const saved = result.payload?.data || result.payload || {};
        const pending = /pending/i.test(String(saved.claimStatus || saved.status || saved.statusCode || ""));
        if (pending) {
          toastRef.current.showToast({ severity: "success", summary: t("settlementDetails.submittedForApproval", "Settlement submitted for approval"), detail: t("settlementDetails.awaitingChecker", "A second claims user must approve it before the claim is settled") });
        } else {
          toastRef.current.showToast();
        }
        setTimeout(() => {
          navigate(`/agent/claimdetailedview/${claimId}`);
        }, 2000);
      } else {
        toastRef.current?.showToast("error", t("common.error", "Settlement not submitted"), String(result.payload || "Settlement submission failed"));
      }
    } catch (error) {
      toastRef.current?.showToast("error", t("common.error", "Settlement not submitted"), error.message);
    } finally {
      setLoading(false);
    }
  };

  const fileUploadRef = useRef(null);
  const [uploadImage, setuploadImage] = useState(null);
  const handleUppendImg = (name, src) => {
    setuploadImage(src?.objectURL);
  };
  const handleCancelUplaoded = () => {
    setuploadImage(null);
    fileUploadRef.current.clear();
  };
  const handleBackNavigation = () => {
    customHistory.back();
  };

  const getRoleClass = (role, isTotal) => {
    if (isTotal || !role) return "";
    if (role === t("settlementDetails.leadInsurer") || role === "Lead Insurer") {
      return "role-pill role-pill--lead";
    }
    return "role-pill role-pill--co";
  };

  const getStatusClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "settled") return "status-pill status-pill--settled";
    return "status-pill";
  };

  return (
    <div>
      <CustomToast
        ref={toastRef}
        message={t("settlementDetails.claimSettledSuccess")}
      />
      <div className="claim__settlementdetails__container">
        <div className="claim__details__container__titles">
          {t("settlementDetails.clients")}
        </div>
        <div
          className="claim__details__container__back__btn mt-3 cursor-pointer"
          onClick={handleBackNavigation}
        >
          <SvgLeftArrow />
          <div className="claim__details__container__back__btn__title">
            {policyHolderName} /{" "}
            {headerClaimNumber
              ? t("settlementDetails.claimLabel", {
                  claimNumber: headerClaimNumber,
                })
              : t("common.loading")}
          </div>
        </div>
        <Card>
          <div className="claim__details__card__container__title">
            {t("settlementDetails.claimSettlement")}
          </div>
          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <DropdownField
                label={t("settlementDetails.settlementType")}
                value={formik.values.settlementType}
                onChange={(e) =>
                  formik.setFieldValue("settlementType", e.value)
                }
                options={items}
                optionLabel="label"
                optionValue="value"
                placeholder={t("settlementDetails.select")}
              />
              {formik.touched.settlementType && formik.errors.settlementType && (
                <div style={{ fontSize: 12, color: "red" }}>{formik.errors.settlementType}</div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("settlementDetails.settlementAmount")}
                value={formik.values.settlementAmount}
                onChange={formik.handleChange("settlementAmount")}
              />
              {formik.touched.settlementAmount && formik.errors.settlementAmount && (
                <div style={{ fontSize: 12, color: "red" }}>{formik.errors.settlementAmount}</div>
              )}
            </div>
          </div>

          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <DatepickerField
                label={t("settlementDetails.issueDate")}
                value={formik.values.settlementIssueDate}
                onChange={(e) => {
                  formik.setFieldValue("settlementIssueDate", e.value);
                }}
                dateFormat="dd/mm/yy"
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DatepickerField
                label={t("settlementDetails.settleDate")}
                value={formik.values.settlementDate}
                onChange={(e) => {
                  formik.setFieldValue("settlementDate", e.value);
                }}
                dateFormat="dd/mm/yy"
              />
              {formik.touched.settlementDate && formik.errors.settlementDate && (
                <div style={{ fontSize: 12, color: "red" }}>{formik.errors.settlementDate}</div>
              )}
            </div>
          </div>

          <div className="col-12 mt-4 p-0">
            <div className="claim__request__upload__subtitle  mb-2">
              {t("settlementDetails.documents")}
            </div>

            <div className="upload__card__container mt-2">
              <div className="file_icon_selector">
                <FileUpload
                  ref={fileUploadRef}
                  url="./upload"
                  auto
                  customUpload
                  mode="basic"
                  name="demo"
                  accept=".png,.jpg,.jpeg"
                  uploadHandler={(e) => {
                    const file = e.files[0];
                    formik.setFieldValue("settlementDocument", file);
                    handleUppendImg(e.options.props.name, file, "the data");
                  }}
                />
                <div className="icon_click_option">
                  <SvgImageUpload />
                </div>
                <div className="upload__caption text-center">
                  {t("settlementDetails.upload")}
                </div>
                <div className="upload__caption text-center">
                  {t("settlementDetails.uploadMaxSize")}
                </div>
              </div>
            </div>
            {uploadImage && (
              <div onClick={handleCancelUplaoded} className="mt-2">
                <SvgUploadClose />
              </div>
            )}
          </div>

          {coInsuranceRows.length > 0 && (
            <div className="co-insurance-settlement-section mt-4">
              <div className="co-insurance-settlement-section__header">
                <div className="co-insurance-settlement-section__title">
                  {t("settlementDetails.coInsuranceDetails")}
                </div>
                <span className="co-insurance-policy-badge">
                  {t("settlementDetails.coInsurancePolicyYes")}
                </span>
              </div>

              <table className="co-insurance-settlement-table">
                <thead>
                  <tr>
                    <th>{t("settlementDetails.insurer")}</th>
                    <th>{t("settlementDetails.role")}</th>
                    <th className="numeric">
                      {t("settlementDetails.sharePercent")}
                    </th>
                    <th className="numeric">
                      {t("settlementDetails.claimAmount")}
                    </th>
                    <th className="numeric settlement">
                      {t("settlementDetails.settlementAmountCol")}
                    </th>
                    <th>{t("settlementDetails.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {coInsuranceRows.map((row) => (
                    <tr
                      key={row.participantId}
                      className={row.isTotal ? "total-row" : ""}
                    >
                      <td className="insurer-cell">{row.insurer}</td>
                      <td>
                        {row.role ? (
                          <span className={getRoleClass(row.role, row.isTotal)}>
                            {row.role}
                          </span>
                        ) : null}
                      </td>
                      <td className="numeric">
                        {`${Number(row.sharePercentage) || 0}%`}
                      </td>
                      <td className="numeric">
                        {formatCurrency(row.claimAmount)}
                      </td>
                      <td className="numeric settlement">
                        {formatCurrency(row.settlementAmount)}
                      </td>
                      <td>
                        {row.status ? (
                          <span className={getStatusClass(row.status)}>
                            {row.status === "Settled"
                              ? t("settlementDetails.settled")
                              : row.status}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="co-insurance-settlement-note">
                {t("settlementDetails.settlementAmountNote")}
              </div>
            </div>
          )}

          <div className="claimrequest__back__but">
            <Button
              onClick={handleBackNavigation}
              link
              className="claim__back__but"
            >
              {t("settlementDetails.back")}
            </Button>
            <Button
              onClick={formik.handleSubmit}
              className="claim__snd__but"
              disabled={loading}
              loading={loading}
            >
              {loading
                ? t("settlementDetails.submitting")
                : t("settlementDetails.submit")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettlementDetails;
