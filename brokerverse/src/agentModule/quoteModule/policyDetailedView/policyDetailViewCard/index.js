import { Card } from "primereact/card";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import InputTextField from "../../../component/inputText";
import SvgBlueArrow from "../../../../assets/agentIcon/SvgBlueArrow";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useFormik } from "formik";
import { getpolicyDetailedMiddleware } from "../store/policyDetailedMiddleware";

const handleSubmit = () => {
  // TODO: integrate policy updates when API is ready
};

const PolicyDetailedViewCard = ({ action, state, policyId }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { policydetailedlist, loading } = useSelector(
    ({ policyDetailedViewMainReducers }) => {
      return {
        loading: policyDetailedViewMainReducers?.loading,
        policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
      };
    }
  );

  // Fetch policy details when component mounts
  useEffect(() => {
    if (policyId) {
      dispatch(getpolicyDetailedMiddleware({ policyId }));
    }
  }, [dispatch, policyId]);

  const formik = useFormik({
    initialValues: {
      PolicyNumber: policydetailedlist?.policyNumber || "",
      Production: policydetailedlist?.production || "",
      Inception: policydetailedlist?.inception || "",
      IssueDate: policydetailedlist?.issuedDate || "",
      Expiry: policydetailedlist?.expiry || "",
    },
    enableReinitialize: true, // Allow formik to reinitialize when policydetailedlist changes
    onSubmit: () => {
      handleSubmit();
    },
  });

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
              value={
                policydetailedlist?.quotation?.participantDetails?.[0]
                  ?.insuranceCompanyName || "SecureGuard Insurance"
              }
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.product")}
              value={policydetailedlist?.quotation?.productType || "Motor"}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.policyNumber")}
              value={policydetailedlist?.policyNumber || ""}
              onChange={formik.handleChange("PolicyNumber")}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.production")}
              value={policydetailedlist?.production || ""}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.inception")}
              value={policydetailedlist?.inception || ""}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.issueDate")}
              value={policydetailedlist?.issuedDate || ""}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.expiry")}
              value={policydetailedlist?.expiry || ""}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.totalCoverage")}
              value={formatCurrency(
                policydetailedlist?.quotation?.participantDetails?.reduce(
                  (sum, participant) => {
                    const coverage = parseFloat(
                      participant.sumInsuredCurrency?.replace(/[^0-9.-]/g, "") || 0
                    );
                    return sum + coverage;
                  },
                  0
                ) || 0
              )}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsReview.grossPremium")}
              value={formatCurrency(
                policydetailedlist?.quotation?.participantDetails?.reduce(
                  (sum, participant) => {
                    const premium = parseFloat(
                      participant.premiumCurrency?.replace(/[^0-9.-]/g, "") || 0
                    );
                    return sum + premium;
                  },
                  0
                ) || 0
              )}
            />
          </div>
        </div>

      </Card>
    </div>
  );
};

export default PolicyDetailedViewCard;
