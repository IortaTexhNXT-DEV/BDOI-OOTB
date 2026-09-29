import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { Card } from "primereact/card"; 
import { Button } from "primereact/button";
import { useLocation, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import useSignatoryOptions from "../quoteModule/utils/useSignatoryOptions";
import { useDispatch } from "react-redux";
import { Accordion, AccordionTab } from "primereact/accordion";
import { postOrderSummaryMiddleware } from "../quoteModule/orderSummary/store/orderSummaryMiddleware";
import customHistory from "../../routes/customHistory";
import CustomToast from "../../components/Toast";
import CalculaitionTextInputs from "../component/calculaitionTextInputs";
import SvgCountMinusIcon from "../../assets/icons/SvgCountMinusIcon";
import SvgCountPlusIcon from "../../assets/icons/SvgCountPlusIcon";
import DropdownField from "../component/DropdwonField";
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";

const initialValue = {
  NETpremium: "100,000.00",
  ValueAddedTax: "1,500.00",
  Others: "1,300.00",
  AuthorizedSignature: "",
  DocumentaryStampTax: "1,000.00",
  LocalGovtTax: "1,100.00",
  Commission: "12000.00",
  Discount: "000.00",
  NCD: "600",
  GrossPremium: "104,900.00",
};

const CQOrderSummary = ({ action, flow }) => {
  const { t } = useTranslation();
  const [discount, setDiscount] = useState(0);
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const { state } = useLocation();

  const handleclick = (values) => {
    dispatch(postOrderSummaryMiddleware(values));
    toastRef.current.showToast();
    setTimeout(() => {
      if (action === "post") {
        navigate("/agent/quotedetailview", { state: state });
      }
      if (action === "view") {
        navigate("/agent/quotedetailview", { state: state });
      }
    }, 2000);
  };
  const handleBackNavigation = () => {
    customHistory.back();
  };

  const formik = useFormik({
    initialValues: initialValue,
    // validate,
    onSubmit: (values) => {
      handleclick(values);
    },
  });
  const signatoryOptions = useSignatoryOptions(formik.values.AuthorizedSignature);

  const handleDiscountChange = (amount) => {
    const newDiscount = Math.max(0, Math.min(discount + amount, 30));
    setDiscount(newDiscount);
    handlecalculation(newDiscount);
  };

  const handlecalculation = (discountCount) => {
    const count = (formik.values.GrossPremium * discountCount) / 100;
    formik.setFieldValue("Discount", count);
  };

  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };
  return (
    <div className="order__summary__container">
      <CustomToast ref={toastRef} message={t("employeeBenefit.quoteCreatedSuccess")} />
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
      {/* <form> */}
      <Card className="mt-4">
        <div className="order__summary__title">
          {flow === "renewal" ? "Renewal Details" : "Create Quote"}
        </div>
        <div className="order__summary__subtitle mb-2 mt-2">Order Summary</div>
        <div class="grid mt-2 nested-grid">
          <div class="col-12 md:col-6 lg:col-6 xl:col-6">
            <div class="grid">
              <div class="col-12 md:col-12 lg:col-12 xl:col-12">
                <CalculaitionTextInputs
                  label="NET premium"
                  value={formik.values.NETpremium}
                  onChange={formik.handleChange("NETpremium")}
                  error={formik.touched.NETpremium && formik.errors.NETpremium}
                />
              </div>
              <div class="col-12 md:col-12 lg:col-12 xl:col-12 mt-2">
                <CalculaitionTextInputs
                  label="Value Added Tax"
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
                Discount (Optional)
              </div>
              <div className="discount__dynamic__card__subtitle">
                Enter discount you will give to customer
              </div>
              <div className="discount__dynamic__card__bottom">
                <div
                  className="cursor-pointer"
                  onClick={() => handleDiscountChange(-1)}
                >
                  <SvgCountMinusIcon />
                </div>
                <div className="discount__reflection__text">{`${discount}%`}</div>
                <div
                  className="cursor-pointer"
                  onClick={() => handleDiscountChange(1)}
                >
                  <SvgCountPlusIcon />
                </div>
              </div>
            </div>
            <div
              className="discount__action__container"
              style={{ color: "green" }}
            >
              <div className="discount__action__text">Min 0%</div>
              <div className="discount__action__text">Max 30%</div>
            </div>
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <CalculaitionTextInputs
              label="Others(Acc. premium)"
              value={formik.values.Others}
              onChange={formik.handleChange("Others")}
              error={formik.touched.Others && formik.errors.Others}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label="Authorized Signature"
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

          <div class="col-12 md:col-6 lg:col-6 xl:col-6">
            <div class="grid">
              <div class="col-12 md:col-12 lg:col-12 xl:col-12">
                <CalculaitionTextInputs
                  label="Documentary Stamp Tax"
                  value={formik.values.DocumentaryStampTax}
                  onChange={formik.handleChange("DocumentaryStampTax")}
                  error={
                    formik.touched.DocumentaryStampTax &&
                    formik.errors.DocumentaryStampTax
                  }
                />

              </div>
              <div class="col-12 md:col-12 lg:col-12 xl:col-12 mt-2">
                <CalculaitionTextInputs
                  label="Local Gov’t Tax"
                  value={formik.values.LocalGovtTax}
                  onChange={formik.handleChange("LocalGovtTax")}
                  error={
                    formik.touched.LocalGovtTax && formik.errors.LocalGovtTax
                  }
                />
              </div>
              <div class="col-12 md:col-12 lg:col-12 xl:col-12 mt-2">
                <CalculaitionTextInputs
                  label="Commission 10%"
                  value={formik.values.Commission}
                  onChange={formik.handleChange("commission")}
                  error={formik.touched.Commission && formik.errors.Commission}
                />
                   </div>
              <div class="col-12 md:col-12 lg:col-12 xl:col-12 mt-2">
                <CalculaitionTextInputs
                  label="Discount"
                  value={formik.values.Discount}
                  onChange={formik.handleChange("Discount")}
                  error={formik.touched.Discount && formik.errors.Discount}
                />
              </div>
              <div class="col-12 md:col-12 lg:col-12 xl:col-12 mt-2">
                <CalculaitionTextInputs
                  label="Gross Premium"
                  value={formik.values.GrossPremium}
                  onChange={formik.handleChange("GrossPremium")}
                  error={
                    formik.touched.GrossPremium && formik.errors.GrossPremium
                  }
                />
              </div>
            </div>
          </div>
          {state?.coInsurance && <div class="col-12 md:col-6 lg:col-6 xl:col-6">
            <Accordion activeIndex={0} style={{
              maxWidth: '100%'
            }} >
              <AccordionTab className="iconData" style={{
                maxWidth: '100%'
              }} header={
                <div
                  className="mb-2 mt-2"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div style={{
                    fontSize: '14px', color: 'black'
                  }}>Co Insurance Summary</div>
                  <div style={{ fontSize: "10px", color: "#6c737f" }}>
                    ▼
                  </div>
                </div>
              }>
                <div style={{
                  borderRadius: "10px", border: '1px solid #d1d5db'
                }} >
                  <div style={{ display: "flex", marginBottom: "8px", paddingBottom: "4px", borderBottom: '1px solid #d1d5db', height: '32px', alignItems: 'center', padding: '0 12px' }}>
                    <div style={{
                      width: '20%', textAlign: 'left', fontSize: 16
                    }}>Comp code</div>
                    <div style={{
                      width: '50%', textAlign: 'left', fontSize: 16
                    }}>Name</div>
                    <div style={{
                      width: '10%', fontSize: 16
                    }}>%</div>
                    <div style={{
                      width: '20%', fontSize: 16, textAlign: 'end'
                    }}>Premium</div>

                  </div>

                  {/* Rows */}
                  <div style={{ display: "flex", marginBottom: "8px", padding: '0 12px' }}>

                    <div style={{
                      width: '20%', textAlign: 'left', fontSize: 14, color: '#6c737f'
                    }}>CO-INS-1</div>
                    <div style={{
                      width: '50%', textAlign: 'left', fontSize: 14, color: '#6c737f'
                    }}>Apex Assurance</div>
                    <div style={{
                      width: '10%', fontSize: 14,
                      color: '#0072d8'
                    }}>20</div>
                    <div style={{
                      width: '20%', fontSize: 16, textAlign: 'end'
                    }}>
                      18,000.00
                    </div>
                  </div>
                  <div style={{ display: "flex", marginBottom: "8px", padding: '0 12px' }}>

                    <div style={{
                      width: '20%', textAlign: 'left', fontSize: 14, color: '#6c737f'
                    }}>CO-INS-2</div>
                    <div style={{
                      width: '50%', textAlign: 'left', fontSize: 14, color: '#6c737f'
                    }}>Liberty Shield Insurance</div>
                    <div style={{
                      width: '10%', fontSize: 14, color: '#0072d8'

                    }}>30</div>
                    <div style={{
                      width: '20%', fontSize: 16, textAlign: 'end'
                    }}>
                      27,000.00
                    </div>
                  </div>
                  <div style={{ display: "flex", marginBottom: "8px", padding: '0 12px' }}>

                    <div style={{
                      width: '20%', textAlign: 'left', fontSize: 14, color: '#6c737f'
                    }}>CO-INS-3</div>
                    <div style={{
                      width: '50%', textAlign: 'left', fontSize: 14, color: '#6c737f'
                    }}>Sentinel Underwriters</div>
                    <div style={{
                      width: '10%', fontSize: 14, color: '#0072d8'

                    }}>10</div>
                    <div style={{
                      width: '20%', fontSize: 16, textAlign: 'end'
                    }}>
                      9,000.00
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      padding: "12px",
                      borderTop: "1px solid #d1d5db",
                      display: 'flex'
                    }}
                  >
                    <div style={{
                      width: '20%', textAlign: 'left', fontSize: 14
                    }} />
                    <div style={{
                      width: '50%', textAlign: 'left', fontSize: 14, color: '#6c737f'
                    }}>Total</div>
                    <div style={{
                      width: '10%', fontSize: 14, color: '#0072d8'

                    }}>60</div>
                    <div style={{
                      width: '20%', fontSize: 16, textAlign: 'end'

                    }}>54,000.00</div>
                  </div>
                </div>
              </AccordionTab>
            </Accordion>
          </div>
          }
        </div>
        <div class="grid m-0">
          <div className="col-12 p-0">
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button
                  className="back__btn"
                  onClick={() => handleBackNavigation}
                >
                  Back
                </Button>
              </div>
              <div className="next__btn__container">
                <Button
                  className="next__btn"
                  onClick={() => {
                    navigate('/agent/employee-benefit/create-quote-quote-details')
                  }}
                >
                  Completed Quote
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

export default CQOrderSummary;
