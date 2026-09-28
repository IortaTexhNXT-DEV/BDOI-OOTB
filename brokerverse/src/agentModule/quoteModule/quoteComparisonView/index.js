import React, { useState, useEffect } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import SvgRightarrow from "../../../assets/agentIcon/SvgRightArrow";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { useNavigate, useLocation } from "react-router-dom";
import quotationService from "../../../services/quotationService";
import { vehicleColourLabel } from "../../../utility/quoteOptions";

const QuoteDetailView = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quotation1, setQuotation1] = useState(null);
  const [quotation2, setQuotation2] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        setError(null);

        // Extract quotation IDs from URL query params
        const searchParams = new URLSearchParams(location.search);
        const quotationId1 = searchParams.get('quotationId1');
        const quotationId2 = searchParams.get('quotationId2');

        if (!quotationId1 || !quotationId2) {
          setError(t("agent.missingQuotationIds"));
          setLoading(false);
          return;
        }

        // Fetch comparison data from API
        const result = await quotationService.compareQuotations(quotationId1, quotationId2);

        if (!result.success) {
          setError(result.error || t("agent.failedToLoadComparison"));
          setLoading(false);
          return;
        }

        const { quotation1: q1, quotation2: q2, aiInsights: ai } = result.data;
        setQuotation1(q1);
        setQuotation2(q2);
        setAiInsights(ai);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching comparison:', err);
        setError(t("agent.unexpectedErrorComparison"));
        setLoading(false);
      }
    };

    fetchComparison();
  }, [location.search]);

  const handleBack = () => {
    navigate(-1);
  };

  const getImpactBadgeClass = (impact) => {
    switch (impact) {
      case 'high': return 'impact-badge-high';
      case 'medium': return 'impact-badge-medium';
      case 'low': return 'impact-badge-low';
      default: return 'impact-badge-low';
    }
  };

  if (loading) {
    return (
      <div className="overall__quotecomparision__view__container">
        <div className="header_title">{t("agent.quoteComparison")}</div>
        <div className="loading-container">
          <ProgressSpinner />
          <p className="mt-3">{t("agent.loadingComparisonData")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overall__quotecomparision__view__container">
        <div className="header_title">{t("agent.quoteComparison")}</div>
        <Card className="mt-4">
          <div className="error-container">
            <i className="pi pi-exclamation-triangle" style={{ fontSize: '3rem', color: '#f59e0b' }}></i>
            <h3>{t("agent.unableToLoadComparison")}</h3>
            <p>{error}</p>
            <Button label={t("agent.goBack")} icon="pi pi-arrow-left" onClick={handleBack} />
          </div>
        </Card>
      </div>
    );
  }

  if (!quotation1 || !quotation2) {
    return (
      <div className="overall__quotecomparision__view__container">
        <div className="header_title">{t("agent.quoteComparison")}</div>
        <Card className="mt-4">
          <div className="error-container">
            <p>{t("agent.noQuotationDataAvailable")}</p>
            <Button label={t("agent.goBack")} onClick={handleBack} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="overall__quotecomparision__view__container">
      <div className="header_title">{t("agent.quoteComparison")}</div>
      <div className="left_arrow mt-3" onClick={handleBack} style={{ cursor: 'pointer' }}>
        <SvgLeftArrow />
        <label className="left_arrow_text">{t("agent.backToQuotes")}</label>
      </div>

      {/* AI Insights Card */}
      {aiInsights && !aiInsights.error && (
        <Card className="mt-4 ai-insights-card">
          <div className="ai-insights-header">
            <i className="pi pi-sparkles"></i>
            <h3>{t("agent.aiPoweredInsights")}</h3>
          </div>
          
          <div className="ai-section">
            <h4>{t("agent.summary")}</h4>
            <p>{aiInsights.summary}</p>
          </div>

          {aiInsights.keyDifferences && aiInsights.keyDifferences.length > 0 && (
            <div className="ai-section">
              <h4>{t("agent.keyDifferences")}</h4>
              <div className="key-differences-list">
                {aiInsights.keyDifferences.map((diff, idx) => (
                  <div key={idx} className="difference-item">
                    <span className={`impact-badge ${getImpactBadgeClass(diff.impact)}`}>
                      {diff.impact}
                    </span>
                    <strong>{diff.category}:</strong> {diff.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiInsights.pricingAnalysis && (
            <div className="ai-section">
              <h4>{t("agent.pricingAnalysis")}</h4>
              <div className="pricing-grid">
                <div className="pricing-item">
                  <span className="label">{t("agent.quote1Total")}</span>
                  <span className="value">{formatCurrency(aiInsights.pricingAnalysis.quote1Total)}</span>
                </div>
                <div className="pricing-item">
                  <span className="label">{t("agent.quote2Total")}</span>
                  <span className="value">{formatCurrency(aiInsights.pricingAnalysis.quote2Total)}</span>
                </div>
                <div className="pricing-item highlight">
                  <span className="label">{t("agent.difference")}</span>
                  <span className="value">
                    {formatCurrency(Math.abs(aiInsights.pricingAnalysis.difference))} 
                    ({aiInsights.pricingAnalysis.percentageDifference?.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <p className="mt-3">{aiInsights.pricingAnalysis.analysis}</p>
            </div>
          )}

          {aiInsights.recommendation && (
            <div className="ai-section recommendation-section">
              <h4>{t("agent.recommendation")}</h4>
              <div className="recommendation-box">
                <div className="recommendation-header">
                  <i className="pi pi-thumbs-up"></i>
                  <span>
                    {aiInsights.recommendation.preferredQuote === 'quote1' ? t("agent.quote1Recommended") :
                     aiInsights.recommendation.preferredQuote === 'quote2' ? t("agent.quote2Recommended") :
                     t("agent.dependsOnYourNeeds")}
                  </span>
                </div>
                <p>{aiInsights.recommendation.reasoning}</p>
                {aiInsights.recommendation.considerations && aiInsights.recommendation.considerations.length > 0 && (
                  <div className="considerations">
                    <strong>{t("agent.consider")}</strong>
                    <ul>
                      {aiInsights.recommendation.considerations.map((consideration, idx) => (
                        <li key={idx}>{consideration}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="ai-section pros-cons-section">
            <div className="grid">
              <div className="col-6">
                <h4>Quote 1 ({quotation1.quotationNumber})</h4>
                {aiInsights.quote1Pros && aiInsights.quote1Pros.length > 0 && (
                  <div className="pros-list">
                    <strong className="pros-label">{t("agent.pros")}</strong>
                    <ul>
                      {aiInsights.quote1Pros.map((pro, idx) => (
                        <li key={idx} className="pro-item">{pro}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiInsights.quote1Cons && aiInsights.quote1Cons.length > 0 && (
                  <div className="cons-list">
                    <strong className="cons-label">{t("agent.cons")}</strong>
                    <ul>
                      {aiInsights.quote1Cons.map((con, idx) => (
                        <li key={idx} className="con-item">{con}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="col-6">
                <h4>Quote 2 ({quotation2.quotationNumber})</h4>
                {aiInsights.quote2Pros && aiInsights.quote2Pros.length > 0 && (
                  <div className="pros-list">
                    <strong className="pros-label">{t("agent.pros")}</strong>
                    <ul>
                      {aiInsights.quote2Pros.map((pro, idx) => (
                        <li key={idx} className="pro-item">{pro}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiInsights.quote2Cons && aiInsights.quote2Cons.length > 0 && (
                  <div className="cons-list">
                    <strong className="cons-label">{t("agent.cons")}</strong>
                    <ul>
                      {aiInsights.quote2Cons.map((con, idx) => (
                        <li key={idx} className="con-item">{con}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <div className="table_header">{t("agent.sideBySideComparison")}</div>

        <div className="grid">
          <div className="col-6">
            <div className="quote__id__text">{t("agent.quoteId")} {quotation1.quotationNumber}</div>
          </div>
          <div className="col-6">
            <div className="quote__id">{t("agent.quoteId")} {quotation2.quotationNumber}</div>
          </div>
        </div>
        <div className="grid">
          <div className="col-6">
          <div className="sub_title">
          <label className="policy_text">{t("agent.policyDetailsLabel")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.insuranceCompany")}</label>
            <label className="alpha_text">{quotation1.participantDetails?.[0]?.insuranceCompanyName || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.insurancePolicyType")}</label>
            <label className="alpha_text">{quotation1.insurancePolicyType || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.accountCode")}</label>
            <label className="alpha_text">{quotation1.accountCode || 'N/A'}</label>
          </div>
        </div>
            </div>
            <div className="col-6">
               <div className="sub_title">
          <label className="policy_text">{t("agent.policyDetailsLabel")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.insuranceCompany")}</label>
            <label className="alpha_text">{quotation2.participantDetails?.[0]?.insuranceCompanyName || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.insurancePolicyType")}</label>
            <label className="alpha_text">{quotation2.insurancePolicyType || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.accountCode")}</label>
            <label className="alpha_text">{quotation2.accountCode || 'N/A'}</label>
          </div>
        </div>
            </div>
          </div>
      
       <div className="grid">
        <div className="col-6">
        <div className="sub_title">
          <label className="policy_text">{t("agent.assuredDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.name")}</label>
            <label className="alpha_text">
              {quotation1.lead 
                ? `${quotation1.lead.firstName || ''} ${quotation1.lead.lastName || ''}`.trim() 
                : 'N/A'}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.emailId")}</label>
            <label className="alpha_text">{quotation1.lead?.emailId || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.contactNumber")}</label>
            <label className="alpha_text">{quotation1.lead?.contactNumber || 'N/A'}</label>
          </div>
        </div>

        </div>
        <div className="col-6">
        <div className="sub_title">
          <label className="policy_text">{t("agent.assuredDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.name")}</label>
            <label className="alpha_text">
              {quotation2.lead 
                ? `${quotation2.lead.firstName || ''} ${quotation2.lead.lastName || ''}`.trim() 
                : 'N/A'}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.emailId")}</label>
            <label className="alpha_text">{quotation2.lead?.emailId || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.contactNumber")}</label>
            <label className="alpha_text">{quotation2.lead?.contactNumber || 'N/A'}</label>
          </div>
        </div>
        </div>

       </div>

<div className="grid">
        <div className="col-6">
        <div className="sub_title">
          <label className="policy_text">{t("agent.insuranceVehicleDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.vehicleBrand")}</label>
            <label className="alpha_text">{quotation1.insuranceVehicleDetails?.vehicleBrand || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.modelYear")}</label>
            <label className="alpha_text">{quotation1.insuranceVehicleDetails?.modelYear || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.vehicleModel")}</label>
            <label className="alpha_text">{quotation1.insuranceVehicleDetails?.vehicleModel || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.modelVariant")}</label>
            <label className="alpha_text">{quotation1.insuranceVehicleDetails?.modelVariant || 'N/A'}</label>
          </div>

          <div className="quote_details">
            <label className="insurance_text">Vehicle Color</label>
            <label className="alpha_text">{vehicleColourLabel(quotation1.insuranceVehicleDetails?.vehicleColor) || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.seatingCapacity")}</label>
            <label className="alpha_text">{quotation1.insuranceVehicleDetails?.seatingCapacity || 'N/A'}</label>
          </div>
        </div>
        </div>
        <div className="col-6">
        <div className="sub_title">
          <label className="policy_text">{t("agent.insuranceVehicleDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.vehicleBrand")}</label>
            <label className="alpha_text">{quotation2.insuranceVehicleDetails?.vehicleBrand || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.modelYear")}</label>
            <label className="alpha_text">{quotation2.insuranceVehicleDetails?.modelYear || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.vehicleModel")}</label>
            <label className="alpha_text">{quotation2.insuranceVehicleDetails?.vehicleModel || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.modelVariant")}</label>
            <label className="alpha_text">{quotation2.insuranceVehicleDetails?.modelVariant || 'N/A'}</label>
          </div>

          <div className="quote_details">
            <label className="insurance_text">Vehicle Color</label>
            <label className="alpha_text">{vehicleColourLabel(quotation2.insuranceVehicleDetails?.vehicleColor) || 'N/A'}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.seatingCapacity")}</label>
            <label className="alpha_text">{quotation2.insuranceVehicleDetails?.seatingCapacity || 'N/A'}</label>
          </div>
        </div>
        </div>
        </div>

<div className="grid">
<div className="col-6">
        <div className="sub_title">
          <label className="policy_text">Coverage details</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.lossAndDamageCoverage")}</label>
            <label className="alpha_text">{formatCurrency(quotation1.lossAndDamageCoverage)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Bodily Injury Coverage</label>
            <label className="alpha_text">{formatCurrency(quotation1.bodilyInjury)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.propertyDamageCoverage")}</label>
            <label className="alpha_text">{formatCurrency(quotation1.propertyDamage)}</label>
          </div>
        </div>
        </div>
        <div className="col-6">
        <div className="sub_title">
          <label className="policy_text">Coverage details</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.lossAndDamageCoverage")}</label>
            <label className="alpha_text">{formatCurrency(quotation2.lossAndDamageCoverage)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Bodily Injury Coverage</label>
            <label className="alpha_text">{formatCurrency(quotation2.bodilyInjury)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.propertyDamageCoverage")}</label>
            <label className="alpha_text">{formatCurrency(quotation2.propertyDamage)}</label>
          </div>
        </div>
        </div>
        </div>

        <div className="grid">
        <div className="col-6">
        <div className="sub_title">
          <label className="policy_text">Payment Details</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.netPremium")}</label>
            <label className="alpha_text">{formatCurrency(quotation1.netPremium)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.dst")}</label>
            <label className="alpha_text">{formatCurrency(quotation1.docStampTax)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.vat")}</label>
            <label className="alpha_text">{formatCurrency(quotation1.vat)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.lgt")}</label>
            <label className="alpha_text">{formatCurrency(quotation1.localGovTax)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Others</label>
            <label className="alpha_text">{formatCurrency(quotation1.otherCharges)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.discount")}</label>
            <label className="alpha_text">-{formatCurrency(quotation1.discount)}</label>
          </div>
          <div className="quote_details">
            <label className="gross_texts">Gross premium</label>
            <label className="gross_counts">{formatCurrency(quotation1.grossPremium)}</label>
          </div>
        </div>
        </div>
        <div className="col-6">
        <div className="sub_title">
          <label className="policy_text">Payment Details</label>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.netPremium")}</label>
            <label className="alpha_text">{formatCurrency(quotation2.netPremium)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.dst")}</label>
            <label className="alpha_text">{formatCurrency(quotation2.docStampTax)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.vat")}</label>
            <label className="alpha_text">{formatCurrency(quotation2.vat)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.lgt")}</label>
            <label className="alpha_text">{formatCurrency(quotation2.localGovTax)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Others</label>
            <label className="alpha_text">{formatCurrency(quotation2.otherCharges)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("agent.discount")}</label>
            <label className="alpha_text">-{formatCurrency(quotation2.discount)}</label>
          </div>
          <div className="quote_details">
            <label className="gross_text">{t("agent.grossPremium")}</label>
            <label className="gross_count">{formatCurrency(quotation2.grossPremium)}</label>
          </div>
        </div>
        </div>
        </div>
      </Card>
      {/* <div className="button_component">
        <Button label="Download" className="policy_button">
        </Button>
      </div> */}
    </div>
  );
};

export default QuoteDetailView;
