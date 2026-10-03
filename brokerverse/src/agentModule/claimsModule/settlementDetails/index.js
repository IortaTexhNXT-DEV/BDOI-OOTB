import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useFormik } from "formik";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import DropdownField from "../../component/DropdownField";
import InputTextField from "../../component/inputText";
import DatepickerField from "../../component/datePicker";
import FieldError from "../../../components/FieldError";
import CustomToast from "../../../components/Toast";
import { postSettlementClaimMiddleware } from "./Store/claimSettlementMiddleware";
import claimsService from "../../../services/claimsService";
import { formatCurrency } from "../../../utility/currencyConverter";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../shared/ClaimJourneyLayout";
import FormErrorSummary from "../shared/FormErrorSummary";
import useClaimsConfig from "../shared/useClaimsConfig";
import { EDITABLE_STATUSES, errorText, fromIsoDate, toIsoDate } from "../shared/claimJourney";

const amountOf = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const round2 = (value) => Math.round((value || 0) * 100) / 100;

/** Settlement: type (settlement types master), amount and dates, with each co-insurer's share of the amount. */
const SettlementDetails = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const fileUploadRef = useRef(null);
  const config = useClaimsConfig();
  const { id } = useParams();
  const claimId = id || location.state?.claimId || location.state?.id;
  const [claim, setClaim] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!claimId) return;
    claimsService.getClaimDetails(claimId).then((result) => {
      if (result.success) setClaim(result.data?.data || result.data);
      else setLoadError(result.error);
    });
  }, [claimId]);

  const editable = !claim || EDITABLE_STATUSES.includes(claim.lifecycleStatus);
  const typeOptions = (config.settlementTypes || []).map((x) => ({ label: x.label || x.value, value: x.value }));
  const labels = {
    settlementType: t("claimJourney.settlementType"),
    settlementAmount: t("claimJourney.settlementAmount"),
    settlementIssueDate: t("claimJourney.issueDate"),
    settlementDate: t("claimJourney.settleDate"),
  };

  const formik = useFormik({
    initialValues: { settlementType: "", settlementAmount: "", settlementIssueDate: toIsoDate(new Date()), settlementDate: toIsoDate(new Date()), settlementDocument: null },
    validate: (v) => {
      const e = {};
      const required = t("claimJourney.required");
      if (!v.settlementType) e.settlementType = required;
      const amount = amountOf(v.settlementAmount);
      if (!(amount > 0)) e.settlementAmount = t("claimJourney.amountPositive");
      if (!v.settlementIssueDate) e.settlementIssueDate = required;
      if (!v.settlementDate) e.settlementDate = required;
      if (v.settlementIssueDate && v.settlementDate && v.settlementDate < v.settlementIssueDate) e.settlementDate = t("claimJourney.settleBeforeIssue");
      return e;
    },
    onSubmit: async (values) => {
      setServerError("");
      setSaving(true);
      const result = await dispatch(
        postSettlementClaimMiddleware({
          claimId,
          settlementData: { ...values, settlementAmount: String(amountOf(values.settlementAmount)) },
        })
      );
      setSaving(false);
      if (!result.type.endsWith("/fulfilled")) {
        setServerError(errorText(result.payload, t("claimJourney.settlementFailed")));
        return;
      }
      // with maker-checker on, the settlement waits for a second claims user
      const saved = result.payload?.data || result.payload || {};
      const pending = /pending/i.test(String(saved.claimStatus || saved.status || saved.statusCode || ""));
      toastRef.current?.showToast({
        severity: "success",
        summary: pending ? t("claimJourney.settlementSubmitted") : t("claimJourney.settlementRecorded"),
        detail: pending ? t("claimJourney.awaitingChecker") : "",
      });
      navigate(`/agent/claimdetailedview/${claimId}`, { replace: true });
    },
  });

  // each participating insurer's share of the settlement being entered
  const shares = useMemo(() => {
    const insurers = claim?.participatingInsurers || [];
    if (insurers.length < 2) return [];
    const amount = amountOf(formik.values.settlementAmount);
    const estimate = Number(claim.estimatedClaimAmount) || 0;
    return insurers.map((p) => {
      const share = Number(p.sharePercentage) || 0;
      return {
        id: String(p.insurerId),
        insurer: p.insuranceCompanyName,
        role: p.isLead ? t("claimJourney.leadInsurer") : t("claimJourney.coInsurer"),
        share: `${share}%`,
        claimAmount: formatCurrency(round2((estimate * share) / 100)),
        settlementAmount: formatCurrency(round2(((amount > 0 ? amount : 0) * share) / 100)),
      };
    });
  }, [claim, formik.values.settlementAmount, t]);

  const showErrors = formik.submitCount > 0;
  const fieldError = (name) => (showErrors || formik.touched[name] ? formik.errors[name] : undefined);
  const req = (label) => (
    <>
      {label}
      <span className="required-mark">*</span>
    </>
  );
  const dateField = (name) => (
    <div className="col-12 md:col-6">
      <DatepickerField
        label={req(labels[name])}
        value={fromIsoDate(formik.values[name])}
        onChange={(e) => formik.setFieldValue(name, toIsoDate(e.value))}
        disabled={!editable}
      />
      <FieldError error={fieldError(name)} />
    </div>
  );
  const right = { textAlign: "right" };

  return (
    <ClaimJourneyLayout
      step="settlement"
      holderName={claim?.policyHolderName}
      reference={claim?.claimNumber ? t("claimJourney.claimRef", { number: claim.claimNumber }) : ""}
      status={claim?.claimStatus}
      onBack={() => navigate(claim?.clientId ? `/agent/clientview/${claim.clientId}` : "/agent/claim")}
      title={t("claimJourney.settlementTitle")}
    >
      <CustomToast ref={toastRef} />
      {!claim && !loadError && <p className="claim-journey__hint">{t("claimJourney.loadingClaim")}</p>}
      {loadError && <FormErrorSummary serverError={loadError} />}
      {claim && !editable && <div className="claim-journey__notice">{t("claimJourney.settlementLocked", { status: claim.claimStatus })}</div>}
      {claim && (
        <>
          <ClaimSection title={t("claimJourney.settlementSection")}>
            <div className="grid">
              <div className="col-12 md:col-6">
                <DropdownField
                  label={req(labels.settlementType)}
                  value={formik.values.settlementType}
                  onChange={(e) => formik.setFieldValue("settlementType", e.value)}
                  options={typeOptions}
                  optionLabel="label"
                  optionValue="value"
                  placeholder={t("claimJourney.select")}
                  disabled={!editable}
                />
                <FieldError error={fieldError("settlementType")} />
              </div>
              <div className="col-12 md:col-6">
                <InputTextField
                  label={req(labels.settlementAmount)}
                  value={formik.values.settlementAmount}
                  onChange={formik.handleChange("settlementAmount")}
                  onBlur={() => formik.setFieldTouched("settlementAmount", true, false)}
                  keyfilter="money"
                  disabled={!editable}
                />
                <FieldError error={fieldError("settlementAmount")} />
                {Number(claim.estimatedClaimAmount) > 0 && (
                  <small className="claim-journey__hint">{t("claimJourney.estimateWas", { amount: formatCurrency(claim.estimatedClaimAmount) })}</small>
                )}
              </div>
              {dateField("settlementIssueDate")}
              {dateField("settlementDate")}
            </div>
          </ClaimSection>

          {shares.length > 0 && (
            <ClaimSection title={t("claimJourney.coInsurance")} hint={t("claimJourney.sharesHint")}>
              <DataTable value={shares} size="small" dataKey="id">
                <Column field="insurer" header={t("claimJourney.insurer")} />
                <Column field="role" header={t("claimJourney.role")} />
                <Column field="share" header={t("claimJourney.share")} alignHeader="right" bodyStyle={right} />
                <Column field="claimAmount" header={t("claimJourney.estimatedAmount")} alignHeader="right" bodyStyle={right} />
                <Column field="settlementAmount" header={t("claimJourney.settlementAmount")} alignHeader="right" bodyStyle={right} />
              </DataTable>
            </ClaimSection>
          )}

          <ClaimSection title={t("claimJourney.settlementDocuments")} hint={t("claimJourney.optional")}>
            <div className="claim-journey__upload">
              {formik.values.settlementDocument ? (
                <span className="claim-journey__file">
                  <i className="pi pi-file" aria-hidden="true" />
                  {formik.values.settlementDocument.name}
                  <Button
                    type="button"
                    icon="pi pi-times"
                    text
                    rounded
                    aria-label={t("claimJourney.removeFile")}
                    onClick={() => {
                      formik.setFieldValue("settlementDocument", null);
                      fileUploadRef.current?.clear();
                    }} tooltip={t("claimJourney.removeFile")} tooltipOptions={{ position: "top" }}
                  />
                </span>
              ) : (
                <FileUpload
                  ref={fileUploadRef}
                  mode="basic"
                  auto
                  customUpload
                  name="settlementDocument"
                  accept=".png,.jpg,.jpeg,.pdf"
                  maxFileSize={2000000}
                  chooseLabel={t("claimJourney.chooseFile")}
                  disabled={!editable}
                  invalidFileSizeMessageSummary={t("claimJourney.fileTooLarge")}
                  invalidFileSizeMessageDetail=""
                  uploadHandler={(e) => {
                    formik.setFieldValue("settlementDocument", e.files[0]);
                    e.options.clear();
                  }}
                />
              )}
              <small>{t("claimJourney.fileRule")}</small>
            </div>
          </ClaimSection>

          <FormErrorSummary errors={formik.errors} labels={labels} show={showErrors} serverError={serverError} />
        </>
      )}
      <ClaimActions>
        <Button
          type="button"
          label={t("claimJourney.back")}
          outlined
          onClick={() => navigate(`/agent/claimrequest/settlementapproval/${claimId}`, { state: { claimId } })}
          disabled={saving}
        />
        <Button type="button" label={t("claimJourney.submitSettlement")} onClick={formik.handleSubmit} loading={saving} disabled={saving || !claim || !editable} />
      </ClaimActions>
    </ClaimJourneyLayout>
  );
};

export default SettlementDetails;
