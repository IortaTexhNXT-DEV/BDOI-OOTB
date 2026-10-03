import { Card } from "primereact/card";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import InputTextField from "../../../component/inputText";
import { useSelector, useDispatch } from "react-redux";
import { getpolicyDetailedMiddleware } from "../store/policyDetailedMiddleware";
import { formatDate } from "../../../../utility/dateFormat";

const PolicyDetailedViewCard = ({ policyId }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const dispatch = useDispatch();

  const { policydetailedlist: loaded, loading } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      loading: policyDetailedViewMainReducers?.loading,
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
    })
  );
  // The page loads its own policy (GET /policies/:id); a policy left in the store by another page is not shown.
  const matches = (p) => p && (!policyId || [p.policyId, p.id, p.policyNumber].includes(policyId));
  const policydetailedlist = matches(loaded) ? loaded : null;

  // Fetch policy details when component mounts
  useEffect(() => {
    if (policyId) {
      dispatch(getpolicyDetailedMiddleware({ policyId }));
    }
  }, [dispatch, policyId]);

  const participants = policydetailedlist?.participants || [];
  const insurerName =
    participants.find((p) => p.isLead)?.insuranceCompanyName ||
    policydetailedlist?.insuranceCompanyName ||
    policydetailedlist?.quotation?.participantDetails?.[0]?.insuranceCompanyName ||
    "";
  const productName =
    policydetailedlist?.productType || policydetailedlist?.product || policydetailedlist?.quotation?.productType || "";
  // Totals of the policy record (sum insured and gross premium as issued)
  const totalCoverage = Number(policydetailedlist?.totalSumInsured ?? policydetailedlist?.sumInsured ?? 0);
  const grossPremium = Number(policydetailedlist?.grossPremium ?? policydetailedlist?.premiumTotal ?? 0);
  const dateOf = (value) => (value ? formatDate(value, { empty: "" }) : "");

  if (loading) {
    return (
      <div className="policy__detail__view__card__container mt-4">
        <Card>
          <div className="text-center p-4">
            <p>{t("agent.loadingPolicyDetails")}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="policy__detail__view__card__container mt-4">
      <Card>
        <div className="policy__details__card__view__container__title">
          {t("coverageDetailsReview.policyDetails")}
        </div>
        <div className="grid mt-2">
          <div className="col-12">
            <InputTextField
              label={t("coverageDetailsReview.insuranceCompany")}
              value={insurerName}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.product")}
              value={productName}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.policyNumber")}
              value={policydetailedlist?.policyNumber || ""}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.production")}
              value={dateOf(policydetailedlist?.production)}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.inception")}
              value={dateOf(policydetailedlist?.inception)}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.issueDate")}
              value={dateOf(policydetailedlist?.issuedDate)}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.expiry")}
              value={dateOf(policydetailedlist?.expiry)}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.totalCoverage")}
              value={formatCurrency(totalCoverage)}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.grossPremium")}
              value={formatCurrency(grossPremium)}
            />
          </div>
        </div>

      </Card>
    </div>
  );
};

export default PolicyDetailedViewCard;
