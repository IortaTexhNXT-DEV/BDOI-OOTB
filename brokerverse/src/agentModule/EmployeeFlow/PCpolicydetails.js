import { Card } from "primereact/card";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useFormik } from "formik";
import InputTextField from "../component/inputText";
import SvgBlueArrow from "../../assets/agentIcon/SvgBlueArrow";
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";
import documentTemplateService from "../../services/documentTemplateService";
import billingService from "../../services/billingService";

const initialValues = {
  PolicyNumber: "",
  Production: "12/12/2024",
  Inception: "12/12/2024",
  IssueDate: "12/12/2024",
  Expiry: "12/12/2025",
};

const handleSubmit = () => {
};

const PCpolicyDetails = ({ action, state: stateProp }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = stateProp || location.state;

  const handleclick = () => {
    // Parse premium values from display strings (remove commas)
    const parsePremium = (value) => {
      if (typeof value === "string") {
        return parseFloat(value.replace(/,/g, "")) || 0;
      }
      return value || 0;
    };

    navigate("/agent/employee-benefit/paymentconfirmation", {
      state: {
        fromPolicyDetail: true,
        policyId:
          state?.policyId || policydetailedlist?.policyId || "MOCK-POLICY-001",
        policyNumber: policydetailedlist?.PolicyNumber || "POL-EMP-001",
        clientId: state?.clientId || "MOCK-CLIENT-001",
        clientNumber: state?.clientNumber || "12345678",
        clientName: state?.clientName || "Carson Darrin",
        ClientName: state?.ClientName || "Carson Darrin",
        // Premium values - using values from the policy details display
        grossPremium: parsePremium("104,900.00"),
        netPremium: parsePremium("89,165.00"), // Approx 85% of gross
        valueAddedTax: parsePremium("5,245.00"), // Approx 5% of gross
        documentaryStampTax: parsePremium("5,245.00"), // Approx 5% of gross
        localGovernmentTax: parsePremium("3,147.00"), // Approx 3% of gross
        accountPremiumOthers: parsePremium("2,098.00"), // Approx 2% of gross
        discount: parsePremium("0.00"),
      },
    });
  };
  const handlePayLater = () => {
    const clientId = state?.clientId;
    if (clientId) {
      navigate(`/agent/clientview/${clientId}`, { replace: true });
    } else {
      navigate(-1);
    }
  };
  const handleAccountingSubmit = () => {
    const clientId = state?.clientId;
    if (clientId) {
      navigate(`/agent/premium-accounting-entries/${clientId}`);
    } else {
      navigate(-1);
    }
  };

  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => {
      return {
        loading: policyDetailedViewMainReducers?.loading,
        policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
      };
    }
  );

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: () => {
      handleSubmit();
    },
  });

  const policyId = state?.policyId || state?.id;

  const handlePolicySubmit = () => {
    if (policyId) documentTemplateService.getPolicySchedulePdf(policyId);
  };

  const handleInvoiceSubmit = () => {
    if (policyId) billingService.generatePolicyBillingStatement(policyId);
  };
  let flow = "renewal";

  const handleLeadNavigation = () => {
    navigate(-1);
  };

  return (
    <div className="policy__detail__view__card__container mt-4">
      <div className="order__summary__main__title">
        {flow === "renewal" ? t("employeeBenefit.client") : t("employeeBenefit.leads")}
      </div>
      <div
        onClick={handleLeadNavigation}
        className="order__summary__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="order__summary__back__btn__title">
          {flow === "renewal"
            ? `Carson Darrin / ${t("employeeBenefit.clientIdLabel")} 12345678`
            : `${t("employeeBenefit.leadIdLabel")} 12345678`}
        </div>
      </div>

      <Card style={{ marginTop: "20px" }}>
        <div className="policy__details__card__view__container__title">
          {t("employeeBenefit.policyDetailsTitle")}
        </div>
        <div className="grid mt-2">
          <div className="col-12">
            <InputTextField
              label="Insurance Company"
              value="SecureGuard Insurance"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("employeeBenefit.product")} value="Employee Benefit" />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("employeeBenefit.policyNumber")}
              value={policydetailedlist.PolicyNumber}
              onChange={formik.handleChange("PolicyNumber")}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("employeeBenefit.production")}
              value={formik.values.Production}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="Inception"
              value={formik.values.Inception}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="Issue Date"
              value={formik.values.IssueDate}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("employeeBenefit.expiry")}
              value={formik.values.Expiry}
            />

          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("employeeBenefit.totalCoverage")} value="3,25,000.00" />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("employeeBenefit.grossPremium")} value="104,900.00" />
          </div>
        </div>

        <div className="policy__detail__view__title mt-2">{t("employeeBenefit.documents")}</div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <div
              onClick={() => handlePolicySubmit()}
              className="policy__detail__view__box"
            >
              <div className="grid mt-2">
                <div className="col-12 md:col-6 lg:col-6">
                  <div className="policy__detail__view__box__title">{t("employeeBenefit.policy")}</div>
                </div>
                <div className="col-12 md:col-6 lg:col-6">
                  <div className="policy__detail__view__box__container">
                    <div className="policy__detail__view__box__sub__title">
                      {t("employeeBenefit.view")}
                    </div>
                    <SvgBlueArrow />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <div
              onClick={() => handleInvoiceSubmit()}
              className="policy__detail__view__box"
            >
              <div className="grid mt-2">
                <div className="col-12 md:col-6 lg:col-6">
                  <div className="policy__detail__view__box__title">
                    {t("employeeBenefit.invoice")}
                  </div>
                </div>
                <div className="col-12 md:col-6 lg:col-6">
                  <div className="policy__detail__view__box__container">
                    <div className="policy__detail__view__box__sub__title">
                      {t("employeeBenefit.view")}
                    </div>
                    <SvgBlueArrow />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <div
              onClick={() => handleAccountingSubmit()}
              className="policy__detail__view__box"
            >
              <div className="grid mt-2">
                <div className="col-12 md:col-6 lg:col-6">
                  <div className="policy__detail__view__box__title">
                    {t("employeeBenefit.premiumAccountingEntries")}
                  </div>
                </div>
                <div className="col-12 md:col-6 lg:col-6">
                  <div className="policy__detail__view__box__container">
                    <div className="policy__detail__view__box__sub__title">
                      {t("employeeBenefit.view")}
                    </div>
                    <SvgBlueArrow />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "1rem", // equivalent to mt-4
          }}
        >
          <div style={{ marginRight: "1rem", cursor: "pointer" }}>
            <p className="back__btn" onClick={handlePayLater}>
              {t("employeeBenefit.payLater")}
            </p>
          </div>
          <div>
            <Button
              className="next__btn"
              onClick={() => {
                handleclick();
              }}
            >
              {t("employeeBenefit.proceedToPayment")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PCpolicyDetails;
