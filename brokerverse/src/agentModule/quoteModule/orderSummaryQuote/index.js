import React, { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { Card } from "primereact/card";
import SvgCountPlusIcon from "../../../assets/icons/SvgCountPlusIcon";
import SvgCountMinusIcon from "../../../assets/icons/SvgCountMinusIcon";
import CalculaitionTextInputs from "../../component/calculaitionTextInputs";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Button } from "primereact/button";
import DropdownField from "../../component/DropdwonField";
import CustomToast from "../../../components/Toast";
import { useNavigate, useParams } from "react-router-dom";
import customHistory from "../../../routes/customHistory";
import { useFormik } from "formik";
import useSignatoryOptions from "../utils/useSignatoryOptions";
import { postOrderSummaryMiddleware } from "./store/orderSummaryMiddleware";
import { useDispatch, useSelector } from "react-redux";
import { createQuotationMiddleware, updateQuotationMiddleware } from "../Store/quotationMiddleware";
import { setQuoteOrderSummary, clearCurrentQuoteCreation } from "../Store/quotationReducer";
import { transformToBackendFormat } from "../utils/quotationDataTransform";
import { calculateOrderSummary } from "../utils/premiumCalculations";
import useTaxRates from "../utils/useTaxRates";
import { fetchProductTemplateByIdMiddleware } from "../../../module/ProductConfigurator/store/productConfiguratorMiddleware";
import { notifyError } from "../../../utility/dialogs";

const initialValue = {
  NETpremium: "",
  ValueAddedTax: "",
  Others: "",
  AuthorizedSignature: "",
  DocumentaryStampTax: "",
  LocalGovtTax: "",
  Discount: "",
  NCD: "",
  GrossPremium: "",
};

const OrderSummary = () => {
  const { t } = useTranslation();
  const [discount, setDiscount] = useState(0);
  const [ncd, setNcd] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const { id: leadRefId } = useParams();
  
  // Get Redux state
  const { currentQuoteCreation, loading, productConfigurator } = useSelector(
    ({ quotationReducers, productConfiguratorReducer }) => ({
      currentQuoteCreation: quotationReducers?.currentQuoteCreation,
      loading: quotationReducers?.loading,
      productConfigurator: productConfiguratorReducer?.template,
    })
  );

  const settingsTaxRates = useTaxRates();

  // Fetch product configurator on mount
  useEffect(() => {
    dispatch(
      fetchProductTemplateByIdMiddleware({
        templateCode: "MOT-003-2025",
      })
    );
  }, [dispatch]);
  
  const isEditMode = currentQuoteCreation?.isEditMode || false;
  const existingOrderSummary = currentQuoteCreation?.orderSummary;
  // Authorised signatories from the Signatories master
  const signatoryOptions = useSignatoryOptions(existingOrderSummary?.authorizedSignature);
  
  // Use useMemo to calculate order summary values without causing re-renders
  const calculatedOrderSummary = useMemo(() => {
    if (currentQuoteCreation?.coverageDetails && currentQuoteCreation?.accessories) {
      return calculateOrderSummary(
        currentQuoteCreation.coverageDetails,
        currentQuoteCreation.accessories,
        discount,
        ncd,
        productConfigurator, // Pass productConfigurator for consistent tax rates
        settingsTaxRates
      );
    }
    return null;
  }, [currentQuoteCreation?.coverageDetails, currentQuoteCreation?.accessories, discount, ncd, productConfigurator, settingsTaxRates]);

  const handleclick = async (values) => {
    setIsSubmitting(true);
    
    // Prepare order summary data
    const orderSummaryData = {
      netPremium: values.NETpremium,
      valueAddedTax: values.ValueAddedTax,
      accountPremiumOthers: values.Others,
      documentaryStampTax: values.DocumentaryStampTax,
      localGovernmentTax: values.LocalGovtTax,
      NCD: values.NCD,
      discount: values.Discount,
      grossPremium: values.GrossPremium,
      authorizedSignature: values.AuthorizedSignature,
    };
    
    // Save to Redux
    dispatch(setQuoteOrderSummary(orderSummaryData));
    
    // Transform all accumulated data to backend format
    const quotationPayload = transformToBackendFormat(
      {
        ...currentQuoteCreation,
        orderSummary: orderSummaryData,
      },
      localStorage.getItem("USERNAME") || "agent"
    );
    
    try {
      let result;
      if (isEditMode && currentQuoteCreation.quotationId) {
        // Update existing quotation
        result = await dispatch(updateQuotationMiddleware({
          quotationId: currentQuoteCreation.quotationId,
          quotationData: quotationPayload
        })).unwrap();
      } else {
        // Create new quotation
        result = await dispatch(createQuotationMiddleware(quotationPayload)).unwrap();
      }
      
      // Also dispatch to old middleware for backward compatibility
      dispatch(postOrderSummaryMiddleware(values));
      
      // Show success message
      toastRef.current.showToast();
      
      // Clear the creation state
      dispatch(clearCurrentQuoteCreation());
      
      // Navigate to quote detail view or quote listing
      setTimeout(() => {
        if (result.quotationId) {
          navigate(`/agent/quotedetailview/${result.quotationId}`);
        } else {
          navigate(`/agent/quotelisting/${leadRefId}?leadRefId=${leadRefId}`);
        }
      }, 2000);
      
    } catch (error) {
      notifyError(`${t("agent.failedToSaveQuotation")}: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleBackNavigation = () => {
    customHistory.back();
  };

  const handleDiscountChange = (amount) => {
    const newDiscount = Math.max(0, Math.min(discount + amount, 30));
    setDiscount(newDiscount);
  };

  // Get initial values based on edit mode or calculated values
  const getInitialValues = () => {
    if (isEditMode && existingOrderSummary) {
      return {
        NETpremium: existingOrderSummary.netPremium || "",
        ValueAddedTax: existingOrderSummary.valueAddedTax || "",
        Others: existingOrderSummary.accountPremiumOthers || "",
        DocumentaryStampTax: existingOrderSummary.documentaryStampTax || "",
        LocalGovtTax: existingOrderSummary.localGovernmentTax || "",
        Discount: existingOrderSummary.discount || "",
        NCD: existingOrderSummary.NCD || "",
        GrossPremium: existingOrderSummary.grossPremium || "",
        AuthorizedSignature: existingOrderSummary.authorizedSignature || signatoryOptions[0]?.value,
      };
    }
    
    if (calculatedOrderSummary) {
      return {
        NETpremium: calculatedOrderSummary.netPremium || "",
        ValueAddedTax: calculatedOrderSummary.valueAddedTax || "",
        Others: calculatedOrderSummary.accountPremiumOthers || "",
        DocumentaryStampTax: calculatedOrderSummary.documentaryStampTax || "",
        LocalGovtTax: calculatedOrderSummary.localGovernmentTax || "",
        Discount: calculatedOrderSummary.discount || "",
        NCD: calculatedOrderSummary.NCD || "",
        GrossPremium: calculatedOrderSummary.grossPremium || "",
        AuthorizedSignature: signatoryOptions[0]?.value || "",
      };
    }
    
    return initialValue;
  };

  const formik = useFormik({
    initialValues: getInitialValues(),
    enableReinitialize: true,
    // validate,
    onSubmit: (values) => {
      handleclick(values);
    },
  });
  
  // Update calculated values when discount or NCD changes
  useEffect(() => {
    if (calculatedOrderSummary && !isEditMode) {
      formik.setFieldValue("NETpremium", calculatedOrderSummary.netPremium);
      formik.setFieldValue("ValueAddedTax", calculatedOrderSummary.valueAddedTax);
      formik.setFieldValue("DocumentaryStampTax", calculatedOrderSummary.documentaryStampTax);
      formik.setFieldValue("LocalGovtTax", calculatedOrderSummary.localGovernmentTax);
      formik.setFieldValue("NCD", calculatedOrderSummary.NCD);
      formik.setFieldValue("Discount", calculatedOrderSummary.discount);
      formik.setFieldValue("GrossPremium", calculatedOrderSummary.grossPremium);
    }
  }, [calculatedOrderSummary, discount, ncd]);

  const handlecalculation = () => {
    const count = (formik.values.GrossPremium * discount) / 100;
    formik.setFieldValue("Discount", count);
  };

  return (
    <div className="order__summary__container">
      <CustomToast ref={toastRef} message={t("agent.quoteCreatedSuccess")} />
      <div className="order__summary__main__title">{t("agent.leads")}</div>
      <div className="order__summary__back__btn mt-3">
        <SvgLeftArrow />
        <div className="order__summary__back__btn__title">
          {t("agent.leadIdPlaceholder")}
        </div>
      </div>
      <Card className="mt-4">
        <div className="order__summary__title">{t("agent.createQuote")}</div>
        <div className="order__summary__subtitle mb-2 mt-2">{t("agent.orderSummarySubtitle")}</div>
        <div class="grid mt-2 nested-grid">
          <div class="col-12 md:col-6 lg:col-6 xl:col-6">
            <div class="grid">
              <div class="col-12 md:col-12 lg:col-12 xl:col-12">
                <CalculaitionTextInputs
                  label={t("agent.netPremium")}
                  value={formik.values.NETpremium}
                  onChange={formik.handleChange("NETpremium")}
                  error={formik.touched.NETpremium && formik.errors.NETpremium}
                />
              </div>
              <div class="col-12 md:col-12 lg:col-12 xl:col-12 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.valueAddedTax")}
                  value={formik.values.ValueAddedTax}
                  onChange={formik.handleChange("ValueAddedTax")}
                  error={
                    formik.touched.ValueAddedTax && formik.errors.ValueAddedTax
                  }
                />
              </div>
            </div>
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6">
            <div className="discount__dynamic__card">
              <div className="discount__dynamic__card__title">
                {t("agent.discountOptional")}
              </div>
              <div className="discount__dynamic__card__subtitle">
                {t("agent.enterDiscountCustomer")}
              </div>
              <div className="discount__dynamic__card__bottom">
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    handleDiscountChange(-1);
                    handlecalculation();
                  }}
                >
                  <SvgCountMinusIcon />
                </div>
                <div className="discount__reflection__text">{`${discount}%`}</div>
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    handleDiscountChange(1);
                    handlecalculation();
                  }}
                >
                  <SvgCountPlusIcon />
                </div>
              </div>
            </div>
            <div
              className="discount__action__container"
              style={{ color: "green" }}
            >
              <div className="discount__action__text">{t("agent.min0")}</div>
              <div className="discount__action__text">{t("agent.max30")}</div>
            </div>
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <CalculaitionTextInputs
              label={t("agent.othersAccPremium")}
              value={formik.values.Others}
              onChange={formik.handleChange("Others")}
              error={formik.touched.Others && formik.errors.Others}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={t("agent.authorizedSignature")}
              value={formik.values.AuthorizedSignature}
              options={signatoryOptions}
              onChange={(e) => {
                formik.setFieldValue("AuthorizedSignature", e.value);
              }}
              optionLabel="label"
              error={
                formik.touched.AuthorizedSignature &&
                formik.errors.AuthorizedSignature
              }
            />
          </div>

          <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
            <div class="grid m-0">
              <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.documentaryStampTax")}
                  value={formik.values.DocumentaryStampTax}
                  onChange={formik.handleChange("DocumentaryStampTax")}
                  error={
                    formik.touched.DocumentaryStampTax &&
                    formik.errors.DocumentaryStampTax
                  }
                />
              </div>
            </div>
            <div class="grid m-0">
              <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.localGovtTax")}
                  value={formik.values.LocalGovtTax}
                  onChange={formik.handleChange("LocalGovtTax")}
                  error={
                    formik.touched.LocalGovtTax && formik.errors.LocalGovtTax
                  }
                />
              </div>
            </div>
            <div class="grid m-0">
              <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.discount")}
                  value={formik.values.Discount}
                  onChange={formik.handleChange("Discount")}
                  error={formik.touched.Discount && formik.errors.Discount}
                />
              </div>
            </div>
             <div class="grid m-0">
              <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.ncd10")}
                  value={formik.values.NCD}
                  onChange={formik.handleChange("NCD")}
                  error={formik.touched.NCD && formik.errors.NCD}
                />
              </div>
            </div>
            
            <div class="grid m-0">
              <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.grossPremiumLabel")}
                  value={formik.values.GrossPremium}
                  onChange={formik.handleChange("GrossPremium")}
                  error={
                    formik.touched.GrossPremium && formik.errors.GrossPremium
                  }
                />
              </div>
            </div>
          </div>
        </div>
        <div class="grid m-0">
          <div className="col-12 p-0">
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button
                  className="back__btn"
                  onClick={() => handleBackNavigation}
                >
                  {t("agent.back")}
                </Button>
              </div>
              <div className="next__btn__container">
                <Button
                  className="next__btn"
                  onClick={() => {
                    formik.handleSubmit();
                  }}
                  disabled={isSubmitting || loading}
                  loading={isSubmitting || loading}
                >
                  {isEditMode ? t("agent.updateQuote") : t("agent.completeQuote")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      {/* </form> */}
    </div>
  );
};

export default OrderSummary;
