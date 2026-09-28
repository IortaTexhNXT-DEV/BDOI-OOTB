import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card"; 
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom"; 
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import {
  AutopassengerpersonalAccidentOptions,
  BodilyInjuryOptions,
  PropertyDamageOptions,
  covers,
  PremiumOPtions
} from "./mockdataforcoverDetails";
import InputTextField from "../component/inputText";
import { APPATotalCoverageOptions } from "./mockdataforcoverDetails";
import { postcoverageDetailsMiddleware } from "../quoteModule/coverageDetails/store/coverageDetailsMiddleware";
import DropdownField from "../component/DropdwonField";
import customHistory from "../../routes/customHistory";
import CalculaitionTextInputs from "../component/calculaitionTextInputs"; 
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";
const CoverageDetailsCard = ({ action, flow, coInsurance, installmentType }) => {
  const { t } = useTranslation();
  const [show, setshow] = useState(true);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isOverRide, setOverRide] = useState(false)
  const { CoverageDetails, loading } = useSelector(
    ({ agentCoverageDetailsReducers }) => {
      return {
        loading: agentCoverageDetailsReducers?.loading,
        CoverageDetails: agentCoverageDetailsReducers?.CoverageDetails,
      };
    }
  );

  console.log(CoverageDetails, "find CoverageDetails");
  useEffect(() => {
    if (action === "coveragedetail") {
      setFormikValuesPatch();
    }
    // if (action === "coveragedetail") {
    //   formik.setFieldValue("BodilyInjury", BodilyInjuryOptions[0].value);
    // }
    if (action === "coveragedetail") {
      formik.setFieldValue("PropertyDamage", PropertyDamageOptions[0].value);
    }
    if (action === "coveragedetail") {
      formik.setFieldValue(
        "AutopassengerpersonalAccident",
        AutopassengerpersonalAccidentOptions[0].value
      );
    }
    if (action === "coveragedetail") {
      formik.setFieldValue(
        "APPATotalCoverage",
        APPATotalCoverageOptions[0].value
      );
    }
  }, []);

  const handleclick = (values) => {
    console.log(action, "action1");
    dispatch(postcoverageDetailsMiddleware(values));
    {
      action === "coveragedetail"
        ? flow === "renewal"
          ? navigate(
            `/agent/employee-benefit/create-quote-order-summary`, { state: { coInsurance, installmentType } }
          )
          : navigate(`/agent/employee-benefit/create-quote-order-summary`, { state: { coInsurance, installmentType } })
        : navigate(`/agent/employee-benefit/create-quote-order-summary`, { state: { coInsurance, installmentType } });
    }
  };

  const hadlecalculation = () => {
    setFormikValues();
    setshow(false);
  };
  const handleOverride = () => {
    setOverRide(!isOverRide)
  } 
  const initialValue = {
    LossandDamagecoverage: "",
    LossandDamagecoverageRate: "",
    LossandDamagecoveragepremium: "",
    ActsofNatureRate: "",
    ActsofNaturepremium: "",
    BodilyInjury: "",
    BodilyInjuryCoveragePremium: "",
    PropertyDamage: "",
    PropertyDamageCoveragePremium: "",
    AutopassengerpersonalAccident: "",
    APPATotalCoverage: "",
    APPACoveragePremium: "",
    TotalSumInsured: "",
  };
  const setFormikValuesPatch = () => {
    const updatedValues = {
      LossandDamagecoverage: CoverageDetails?.LossandDamagecoverage,
      LossandDamagecoverageRate: CoverageDetails?.LossandDamagecoverageRate,
      ActsofNatureRate: CoverageDetails?.ActsofNatureRate,
      BodilyInjury: CoverageDetails?.BodilyInjury,
      PropertyDamage: CoverageDetails?.PropertyDamage,
      AutopassengerpersonalAccident:
        CoverageDetails?.AutopassengerpersonalAccident,
      APPATotalCoverage: CoverageDetails?.APPATotalCoverage,
      LossandDamagecoveragepremium:
        CoverageDetails?.LossandDamagecoveragepremium,
      ActsofNaturepremium: CoverageDetails?.ActsofNaturepremium,
      BodilyInjuryCoveragePremium: CoverageDetails?.BodilyInjuryCoveragePremium,
      PropertyDamageCoveragePremium:
        CoverageDetails?.PropertyDamageCoveragePremium,
      APPACoveragePremium: CoverageDetails?.APPACoveragePremium,
      TotalSumInsured: CoverageDetails?.TotalSumInsured,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const setFormikValues = () => {
    const updatedValues = {
      LossandDamagecoveragepremium: "11,780.00",
      ActsofNaturepremium: "11,780.00",
      BodilyInjuryCoveragePremium: "350.00",
      PropertyDamageCoveragePremium: "11,780.00",
      APPACoveragePremium: "25.00",
      TotalSumInsured: "3,25,000.00",
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const handleBackNavigation = () => {
    customHistory.back();
  };

  const formik = useFormik({
    initialValues: initialValue,
    // validate:customValidation,
    onSubmit: (values) => {
      handleclick(values);
      // hadlecalculation();
    },
  });

  const handleLeadNavigation = () => {
    navigate(-1)
  }

  return (
    <div className="coverage__details__card__container mt-4">


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
      <Card style={{marginTop:"20px"}}>
        <div className="coverage__details__card__container__title">
          {flow === "renewal" ? t("employeeBenefit.renewalDetails") : t("employeeBenefit.createQuote")}
        </div>
        <div className="coverage__details__card__container__sub__title mt-2 mb-2">
          {t("employeeBenefit.coveragesDetails")}
        </div>
       <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("employeeBenefit.selectCovers")}
              // value={formik.values.BodilyInjury}
               value={covers[0].value}
              options={covers}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("BodilyInjury", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.BodilyInjury && formik.errors.BodilyInjury && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.BodilyInjury}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
             <DropdownField
              label="Premium Options"
              value={formik.values.BodilyInjury}
              options={PremiumOPtions}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("BodilyInjury", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.BodilyInjury && formik.errors.BodilyInjury && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.BodilyInjury}
              </div>
            )}
          </div>
        </div>
{/* 
         <div class="col-12 mt-2">
          <InputTextField
            label={t("employeeBenefit.medicalCoverage")}
            value={formik.values.LossandDamagecoverage}
            onChange={formik.handleChange("LossandDamagecoverage")}
            error={
              formik.touched.LossandDamagecoverage &&
              formik.errors.LossandDamagecoverage
            }
          />
        </div> */}
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("employeeBenefit.medicalCoverage")}
              value={  formik.values.LossandDamagecoverageRate  }
              onChange={formik.handleChange("LossandDamagecoverageRate")}
            />
            {formik.touched.LossandDamagecoverageRate &&
              formik.errors.LossandDamagecoverageRate && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.LossandDamagecoverageRate}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ?
              <InputTextField
                label={t("employeeBenefit.medicalCoveragePremium")}
                value={
                  action == "coveragecreate"
                    ? formik.values.LossandDamagecoveragepremium
                    : ""
                }
                onChange={formik.handleChange("LossandDamagecoveragepremium")}
              /> : <CalculaitionTextInputs
                label={t("employeeBenefit.medicalCoveragePremium")}
                value={
                   
                    formik.values.LossandDamagecoveragepremium
                    
                }
                onChange={formik.handleChange("LossandDamagecoveragepremium")}
              />
            }

            {formik.touched.LossandDamagecoveragepremium &&
              formik.errors.LossandDamagecoveragepremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.LossandDamagecoveragepremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("employeeBenefit.employersLiabilityCoverage")}
              // value={formik.values.ActsofNatureRate}
              value={  formik.values.ActsofNatureRate }
              // value={formik.values.ActsofNatureRate}
              onChange={formik.handleChange("ActsofNatureRate")}
            />
            {formik.touched.ActsofNatureRate &&
              formik.errors.ActsofNatureRate && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.ActsofNatureRate}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ?
              <InputTextField
                label={t("employeeBenefit.employersLiabilityCoveragePremium")}
                // value={formik.values.LossandDamagecoverageRate}
                value={
                  action == "coveragecreate"
                    ? formik.values.ActsofNaturepremium
                    : ""
                }
                onChange={formik.handleChange("ActsofNaturepremium")}
              />
              : <CalculaitionTextInputs
                label={t("employeeBenefit.employersLiabilityCoveragePremium")}
                // value={formik.values.ActsofNaturepremium}
                // value={
                //   action == "coveragecreate"
                //     ? formik.values.ActsofNaturepremium
                //     : "0.00"
                // }
                value={formik.values.ActsofNaturepremium}
                onChange={formik.handleChange("ActsofNaturepremium")}
              />
            }
            {formik.touched.ActsofNaturepremium &&
              formik.errors.ActsofNaturepremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.ActsofNaturepremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("employeeBenefit.anyOneOccurrenceLimitCoverage")}
              value={formik.values.BodilyInjury}
              options={BodilyInjuryOptions}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("BodilyInjury", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.BodilyInjury && formik.errors.BodilyInjury && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.BodilyInjury}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ? <InputTextField
              label={t("employeeBenefit.anyOneOccurrenceLimitCoveragePremium")}
              // value={formik.values.LossandDamagecoverageRate}
              value={ formik.values.BodilyInjuryCoveragePremium
                  
              }
              onChange={formik.handleChange("BodilyInjuryCoveragePremium")}
            /> : <CalculaitionTextInputs
              label={t("employeeBenefit.anyOneOccurrenceLimitCoveragePremium")}
              // value={formik.values.BodilyInjuryCoveragePremium}
              value={ formik.values.BodilyInjuryCoveragePremium
                 
              }
              onChange={formik.handleChange("BodilyInjuryCoveragePremium")}
            />
            }    {formik.touched.BodilyInjuryCoveragePremium &&
              formik.errors.BodilyInjuryCoveragePremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.BodilyInjuryCoveragePremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("employeeBenefit.paCoverage")}
              value={formik.values.PropertyDamage}
              options={PropertyDamageOptions}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("PropertyDamage", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.PropertyDamage && formik.errors.PropertyDamage && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.PropertyDamage}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ? <InputTextField
              label={t("employeeBenefit.paCoveragePremium")}
              // value={formik.values.LossandDamagecoverageRate}
              value={
                action == "coveragecreate"
                  ? formik.values.PropertyDamageCoveragePremium
                  : ""
              }
              onChange={formik.handleChange("PropertyDamageCoveragePremium")}
            /> : <CalculaitionTextInputs
              label={t("employeeBenefit.paCoveragePremium")}
              // value={formik.values.PropertyDamageCoveragePremium}
              // value={
              //   action == "coveragecreate"
              //     ? formik.values.PropertyDamageCoveragePremium
              //     : "0.0%"
              // }
              value={formik.values.PropertyDamageCoveragePremium}
              onChange={formik.handleChange("PropertyDamageCoveragePremium")}
            />}
            {formik.touched.PropertyDamageCoveragePremium &&
              formik.errors.PropertyDamageCoveragePremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.PropertyDamageCoveragePremium}
                </div>
              )}
          </div>
        </div>
        {/* <div className="grid m-0 mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            <DropdownField
              label="Critical Illness Coverage"
              value={formik.values.AutopassengerpersonalAccident}
              options={AutopassengerpersonalAccidentOptions}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("AutopassengerpersonalAccident", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.AutopassengerpersonalAccident &&
              formik.errors.AutopassengerpersonalAccident && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.AutopassengerpersonalAccident}
                </div>
              )}
          </div>
        </div> */}

        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("employeeBenefit.dependentsCoverage")}
              // value={formik.values.APPATotalCoverage}
              onChange={formik.handleChange("APPATotalCoverage")} 
              value={formik.values.APPATotalCoverage}
            />
            {formik.touched.APPATotalCoverage &&
              formik.errors.APPATotalCoverage && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.APPATotalCoverage}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ? <InputTextField
              label={t("employeeBenefit.dependentsCoveragePremium")}
              // value={formik.values.APPATotalCoverage}
              onChange={formik.handleChange("APPACoveragePremium")}
              // value={
              //   action == "coveragecreate"
              //     ? formik.values.APPATotalCoverage
              //     : "0.0%"
              // }
              value={formik.values.APPACoveragePremium}
            /> : <CalculaitionTextInputs
              label={t("employeeBenefit.dependentsCoveragePremium")}
              // value={formik.values.APPACoveragePremium}
              // value={
              //   action == "coveragecreate"
              //     ? formik.values.APPACoveragePremium
              //     : "0.0%"
              // }
              value={formik.values.APPACoveragePremium}
              onChange={formik.handleChange("APPACoveragePremium")}
            />}
            {formik.touched.APPACoveragePremium &&
              formik.errors.APPACoveragePremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.APPACoveragePremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            {isOverRide ?
              <InputTextField
                label="Total Employee Benefits Sum Insured"
                // value={formik.values.APPATotalCoverage}
                onChange={formik.handleChange("TotalSumInsured")}
                // value={
                //   action == "coveragecreate"
                //     ? formik.values.APPATotalCoverage
                //     : "0.0%"
                // }
                value={formik.values.TotalSumInsured}
              />
              : <CalculaitionTextInputs
                label="Total Employee Benefits Sum Insured"
                value={formik.values.TotalSumInsured}
                // value={
                //   action == "coveragecreate"
                //     ? formik.values.TotalSumInsured
                //     : "0.00"
                // }
                onChange={formik.handleChange("TotalSumInsured")}
              />}
            {formik.touched.TotalSumInsured &&
              formik.errors.TotalSumInsured && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.TotalSumInsured}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6 " style={{
            display: 'flex'
          }}>
            <div className="calculation__btn__container">
              <Button
                label={t("employeeBenefit.calculate")}
                className="calculation__btn"
                onClick={hadlecalculation}
              />
            </div>
            <div className="calculation__btn__container" style={{
              marginLeft: "20px"
            }}>
              <Button
                label={isOverRide ? t("employeeBenefit.save") : t("employeeBenefit.override")}
                className="calculation__btn"
                onClick={handleOverride}
              />

            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 back__next__btn__container ">
             
              <div style={{cursor:"pointer"}} onClick={handleLeadNavigation} >
                   {t("employeeBenefit.back")}
               </div>
           
            <div style={{width:'full'}}>
              <Button
                className="next__btn"
                onClick={formik.handleSubmit}
                // onClick={navigate('/agent/employee-benefit/create-quote-order-summary')}
                disabled={show === true ? true : false}
              >
                {t("employeeBenefit.next")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CoverageDetailsCard;
