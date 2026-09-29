import React, { useEffect, useMemo, useState } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import UploadPolicyCard from "./uploadPolicyCard";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getQuotationByIdMiddleware } from "../Store/quotationMiddleware";
import { getLeadByIdMiddleware } from "../../leadModule/Store/leadMiddleware";
import policyService from "../../../services/policyService";
import { Card } from "primereact/card";

const UploadPolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const locationState = state || {};
  const { quotationId } = useParams();
  const dispatch = useDispatch();

  // State for quotation details
  const [quotationDetails, setQuotationDetails] = useState(
    locationState.quotation || null
  );
  const [policyData, setPolicyData] = useState(
    locationState.policyData || null
  );
  const [loading, setLoading] = useState(false);

  // Get current lead details from Redux
  const { currentLeadDetails } = useSelector(({ leadReducer }) => ({
    currentLeadDetails: leadReducer?.currentLeadDetails,
  }));

  const resolvedQuotationId = useMemo(() => {
    return (
      quotationId ||
      locationState.quotationId ||
      locationState.quotation?.quotationId ||
      locationState.quotation?.id ||
      null
    );
  }, [quotationId, locationState.quotation, locationState.quotationId]);

  // Load quotation details if not in state
  useEffect(() => {
    const fetchQuotation = async () => {
      if (!resolvedQuotationId) {
        return;
      }

      setLoading(true);

      try {
        const data = await dispatch(
          getQuotationByIdMiddleware(resolvedQuotationId)
        ).unwrap();
        setQuotationDetails(data);
      } catch (error) {
        console.error("Failed to load quotation:", error);
        alert(t("agent.errorLoadingQuotation"));
      } finally {
        setLoading(false);
      }
    };

    if (!quotationDetails && resolvedQuotationId) {
      fetchQuotation();
    }
  }, [dispatch, quotationDetails, resolvedQuotationId]);

  // Fetch lead details to get generatedLeadId
  useEffect(() => {
    if (quotationDetails?.leadRefId) {
      dispatch(getLeadByIdMiddleware(quotationDetails.leadRefId));
    }
  }, [dispatch, quotationDetails?.leadRefId]);

  useEffect(() => {
    const resolvePolicy = async () => {
      if (policyData || !resolvedQuotationId) {
        return;
      }

      try {
        const response = await policyService.getPolicies(1, 1, {
          quoteRefId: resolvedQuotationId,
        });
        if (
          response.success &&
          Array.isArray(response.data?.data) &&
          response.data.data.length > 0
        ) {
          setPolicyData(response.data.data[0]);
        }
      } catch (error) {
        console.error("Failed to resolve policy for upload screen:", error);
      }
    };

    resolvePolicy();
  }, [policyData, resolvedQuotationId]);

  const handleLeadListNavigation = () => {
    navigate("/agent/quotelisting");
  };

  const resolvedPolicyId =
    policyData?.policyId || policyData?.id || locationState.policyId;

  const enhancedState = useMemo(
    () => ({
      ...locationState,
      quotationId: resolvedQuotationId,
      policyId: resolvedPolicyId,
      policyData: policyData || locationState.policyData || null,
    }),
    [locationState, policyData, resolvedPolicyId, resolvedQuotationId]
  );

  return (
    <div className="upload__policy__container">
      <div className="upload__policy__container__title">{t("uploadPolicy.title")}</div>
      <div className="grid m-0 mt-3">
        <div className="upload__policy__container__back__btn__container col-12 md:col-6 lg:col-6 p-0">
          <div
            className="arrow__controller cursor-pointer"
            onClick={handleLeadListNavigation}
          >
            <SvgLeftArrow />
            <div className="upload__policy__container__back__btn__title">
              {t("uploadPolicy.leadIdLabel")}{" "}
              {currentLeadDetails?.generatedLeadId ||
                quotationDetails?.leadRefId ||
                t("uploadPolicy.loading")}
            </div>
          </div>
        </div>
        <div className="upload__policy__container__quote__container col-12 md:col-6 lg:col-6 p-0">
          <div className="upload__policy__container__quote__title">
            {t("uploadPolicy.quoteIdLabel")} {quotationDetails?.quotationNumber || t("uploadPolicy.loading")}
          </div>
        </div>
      </div>
      {!resolvedQuotationId || !resolvedPolicyId || !quotationDetails ? (
        <Card className="mt-4">
          <div className="p-4 text-center">
            {!resolvedQuotationId
              ? t("uploadPolicy.quotationRefMissing")
              : !resolvedPolicyId
              ? t("uploadPolicy.resolvingPolicyRef")
              : t("uploadPolicy.loadingQuotationDetails")}
          </div>
        </Card>
      ) : (
        <UploadPolicyCard
          state={enhancedState}
          leadNumber={
            currentLeadDetails?.generatedLeadId || quotationDetails?.leadRefId
          }
          quotationDetails={quotationDetails}
          quotationId={resolvedQuotationId}
          policyId={resolvedPolicyId}
        />
      )}
    </div>
  );
};

export default UploadPolicy;
