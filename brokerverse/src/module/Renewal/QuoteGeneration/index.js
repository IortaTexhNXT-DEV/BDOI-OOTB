import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Steps } from "primereact/steps";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { Checkbox } from "primereact/checkbox";
import { Divider } from "primereact/divider";
import { Badge } from "primereact/badge";
import { ProgressSpinner } from "primereact/progressspinner";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import SvgDot from "../../../assets/icons/SvgDot";
import { calendarDateFormat, formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

const QuoteGeneration = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode, locale } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const { policyId: renewalId } = useParams();
  const [activeIndex, setActiveIndex] = useState(0);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [policyData, setPolicyData] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [premiumCalculation, setPremiumCalculation] = useState(null);
  const [selectedOffers, setSelectedOffers] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [comparisonVisible, setComparisonVisible] = useState(false);
  const [sendQuoteVisible, setSendQuoteVisible] = useState(false);
  const toast = useRef(null);

  // Form data
  const [formData, setFormData] = useState({
    // Coverage adjustments
    adjustCoverage: false,
    newSumInsured: null,
    adjustDeductible: false,
    newDeductible: null,

    // Premium factors
    claimsImpact: 0,
    loyaltyDiscount: 0,
    riskAdjustment: 0,
    inflationAdjustment: 0,

    // Special considerations
    multiPolicyDiscount: false,
    earlyRenewalDiscount: false,
    noClaimsBonus: false,

    // Quote details
    validUntil: new Date(Date.now() + 30*24*60*60*1000),
    specialTerms: '',
    notes: ''
  });

  const stepItems = [
    { label: t("renewal.policyReview") },
    { label: t("renewal.premiumCalculation") },
    { label: t("renewal.retentionOffers") },
    { label: t("renewal.quoteSummary") }
  ];

  const paymentOptions = Object.keys(settings["accounting.cash_account_by_payment_mode"] || {}).map(method => ({
    label: method,
    value: method
  }));

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.quoteGeneration"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    const loadRenewal = async () => {
      setLoading(true);
      try {
        const [renewal, taxSettings, renewalSettings, accountingSettings] = await Promise.all([
          renewalsWorkspaceService.getRenewal(renewalId || location.state?.policy?.id),
          renewalsWorkspaceService.getSettings("tax"),
          renewalsWorkspaceService.getSettings("renewals"),
          renewalsWorkspaceService.getSettings("accounting")
        ]);
        const allSettings = { ...taxSettings, ...renewalSettings, ...accountingSettings };
        setSettings(allSettings);
        setPolicyData(renewal);
        initializeFormData(renewal, allSettings);
        const currentQuote = renewal.quotes?.find(q => q.status === 'generated');
        if (currentQuote) applyQuote(currentQuote);
      } catch (error) {
        toast.current?.show({
          severity: 'error',
          summary: t("common.error"),
          detail: error?.message || t("renewal.failedToLoadRenewalData"),
          life: 3000
        });
      } finally {
        setLoading(false);
      }
    };
    loadRenewal();
  }, [renewalId, location.state, t]);

  const initializeFormData = (policy, config) => {
    const percent = (key) => Number(config[key] || 0) * 100;
    const claimsImpact = Math.min((policy.claimsHistory?.totalClaims || 0) * percent("renewals.claims_loading_rate"), percent("renewals.claims_loading_cap"));
    const loyaltyDiscount = Math.min((policy.loyaltyYears || 0) * percent("renewals.loyalty_discount_rate"), percent("renewals.loyalty_discount_cap"));

    setFormData(prev => ({
      ...prev,
      claimsImpact,
      loyaltyDiscount,
      inflationAdjustment: 0,
      newSumInsured: policy.sumInsured,
      newDeductible: policy.deductible ?? null
    }));
  };

  const calculatePremium = () => {
    if (!policyData) return;

    const basePremium = policyData.currentPremium;

    // Calculate adjustments
    const claimsLoading = (basePremium * formData.claimsImpact) / 100;
    const loyaltyDiscount = (basePremium * formData.loyaltyDiscount) / 100;
    const riskAdjustment = (basePremium * formData.riskAdjustment) / 100;
    const inflationAdjustment = (basePremium * formData.inflationAdjustment) / 100;

    // Special discounts
    let multiPolicyDiscount = 0;
    let earlyRenewalDiscount = 0;
    let noClaimsBonus = 0;

    if (formData.multiPolicyDiscount) {
      multiPolicyDiscount = basePremium * 0.08; // 8% discount
    }

    if (formData.earlyRenewalDiscount) {
      earlyRenewalDiscount = basePremium * 0.03; // 3% discount
    }

    if (formData.noClaimsBonus && !policyData.claimsHistory?.hasClaimsLastYear) {
      noClaimsBonus = basePremium * 0.05; // 5% bonus
    }

    const subtotal = basePremium + claimsLoading + riskAdjustment + inflationAdjustment
                    - loyaltyDiscount - multiPolicyDiscount - earlyRenewalDiscount - noClaimsBonus;

    // Statutory taxes at the configured rates (Settings > tax)
    const rate = (key) => Number(settings[key] || 0);
    const isFire = policyData.lob === 'fire';
    const taxes = {
      vat: subtotal * rate("tax.vat_rate"),
      dst: subtotal * rate("tax.dst_rate"),
      lgt: subtotal * rate("tax.lgt_rate"),
      fst: isFire ? subtotal * rate("tax.fst_rate") : 0
    };

    const totalTaxes = Object.values(taxes).reduce((sum, tax) => sum + tax, 0);
    const totalPremium = subtotal + totalTaxes;

    const calculation = {
      basePremium,
      adjustments: {
        claimsLoading,
        loyaltyDiscount: -loyaltyDiscount,
        riskAdjustment,
        inflationAdjustment,
        multiPolicyDiscount: -multiPolicyDiscount,
        earlyRenewalDiscount: -earlyRenewalDiscount,
        noClaimsBonus: -noClaimsBonus
      },
      subtotal,
      taxes,
      totalTaxes,
      totalPremium,
      percentageChange: ((totalPremium - basePremium) / basePremium) * 100
    };

    setPremiumCalculation(calculation);
    return calculation;
  };

  useEffect(() => {
    if (policyData && !quoteData) {
      calculatePremium();
    }
  }, [formData, policyData, settings, quoteData]);

  const handleNext = () => {
    if (activeIndex < stepItems.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  /** Shows a server-rated quote (re-rated premium, loadings, statutory taxes) in the breakdown and summary. */
  const applyQuote = (quote) => {
    const calc = quote.premiumCalculation || {};
    const totalTaxes = Object.values(calc.taxes || {}).reduce((sum, tax) => sum + tax, 0);
    setPremiumCalculation({
      basePremium: calc.basePremium,
      adjustments: { claimsLoading: calc.claimsLoading || 0, loyaltyDiscount: calc.loyaltyDiscount || 0 },
      subtotal: calc.subtotal,
      taxes: calc.taxes || {},
      totalTaxes,
      totalPremium: quote.quotedPremium,
      percentageChange: quote.premiumVariancePct
    });
    setQuoteData(quote);
    setFormData(prev => ({ ...prev, validUntil: new Date(quote.validUntil) }));
  };

  const handleGenerateQuote = async () => {
    setLoading(true);
    try {
      const quote = await renewalsWorkspaceService.generateQuote(policyData.id);
      applyQuote(quote);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.quoteGenerated"),
        detail: t("renewal.quoteGeneratedSuccess", { number: quote.quoteNumber }),
        life: 3000
      });
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message || t("renewal.failedToGenerateQuote"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuote = () => {
    setSendQuoteVisible(true);
  };

  const quoteNote = () => {
    const offers = selectedOffers.map(id => retentionOffers.find(o => o.id === id)?.type).filter(Boolean);
    return [formData.specialTerms, offers.length ? `Offers: ${offers.join(', ')}` : '', paymentMethod ? `Payment: ${paymentMethod}` : '']
      .filter(Boolean)
      .join('; ');
  };

  const handleSendQuoteConfirm = async () => {
    setSendQuoteVisible(false);
    try {
      await renewalsWorkspaceService.submitForApproval(policyData.id, quoteNote() || undefined);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.quoteSent"),
        detail: t("renewal.quoteSentTo", { name: policyData.insuredName }),
        life: 3000
      });
      navigate('/renewal/queue');
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message,
        life: 3000
      });
    }
  };

  const handleCompleteRenewal = async () => {
    setLoading(true);
    try {
      const result = await renewalsWorkspaceService.complete(policyData.id);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.completeRenewal", "Complete Renewal"),
        detail: result?.newPolicy?.policyNumber,
        life: 3000
      });
      navigate('/renewal/queue');
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message,
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value, decimals = 1) => {
    return `${value?.toFixed(decimals) || 0}%`;
  };

  const retentionOffers = [
    {
      id: 1,
      type: "Multi-Year Discount",
      description: "5% discount for 2-year policy commitment",
      discount: 5,
      conditions: "Non-cancellable for 2 years"
    },
    {
      id: 2,
      type: "Bundle Discount",
      description: "Add another product line for additional 8% discount",
      discount: 8,
      conditions: "Minimum coverage amount required"
    },
    {
      id: 3,
      type: "Loyalty Reward",
      description: "Additional 3% discount for long-term clients",
      discount: 3,
      conditions: "Customer for 3+ years"
    },
    {
      id: 4,
      type: "Payment Incentive",
      description: "2% discount for annual payment",
      discount: 2,
      conditions: "Full payment within 30 days"
    }
  ];

  const renderStepContent = () => {
    switch (activeIndex) {
      case 0:
        return renderPolicyReview();
      case 1:
        return renderPremiumCalculation();
      case 2:
        return renderRetentionOffers();
      case 3:
        return renderQuoteSummary();
      default:
        return null;
    }
  };

  const renderPolicyReview = () => (
    <div className="step-content">
      <h3>Policy Review & Coverage Adjustments</h3>

      <div className="policy-summary">
        <div className="summary-grid">
          <div className="summary-item">
            <label>Policy Number:</label>
            <span>{policyData?.policyNumber}</span>
          </div>
          <div className="summary-item">
            <label>Insured Name:</label>
            <span>{policyData?.insuredName}</span>
          </div>
          <div className="summary-item">
            <label>Product:</label>
            <span>{policyData?.product}</span>
          </div>
          <div className="summary-item">
            <label>Current Premium:</label>
            <span>{formatCurrency(policyData?.currentPremium)}</span>
          </div>
          <div className="summary-item">
            <label>Sum Insured:</label>
            <span>{formatCurrency(policyData?.sumInsured)}</span>
          </div>
          <div className="summary-item">
            <label>Expiry Date:</label>
            <span>{formatAppDate(policyData?.expiryDate)}</span>
          </div>
        </div>
      </div>

      <Divider />

      <div className="coverage-adjustments">
        <h4>Coverage Adjustments</h4>

        <div className="form-grid">
          <div className="form-field">
            <div className="checkbox-field">
              <Checkbox
                inputId="adjustCoverage"
                checked={formData.adjustCoverage}
                onChange={(e) => setFormData({...formData, adjustCoverage: e.checked})}
              />
              <label htmlFor="adjustCoverage">Adjust Sum Insured</label>
            </div>
            {formData.adjustCoverage && (
              <InputNumber
                value={formData.newSumInsured}
                onValueChange={(e) => setFormData({...formData, newSumInsured: e.value})}
                mode="currency"
                currency={currencyCode}
                locale={locale}
              />
            )}
          </div>

          <div className="form-field">
            <div className="checkbox-field">
              <Checkbox
                inputId="adjustDeductible"
                checked={formData.adjustDeductible}
                onChange={(e) => setFormData({...formData, adjustDeductible: e.checked})}
              />
              <label htmlFor="adjustDeductible">Adjust Deductible</label>
            </div>
            {formData.adjustDeductible && (
              <InputNumber
                value={formData.newDeductible}
                onValueChange={(e) => setFormData({...formData, newDeductible: e.value})}
                mode="currency"
                currency={currencyCode}
                locale={locale}
              />
            )}
          </div>
        </div>
      </div>

      <Divider />

      <div className="special-considerations">
        <h4>Special Considerations</h4>

        <div className="checkbox-grid">
          <div className="checkbox-field">
            <Checkbox
              inputId="multiPolicy"
              checked={formData.multiPolicyDiscount}
              onChange={(e) => setFormData({...formData, multiPolicyDiscount: e.checked})}
            />
            <label htmlFor="multiPolicy">Multi-Policy Discount (8%)</label>
          </div>

          <div className="checkbox-field">
            <Checkbox
              inputId="earlyRenewal"
              checked={formData.earlyRenewalDiscount}
              onChange={(e) => setFormData({...formData, earlyRenewalDiscount: e.checked})}
            />
            <label htmlFor="earlyRenewal">Early Renewal Discount (3%)</label>
          </div>

          <div className="checkbox-field">
            <Checkbox
              inputId="noClaims"
              checked={formData.noClaimsBonus}
              onChange={(e) => setFormData({...formData, noClaimsBonus: e.checked})}
              disabled={policyData?.claimsHistory?.hasClaimsLastYear}
            />
            <label htmlFor="noClaims">No Claims Bonus (5%)</label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPremiumCalculation = () => (
    <div className="step-content">
      <h3>Premium Calculation</h3>

      <div className="calculation-container">
        <div className="calculation-inputs">
          <h4>Premium Factors</h4>

          <div className="form-grid">
            <div className="form-field">
              <label>Claims Impact (%)</label>
              <InputNumber
                value={formData.claimsImpact}
                onValueChange={(e) => setFormData({...formData, claimsImpact: e.value})}
                min={0}
                max={50}
                suffix="%"
              />
            </div>

            <div className="form-field">
              <label>Loyalty Discount (%)</label>
              <InputNumber
                value={formData.loyaltyDiscount}
                onValueChange={(e) => setFormData({...formData, loyaltyDiscount: e.value})}
                min={0}
                max={20}
                suffix="%"
              />
            </div>

            <div className="form-field">
              <label>Risk Adjustment (%)</label>
              <InputNumber
                value={formData.riskAdjustment}
                onValueChange={(e) => setFormData({...formData, riskAdjustment: e.value})}
                min={-20}
                max={30}
                suffix="%"
              />
            </div>

            <div className="form-field">
              <label>Inflation Adjustment (%)</label>
              <InputNumber
                value={formData.inflationAdjustment}
                onValueChange={(e) => setFormData({...formData, inflationAdjustment: e.value})}
                min={0}
                max={15}
                suffix="%"
              />
            </div>
          </div>
        </div>

        {premiumCalculation && (
          <div className="calculation-result">
            <h4>Premium Breakdown</h4>

            <div className="breakdown-table">
              <div className="breakdown-row">
                <span>Base Premium:</span>
                <span>{formatCurrency(premiumCalculation.basePremium)}</span>
              </div>

              {Object.entries(premiumCalculation.adjustments).map(([key, value]) => (
                value !== 0 && (
                  <div key={key} className="breakdown-row adjustment">
                    <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
                    <span className={value > 0 ? 'positive' : 'negative'}>
                      {value > 0 ? '+' : ''}{formatCurrency(value)}
                    </span>
                  </div>
                )
              ))}

              <div className="breakdown-row subtotal">
                <span>Subtotal:</span>
                <span>{formatCurrency(premiumCalculation.subtotal)}</span>
              </div>

              <div className="breakdown-row">
                <span>VAT ({Number(settings["tax.vat_rate"] || 0) * 100}%):</span>
                <span>{formatCurrency(premiumCalculation.taxes.vat)}</span>
              </div>

              <div className="breakdown-row">
                <span>DST:</span>
                <span>{formatCurrency(premiumCalculation.taxes.dst)}</span>
              </div>

              <div className="breakdown-row">
                <span>LGT:</span>
                <span>{formatCurrency(premiumCalculation.taxes.lgt)}</span>
              </div>

              {premiumCalculation.taxes.fst > 0 && (
                <div className="breakdown-row">
                  <span>FST:</span>
                  <span>{formatCurrency(premiumCalculation.taxes.fst)}</span>
                </div>
              )}

              <div className="breakdown-row total">
                <span>{t("renewal.totalPremium")}</span>
                <span>{formatCurrency(premiumCalculation.totalPremium)}</span>
              </div>

              <div className="breakdown-row change">
                <span>Change from Current:</span>
                <span className={premiumCalculation.percentageChange > 0 ? 'positive' : 'negative'}>
                  {premiumCalculation.percentageChange > 0 ? '+' : ''}{formatPercentage(premiumCalculation.percentageChange)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderRetentionOffers = () => (
    <div className="step-content">
      <h3>Retention Offers</h3>

      <div className="offers-container">
        <div className="offers-list">
          {retentionOffers.map(offer => (
            <Card key={offer.id} className={`offer-card ${selectedOffers.includes(offer.id) ? 'selected' : ''}`}>
              <div className="offer-content">
                <div className="offer-header">
                  <Checkbox
                    checked={selectedOffers.includes(offer.id)}
                    onChange={(e) => {
                      if (e.checked) {
                        setSelectedOffers([...selectedOffers, offer.id]);
                      } else {
                        setSelectedOffers(selectedOffers.filter(id => id !== offer.id));
                      }
                    }}
                  />
                  <div className="offer-info">
                    <h5>{offer.type}</h5>
                    <Badge value={`${offer.discount}% discount`} severity="success" />
                  </div>
                </div>
                <p className="offer-description">{offer.description}</p>
                <div className="offer-conditions">
                  <small>Conditions: {offer.conditions}</small>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {selectedOffers.length > 0 && premiumCalculation && (
          <div className="offers-summary">
            <h4>Additional Discounts Applied</h4>
            <div className="additional-savings">
              {selectedOffers.map(offerId => {
                const offer = retentionOffers.find(o => o.id === offerId);
                const discountAmount = (premiumCalculation.totalPremium * offer.discount) / 100;
                return (
                  <div key={offerId} className="savings-row">
                    <span>{offer.type}:</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                );
              })}

              <div className="total-savings">
                <span>Final Premium:</span>
                <span>
                  {formatCurrency(
                    premiumCalculation.totalPremium -
                    selectedOffers.reduce((total, offerId) => {
                      const offer = retentionOffers.find(o => o.id === offerId);
                      return total + (premiumCalculation.totalPremium * offer.discount) / 100;
                    }, 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderQuoteSummary = () => (
    <div className="step-content">
      <h3>Quote Summary</h3>

      {premiumCalculation && (
        <div className="quote-summary">
          <div className="summary-section">
            <h4>Policy Information</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Policy Number:</label>
                <span>{policyData?.policyNumber}</span>
              </div>
              <div className="summary-item">
                <label>Insured Name:</label>
                <span>{policyData?.insuredName}</span>
              </div>
              <div className="summary-item">
                <label>Product:</label>
                <span>{policyData?.product}</span>
              </div>
              <div className="summary-item">
                <label>Current Premium:</label>
                <span>{formatCurrency(policyData?.currentPremium)}</span>
              </div>
            </div>
          </div>

          <div className="summary-section">
            <h4>New Quote</h4>
            <div className="quote-details">
              <div className="quote-amount">
                <span className="label">{t("renewal.totalPremium")}</span>
                <span className="amount">{formatCurrency(premiumCalculation.totalPremium)}</span>
              </div>
              <div className="quote-change">
                <span className="label">{t("renewal.change")}</span>
                <span className={`change ${premiumCalculation.percentageChange > 0 ? 'increase' : 'decrease'}`}>
                  {premiumCalculation.percentageChange > 0 ? '+' : ''}{formatPercentage(premiumCalculation.percentageChange)}
                </span>
              </div>
            </div>
          </div>

          {selectedOffers.length > 0 && (
            <div className="summary-section">
              <h4>Special Offers Included</h4>
              <ul className="offers-summary">
                {selectedOffers.map(offerId => {
                  const offer = retentionOffers.find(o => o.id === offerId);
                  return (
                    <li key={offerId}>
                      <strong>{offer.type}</strong> - {offer.description}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="summary-section">
            <h4>Quote Settings</h4>
            <div className="form-grid">
              <div className="form-field">
                <label>Valid Until:</label>
                <Calendar
                  value={formData.validUntil}
                  onChange={(e) => setFormData({...formData, validUntil: e.value})}
                  dateFormat={calendarDateFormat()}
                  minDate={new Date()}
                />
              </div>

              <div className="form-field">
                <label>Payment Method:</label>
                <Dropdown
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.value)}
                  options={paymentOptions}
                />
              </div>
            </div>

            <div className="form-field full-width">
              <label>Special Terms & Notes:</label>
              <InputText
                value={formData.specialTerms}
                onChange={(e) => setFormData({...formData, specialTerms: e.target.value})}
                placeholder={t("renewal.enterSpecialTerms")}
              />
            </div>
          </div>

          <div className="quote-actions">
            <Button
              label="Generate Quote"
              icon="pi pi-file-o"
              onClick={handleGenerateQuote}
              loading={loading}
              className="p-button-success"
              disabled={!policyData?.isOpen || ['pending-approval'].includes(policyData?.statusCode)}
            />

            {policyData?.statusCode === 'approved' && (
              <Button
                label={t("renewal.completeRenewal", "Complete Renewal")}
                icon="pi pi-check-circle"
                onClick={handleCompleteRenewal}
                loading={loading}
              />
            )}

            {quoteData && (
              <>
                <Button
                  label="View Comparison"
                  icon="pi pi-eye"
                  className="p-button-info"
                  onClick={() => setComparisonVisible(true)}
                />

                <Button
                  label="Send Quote"
                  icon="pi pi-send"
                  onClick={handleSendQuote}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="container__quote__generation__master">
      <Toast ref={toast} />

      <div className="top__container">
        <h1 className="page__title">{t("renewal.quoteGeneration")}</h1>
        <BreadCrumb model={items} home={home} />
      </div>

      <div className="content-container">
        <Card className="steps-card">
          <Steps model={stepItems} activeIndex={activeIndex} readOnly={false} />
        </Card>

        <Card className="content-card">
          {loading ? (
            <div className="loading-container">
              <ProgressSpinner />
              <p>{t("renewal.processingQuoteGeneration")}</p>
            </div>
          ) : (
            renderStepContent()
          )}

          <div className="step-navigation">
            <Button
              label={t("renewal.previous")}
              icon="pi pi-arrow-left"
              className="p-button-text"
              onClick={handlePrevious}
              disabled={activeIndex === 0}
            />

            {activeIndex < stepItems.length - 1 && (
              <Button
                label={t("common.next")}
                icon="pi pi-arrow-right"
                iconPos="right"
                onClick={handleNext}
              />
            )}

            <Button
              label={t("renewal.backToQueue")}
              icon="pi pi-times"
              className="p-button-secondary"
              onClick={() => navigate('/renewal/queue')}
            />
          </div>
        </Card>

        {/* Quote Comparison Dialog */}
        <Dialog
          header={t("renewal.quoteComparison")}
          visible={comparisonVisible}
          onHide={() => setComparisonVisible(false)}
          style={{ width: '80vw' }}
        >
          {quoteData && premiumCalculation && (
            <div className="comparison-content">
              <div className="comparison-table">
                <div className="comparison-row header">
                  <span>Item</span>
                  <span>Current Policy</span>
                  <span>New Quote</span>
                  <span>Change</span>
                </div>

                <div className="comparison-row">
                  <span>Premium</span>
                  <span>{formatCurrency(policyData.currentPremium)}</span>
                  <span>{formatCurrency(premiumCalculation.totalPremium)}</span>
                  <span className={premiumCalculation.percentageChange > 0 ? 'increase' : 'decrease'}>
                    {formatPercentage(premiumCalculation.percentageChange)}
                  </span>
                </div>

                <div className="comparison-row">
                  <span>Sum Insured</span>
                  <span>{formatCurrency(policyData.sumInsured)}</span>
                  <span>{formatCurrency(formData.newSumInsured || policyData.sumInsured)}</span>
                  <span>
                    {formData.adjustCoverage ? 'Modified' : 'No change'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Dialog>

        {/* Send Quote Dialog */}
        <Dialog
          header={t("renewal.sendQuote")}
          visible={sendQuoteVisible}
          onHide={() => setSendQuoteVisible(false)}
          style={{ width: '400px' }}
          footer={
            <div>
              <Button
                label="Cancel"
                icon="pi pi-times"
                className="p-button-text"
                onClick={() => setSendQuoteVisible(false)}
              />
              <Button
                label="Send"
                icon="pi pi-send"
                onClick={handleSendQuoteConfirm}
              />
            </div>
          }
        >
          <div className="send-quote-content">
            <p>Send quote to:</p>
            <div className="contact-info">
              <div><strong>Name:</strong> {policyData?.insuredName}</div>
              <div><strong>Email:</strong> {policyData?.insuredContact?.email}</div>
              <div><strong>Mobile:</strong> {policyData?.insuredContact?.mobile}</div>
            </div>

            {quoteData && (
              <div className="quote-info">
                <div><strong>Quote Number:</strong> {quoteData.quoteNumber}</div>
                <div><strong>Valid Until:</strong> {formatAppDate(formData.validUntil)}</div>
              </div>
            )}
          </div>
        </Dialog>
      </div>
    </div>
  );
};

export default QuoteGeneration;