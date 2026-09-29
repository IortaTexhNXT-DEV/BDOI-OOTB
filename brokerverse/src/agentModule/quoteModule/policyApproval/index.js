import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import "./index.scss";
import PolicyApprovalCard from "./policyApprovalCard";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import leadService from "../../../services/leadService";
import quotationService from "../../../services/quotationService";

const PolicyApproval = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const params = useParams();
  
  // State variables
  const [quotationDetails, setQuotationDetails] = useState(null);
  const [leadData, setLeadData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get quotation ID from URL params or state
  const quotationId = params.quotationId || state?.quotationId || state?.quotation?.id;
  
  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };

  // Fetch quotation details
  useEffect(() => {
    const fetchQuotationDetails = async () => {
      if (!quotationId) return;
      
      setIsLoading(true);
      try {
        const response = await quotationService.getQuotationById(quotationId);
        if (response.success) {
          console.log("Quotation details fetched successfully:", response.data);
          setQuotationDetails(response.data);
        } else {
          console.error("Failed to fetch quotation details:", response.error);
        }
      } catch (error) {
        console.error("Error fetching quotation details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuotationDetails();
  }, [quotationId]);

  // Fetch lead data when quotation details are loaded
  useEffect(() => {
    const fetchLeadData = async () => {
      if (quotationDetails?.leadRefId) {
        console.log("Fetching lead data for leadRefId:", quotationDetails.leadRefId);
        try {
          const response = await leadService.getLeadById(quotationDetails.leadRefId);
          if (response.success) {
            console.log("Lead data fetched successfully:", response.data);
            setLeadData(response.data);
          } else {
            console.error("Failed to fetch lead data:", response.error);
          }
        } catch (error) {
          console.error("Error fetching lead data:", error);
        }
      }
    };

    fetchLeadData();
  }, [quotationDetails?.leadRefId]);
  
  return (
    <div className="policy__approval__container">
      <div className="policy__approval__container__title">{t("agent.leads")}</div>
      <div className="grid mt-3">
        <div className="policy__approval__back__btn__container col-12 md:col-6 lg:col-6">
          <div
            className="cursor-pointer navigation-controller"
            onClick={handleLeadNavigation}
          >
            <SvgLeftArrow />
            <div className="policy__approval__back__btn__container__title">
              {leadData
                ? `${leadData.firstName || ""} ${leadData.lastName || ""} / Lead ID: ${leadData.generatedLeadId || ""}`
                : quotationDetails?.leadRefId
                ? `Lead ID: ${quotationDetails.lead?.generatedLeadId || ""}`
                : "Loading lead data..."}
            </div>
          </div>
        </div>
        <div className="policy__approval__quote__container col-12 md:col-6 lg:col-6">
          <div className="policy__approval__back__btn__container__title">
            Quote ID : {quotationDetails?.quotationNumber || quotationId || "Loading..."}
          </div>
        </div>
      </div>
      <PolicyApprovalCard state={state} />
    </div>
  );
};

export default PolicyApproval;
