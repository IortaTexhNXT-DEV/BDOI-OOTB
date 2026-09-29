import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import SvgDots from "../../../assets/agentIcon/SvgDots";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getLeadByIdMiddleware } from "../../leadModule/Store/leadMiddleware";
import QuoteListingCard from "./quoteListingCard";
import QuoteStatsCards from "./QuoteStatsCards";
import "./index.scss";

const QuoteListing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { leadId } = useParams();
  const location = useLocation();

  // Extract leadRefId from URL search parameters
  const searchParams = new URLSearchParams(location.search);
  const leadRefId = searchParams.get("leadRefId") || leadId;

  // Get current lead details from Redux
  const { currentLeadDetails } = useSelector(({ leadReducer }) => ({
    currentLeadDetails: leadReducer?.currentLeadDetails,
  }));

  // Fetch lead details when leadRefId is available
  useEffect(() => {
    if (leadRefId) {
      dispatch(getLeadByIdMiddleware(leadRefId));
    }
  }, [dispatch, leadRefId]);

  // Get the generated lead ID or fallback
  const displayLeadId =
    currentLeadDetails?.generatedLeadId || leadRefId || t("common.loading");

  const items = [
    { label: t("quoteListing.breadcrumbLeads"), command: () => navigate("/agent/leadlisting") },
    { label: t("quoteListing.breadcrumbQuotations"), command: () => navigate("/agent/quotelisting") },
    {
      label: `${t("quoteListing.breadcrumbLeadId")}: ${displayLeadId}`,
      command: () => navigate("/agent/quotelisting"),
    },
  ];
  const Initiate = { label: t("quoteListing.home") };

  return (
    <div className="quotelisting__overal__container">
      <div className="grid mt-3">
        <div className="col-12 md:col-12 lg:col-12">
          <label className="leadlisting__overal__container__title">
            {t("quoteListing.title")}
          </label>
        </div>
      </div>
      <div className="breadcrumb-wrapper">
        <BreadCrumb
          model={items}
          home={Initiate}
          className="breadCrums"
          separatorIcon={<SvgDots color={"#000"} />}
        />
      </div>
      <QuoteStatsCards leadRefId={leadRefId} />
      <QuoteListingCard />
    </div>
  );
};

export default QuoteListing;
