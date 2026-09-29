import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getpolicyDetailedMiddleware } from "../policyDetailedView/store/policyDetailedMiddleware";
import { fetchProductTemplateByIdMiddleware } from "../../../module/ProductConfigurator/store/productConfiguratorMiddleware";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { mockPlans, PRIORITY_RULES } from "./contants";

// Priority rules for product recommendation

const calculateVehicleAge = (modelYear) => {
  if (!modelYear) return null;
  const currentYear = new Date().getFullYear();
  const year = parseInt(modelYear);
  if (isNaN(year)) return null;
  return currentYear - year;
};

const matchesCondition = (ruleValue, actualValue) => {
  if (!actualValue) return ruleValue === "Any";
  if (ruleValue === "Any") return true;
  if (Array.isArray(ruleValue)) {
    return ruleValue.some(
      (val) => val.toLowerCase() === actualValue.toLowerCase()
    );
  }
  return ruleValue.toLowerCase() === actualValue.toLowerCase();
};

const matchesVehicleType = (ruleVehicleType, actualVehicleType) => {
  if (!actualVehicleType) return ruleVehicleType === "Any";
  if (ruleVehicleType === "Any") return true;
  if (ruleVehicleType === "Any except Motorcycles/Tricycles/Trailers") {
    const excludedTypes = ["Motorcycles", "Tricycles", "Trailers"];
    return !excludedTypes.some(
      (type) =>
        actualVehicleType.toLowerCase().includes(type.toLowerCase()) ||
        type.toLowerCase() === actualVehicleType.toLowerCase()
    );
  }
  if (Array.isArray(ruleVehicleType)) {
    return ruleVehicleType.some((type) => {
      const normalizedRuleType = type.toLowerCase();
      const normalizedActualType = actualVehicleType.toLowerCase();
      // Exact match
      if (normalizedRuleType === normalizedActualType) return true;
      // Partial match (e.g., "Heavy Trucks" matches "Heavy Trucks… over 3930 KGS")
      if (
        normalizedActualType.includes(normalizedRuleType) ||
        normalizedRuleType.includes(normalizedActualType)
      ) {
        return true;
      }
      // Handle special cases
      if (
        normalizedRuleType.includes("heavy trucks") &&
        normalizedActualType.includes("heavy")
      ) {
        return true;
      }
      if (
        normalizedRuleType.includes("light/medium trucks") &&
        (normalizedActualType.includes("light") ||
          normalizedActualType.includes("medium"))
      ) {
        return true;
      }
      return false;
    });
  }
  const normalizedRuleType = ruleVehicleType.toLowerCase();
  const normalizedActualType = actualVehicleType.toLowerCase();
  // Exact match
  if (normalizedRuleType === normalizedActualType) return true;
  // Partial match
  return (
    normalizedActualType.includes(normalizedRuleType) ||
    normalizedRuleType.includes(normalizedActualType)
  );
};

const matchesAgeCondition = (ageCondition, vehicleAge) => {
  if (ageCondition === "Any" || vehicleAge === null) return true;
  if (ageCondition === "≤7") return vehicleAge <= 7;
  if (ageCondition === "≤3") return vehicleAge <= 3;
  if (ageCondition === "≥8") return vehicleAge >= 8;
  if (ageCondition === "4-7") return vehicleAge >= 4 && vehicleAge <= 7;
  return false;
};

const matchesSeating = (ruleSeating, actualSeating) => {
  if (ruleSeating === "Any") return true;
  if (!actualSeating) return false;
  const seating = parseInt(actualSeating);
  if (isNaN(seating)) return false;
  if (ruleSeating === "≥10") return seating >= 10;
  return false;
};

const getRecommendedPlan = (quotationData) => {
  if (!quotationData) {
    return "Basic"; // Default fallback
  }

  const {
    insurancePolicyType,
    vehicleType,
    vehicleBrand,
    modelVariant,
    seatingCapacity,
    modelYear,
    // location - not available in quotationData, will default to "Any"
  } = quotationData;

  const vehicleAge = calculateVehicleAge(modelYear);
  const location = quotationData.location || "Any"; // Default to "Any" if not provided

  // Check each rule in priority order
  for (const rule of PRIORITY_RULES) {
    // Check policy type
    const policyTypeMatch =
      rule.policyType === "Any" ||
      (Array.isArray(rule.policyType)
        ? rule.policyType.some(
            (pt) => pt.toLowerCase() === insurancePolicyType?.toLowerCase()
          )
        : rule.policyType.toLowerCase() === insurancePolicyType?.toLowerCase());

    if (!policyTypeMatch) continue;

    // Check vehicle type
    if (!matchesVehicleType(rule.vehicleType, vehicleType)) continue;

    // Check brand
    if (!matchesCondition(rule.brand, vehicleBrand)) continue;

    // Check model variant
    if (!matchesCondition(rule.modelVariant, modelVariant)) continue;

    // Check seating capacity
    if (!matchesSeating(rule.seating, seatingCapacity)) continue;

    // Check age condition
    if (!matchesAgeCondition(rule.ageCondition, vehicleAge)) continue;

    // Check location (if specified in rule)
    if (rule.location !== "Any" && rule.location !== location) continue;

    // All conditions matched, return recommended plan
    return rule.recommendedPlan;
  }

  // Fallback to Basic if no rule matches
  return "Basic";
};

const getRecommendationReason = (quotationData, recommendedPlan, t) => {
  if (!t) return "";
  if (!quotationData) {
    return t("policyDetail.productRecommendation.reasonDefault");
  }

  const {
    vehicleType,
    vehicleBrand,
    modelVariant,
    modelYear,
    seatingCapacity,
  } = quotationData;

  const vehicleAge = calculateVehicleAge(modelYear);
  const vehicleDescription =
    [vehicleBrand, modelVariant, vehicleType].filter(Boolean).join(" ") ||
    "vehicle";

  if (recommendedPlan === "CTPL") {
    if (vehicleAge >= 8) {
      return t("policyDetail.productRecommendation.reasonCtplOld", {
        vehicleAge,
        vehicleDescription,
      });
    }
    return t("policyDetail.productRecommendation.reasonCtplBasic", {
      vehicleDescription,
    });
  }

  if (recommendedPlan === "Basic") {
    if (vehicleAge >= 4 && vehicleAge <= 7) {
      return t("policyDetail.productRecommendation.reasonBasicAge", {
        vehicleAge,
        vehicleDescription,
      });
    }
    return t("policyDetail.productRecommendation.reasonBasicDefault", {
      vehicleDescription,
    });
  }

  if (recommendedPlan === "Comprehensive") {
    if (vehicleAge !== null && vehicleAge <= 3) {
      return t("policyDetail.productRecommendation.reasonComprehensiveNew", {
        vehicleDescription,
        vehicleAge,
      });
    }
    if (seatingCapacity && parseInt(seatingCapacity) >= 10) {
      return t("policyDetail.productRecommendation.reasonComprehensiveSeating", {
        seatingCapacity,
        vehicleDescription,
      });
    }
    return t("policyDetail.productRecommendation.reasonComprehensiveDefault", {
      vehicleDescription,
    });
  }

  return t("policyDetail.productRecommendation.reasonFallback", {
    vehicleDescription,
  });
};

const ProductRecommendation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: policyId } = useParams();
  const dispatch = useDispatch();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);

  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
    })
  );

  useEffect(() => {
    dispatch(
      fetchProductTemplateByIdMiddleware({
        templateCode: "MOT-003-2025",
      })
    );
  }, [dispatch]);

  useEffect(() => {
    if (policyId) {
      dispatch(getpolicyDetailedMiddleware({ policyId }));
    }
  }, [dispatch, policyId]);

  useEffect(() => {
    // Simulate API call to fetch plans
    const fetchPlans = async () => {
      setLoading(true);
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Get quotation data from state
      const quotationData = state?.quotationData || null;

      // Get recommended plan based on quotation data
      const recommendedPlanName = getRecommendedPlan(quotationData);

      const nameKeys = {
        CTPL: "planNameCtpl",
        Basic: "planNameBasic",
        Comprehensive: "planNameComprehensive",
      };
      const descKeys = {
        CTPL: "planDescCtpl",
        Basic: "planDescBasic",
        Comprehensive: "planDescComprehensive",
      };
      const featureKeys = {
        CTPL: "planFeatureCtpl",
        Basic: "planFeatureBasic",
        Comprehensive: "planFeatureComprehensive",
      };
      const featureCounts = { CTPL: 4, Basic: 4, Comprehensive: 5 };
      const defaultReasonKeys = {
        1: "defaultReasonCtpl",
        2: "defaultReasonBasic",
        3: "defaultReasonComprehensive",
        4: "defaultReasonAltCtpl",
        5: "defaultReasonAltBasic",
        6: "defaultReasonAltComprehensive",
      };

      // Update plans with recommendation and translated content
      const updatedPlans = mockPlans.map((plan) => {
        const isRecommended = plan.name === recommendedPlanName;
        const prefix = featureKeys[plan.name];
        const count = featureCounts[plan.name] || 0;
        const translatedFeatures = prefix
          ? Array.from({ length: count }, (_, i) =>
              t(`policyDetail.productRecommendation.${prefix}${i}`)
            )
          : plan.features;
        return {
          ...plan,
          displayName: nameKeys[plan.name]
            ? t(`policyDetail.productRecommendation.${nameKeys[plan.name]}`)
            : plan.name,
          description: descKeys[plan.name]
            ? t(`policyDetail.productRecommendation.${descKeys[plan.name]}`)
            : plan.description,
          features: translatedFeatures,
          highlight: isRecommended ? "RECOMMENDED" : plan.highlight,
          aiReason: isRecommended
            ? getRecommendationReason(
                quotationData,
                recommendedPlanName,
                t
              )
            : t(
                `policyDetail.productRecommendation.${defaultReasonKeys[plan.id] || "defaultReasonBasic"}`
              ),
        };
      });

      setPlans(updatedPlans);

      // Auto-select the "RECOMMENDED" plan
      const recommendedPlan = updatedPlans.find(
        (p) => p.highlight === "RECOMMENDED"
      );
      if (recommendedPlan) {
        setActivePlanId(recommendedPlan.id);
      } else if (updatedPlans.length > 0) {
        setActivePlanId(updatedPlans[0].id);
      }

      setLoading(false);
    };

    fetchPlans();
  }, [state?.quotationData, t]);

  const leadId = state?.leadId || state?.LeadId;
  const selectedCompany =
    state?.quotationData.insuranceCompanyName ||
    policydetailedlist?.insuranceCompany ||
    t("policyDetail.selectedCarrier");

  const handleBackNavigation = () => {
    navigate(-1);
  };

  const handlePlanSelect = (plan) => {
    setActivePlanId(plan.id);
  };

  const handleNextNavigation = (selectedPlan) => {
    console.log(state, "Product Recommendation State", selectedPlan);
    navigate(state.path, state.state);
  };

  // Filter plans by selected company
  const primaryPlans = ["CTPL", "Basic", "Comprehensive"]
    .map((tierName) => {
      const found = plans.find(
        (p) =>
          p.company.toLowerCase() === selectedCompany.toLowerCase() &&
          p.name.toLowerCase() === tierName.toLowerCase()
      );
      return (
        found ||
        plans.find((p) => p.name.toLowerCase() === tierName.toLowerCase())
      );
    })
    .filter(Boolean);

  const alternativePlans = plans.slice(3, 6);

  if (loading) {
    return (
      <div className="coverage__container">
        <div className="coverage__container__titles">{t("policyDetail.leads")}</div>
        <div className="product__recommendation__loading">
          <div className="product__recommendation__loading__spinner">
            <div className="product__recommendation__loading__spinner__outer"></div>
            <div className="product__recommendation__loading__spinner__inner"></div>
          </div>
          <p className="product__recommendation__loading__text">
            {t("policyDetail.curatingBestPlans")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="coverage__container">
      <div className="policy__container">
        <div className="coverage__container__titles">{t("policyDetail.leads")}</div>
        <div
          onClick={handleBackNavigation}
          className="policy__container__back__btn__container mt-3 cursor-pointer"
        >
          <SvgLeftArrow />
          <div className="policy__container__back__btn__title">
            {t("policyDetail.leadIdColon")} {leadId}
          </div>
        </div>
      </div>

      <Card className="px-3 shadow-none ">
        <div className="product__recommendation__wrapper">
          {/* Header Section */}
          <div className="product__recommendation__header">
            <div className="product__recommendation__header__left">
              <h2 className="product__recommendation__title">
                {t("policyDetail.planRecommendations")}
              </h2>
              <p className="product__recommendation__subtitle">
                {t("policyDetail.exclusiveCuratedTiers")}{" "}
                <span className="product__recommendation__subtitle__highlight">
                  {selectedCompany}
                </span>
              </p>
            </div>
            <div className="product__recommendation__header__right">
              <div className="product__recommendation__verified">
                <div className="product__recommendation__verified__dot"></div>
                <span>{t("policyDetail.verifiedRealTimeComparison")}</span>
              </div>
            </div>
          </div>

          {/* Primary Plans Section */}
          <section className="product__recommendation__primary">
            <div className="product__recommendation__plans__grid">
              {primaryPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isActive={activePlanId === plan.id}
                  onClick={() => setActivePlanId(plan.id)}
                  onSelect={() => handlePlanSelect(plan)}
                  isPrimary={true}
                  quotationDate={state?.quotationData}
                />
              ))}
            </div>
          </section>

          {/* Alternatives Section */}
          {/* <div className="product__recommendation__alternatives__header">
            <h3 className="product__recommendation__alternatives__title">
              Competitive Alternatives
            </h3>
            <div className="product__recommendation__alternatives__divider"></div>
          </div> */}
          {/* 
          {!showAlternatives ? (
            <div className="product__recommendation__alternatives__trigger">
              <button
                onClick={() => setShowAlternatives(true)}
                className="product__recommendation__alternatives__button"
              >
                <span>Compare with other Insurers</span>
                <div className="product__recommendation__alternatives__icon">
                  <svg
                    className="product__recommendation__alternatives__arrow"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 9l-7 7-7-7"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>
            </div>
          ) : (
            <section className="product__recommendation__alternatives__grid">
              {alternativePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isActive={activePlanId === plan.id}
                  onClick={() => setActivePlanId(plan.id)}
                  onSelect={() => handlePlanSelect(plan)}
                  isPrimary={false}
                />
              ))}

            </section>
          )} */}

          {/* Back Button */}

          <div className="justify-content-between back__next__btn__container ">
            <div className="back__btn__container">
              {/* <Button
                className="back__btn"
                onClick={() => handleBackNavigation()}
              >
                Back
              </Button> */}
            </div>
            <div className="next__btn__container">
              <Button
                className="next__btn"
                onClick={() => handleNextNavigation()}
              >
                {t("policyDetail.next")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Plan Card Component
const PlanCard = ({
  plan,
  isActive,
  isPrimary,
  onClick,
  onSelect,
  quotationDate,
}) => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const displayHighlight =
    isPrimary && plan.highlight === "RECOMMENDED"
      ? t("policyDetail.recommended")
      : plan.highlight === "BEST VALUE"
      ? t("policyDetail.productRecommendation.bestValue")
      : !isPrimary
      ? plan.highlight
      : null;

  return (
    <div
      onClick={onClick}
      className={`product__recommendation__plan__card ${
        isActive ? "product__recommendation__plan__card--active" : ""
      } ${isPrimary ? "product__recommendation__plan__card--primary" : ""}`}
    >
      {/* Badge */}
      {displayHighlight && (
        <div className="product__recommendation__plan__badge">
          <div className="product__recommendation__plan__badge__content">
            {displayHighlight}
          </div>
          <div className="product__recommendation__plan__badge__arrow"></div>
        </div>
      )}

      {/* Header */}
      <div className="product__recommendation__plan__header">
        <span className="product__recommendation__plan__company">
          {quotationDate?.insuranceCompanyName}
        </span>
        <div
          className={`product__recommendation__plan__star ${
            isActive ? "product__recommendation__plan__star--active" : ""
          }`}
        >
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      </div>

      {/* Title and Description */}
      <h4
        className={`product__recommendation__plan__name ${
          isPrimary
            ? "product__recommendation__plan__name--primary"
            : "product__recommendation__plan__name--secondary"
        }`}
      >
        {plan.displayName ?? plan.name}
      </h4>
      <p className="product__recommendation__plan__description">
        "{plan.description}"
      </p>

      {/* AI Insights */}
      {plan.aiReason && (
        <div
          className={`product__recommendation__plan__insights ${
            isActive ? "product__recommendation__plan__insights--active" : ""
          }`}
        >
          <div className="product__recommendation__plan__insights__icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M13 10V3L4 14h7v7l9-11h-7z"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="product__recommendation__plan__insights__content">
            <p className="product__recommendation__plan__insights__label">
              {t("policyDetail.advisorInsights")}
            </p>
            <p className="product__recommendation__plan__insights__text">
              {plan.aiReason}
            </p>
          </div>
        </div>
      )}

      {/* Features List */}
      <div className="product__recommendation__plan__features">
        {plan.features.map((feature, i) => (
          <div key={i} className="product__recommendation__plan__feature">
            <div
              className={`product__recommendation__plan__feature__dot ${
                isActive
                  ? "product__recommendation__plan__feature__dot--active"
                  : ""
              }`}
            ></div>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      {/* Deductible Box */}
      <div
        className={`product__recommendation__plan__deductible ${
          isActive ? "product__recommendation__plan__deductible--active" : ""
        }`}
      >
        <div className="product__recommendation__plan__deductible__header">
          <p>{t("policyDetail.deductibleAmount")}</p>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        <p className="product__recommendation__plan__deductible__amount">
          {plan.deductible}
        </p>
      </div>

      {/* Pricing */}
      <div className="product__recommendation__plan__pricing">
        <p className="product__recommendation__plan__pricing__label">
          {t("policyDetail.estimatedMonthly")}
        </p>
        <div className="product__recommendation__plan__pricing__amount">
          <span className="product__recommendation__plan__pricing__value">
            {formatCurrency(plan.monthlyPremium)}
          </span>
          <span className="product__recommendation__plan__pricing__currency">
            {currencyCode}
          </span>
        </div>
      </div>

      {/* Select Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`product__recommendation__plan__button ${
          isActive ? "product__recommendation__plan__button--active" : ""
        }`}
      >
        {isActive ? t("policyDetail.continueSelection") : t("policyDetail.selectThisPlan")}
      </button>
    </div>
  );
};

export default ProductRecommendation;
