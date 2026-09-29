import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
// import SvgRightarrow from "../../../assets/agentIcon/SvgRightArrow";
// import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
// import ShareOption from "./Modal/ShareOption";
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";
import SvgRightarrow from "../../assets/agentIcon/SvgRightArrow";
import ShareOption from "../quoteModule/quoteDetailView/Modal/ShareOption";

const CQquoteDetails = ({ action }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [modalVisible, setModalVisible] = useState(false);

  const { PolicyDetails, loading } = useSelector(({ policyDetailsReducer }) => {
    return {
      loading: policyDetailsReducer?.loading,
      PolicyDetails: policyDetailsReducer?.PolicyDetails,
    };
  });

  const { CoverageDetails } = useSelector(({ coverageDetailsReducer }) => {
    return {
      CoverageDetails: coverageDetailsReducer?.CoverageDetails,
    };
  });

  const { OrderSummary } = useSelector(({ orderSummaryReducer }) => {
    return {
      OrderSummary: orderSummaryReducer?.OrderSummary,
    };
  });

  const { createleaddata } = useSelector(({ leadReducer }) => {
    return {
      createleaddata: leadReducer?.createleaddata,
    };
  });

  console.log(
    PolicyDetails,
    CoverageDetails,
    OrderSummary,
    createleaddata,
    "Alldata"
  );

  const handleclick = () => {
    navigate('/agent/employee-benefit/policy-waiting-for-policy')
    console.log(action, "find initial logic");
    // if (action == "view") {
    //   navigate(`/agent/convertpolicy/customerinfo/view/${12}`, { state: state });
    // }
    // if (action == "edit") {
    //   navigate(`/agent/convertpolicy/customerinfo/edit/${12}`, { state: state });
    // }
  };
  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };
  return (
    <div className="overall__quotedetails__view__container">
      <div className="header_title">Leads</div>
      <div
        onClick={handleLeadNavigation}
        className="left_arrow mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="left_arrow_text">Lead ID : 12345678</div>
      </div>
      <Card className="mt-4">
        <div className="table_header">Quote details</div>
        <div className="quote_details">
          <label>Please check quote details</label>
          <label>Quote ID :123456</label>
        </div>
        <div className="sub_title">
          <label className="policy_text">Policy Details</label>
          <div className="quote_details">
            <label className="insurance_text">Insurance Company</label>
            <label className="alpha_text">
              {/* {PolicyDetails.InsuranceCompanyName} */}
              SecureGuard Insurance
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("employeeBenefit.insurancePolicyType")}</label>
            <label className="alpha_text">
              {/* {PolicyDetails.InsurancePolicyType} */}
              CV
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("employeeBenefit.accountCode")}</label>
            <label className="alpha_text">
              {/* {PolicyDetails.AccountCode} */}
              Acc012345
            </label>
          </div>
        </div>
        <div className="sub_title">
          <label className="policy_text">Assured Details</label>
          <div className="quote_details">
            <label className="insurance_text">Name</label>
            <label className="alpha_text">
              {/* {createleaddata.FirstName} */}
              Carson
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Email ID</label>
            <label className="alpha_text">
              {/* {createleaddata.EmailID} */}
              contact@broker.com
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Contact Number</label>
            <label className="alpha_text">
              9874563210
              {/* {createleaddata.ContactNumber} */}
            </label>
          </div>
        </div>
        <div className="sub_title">
          <label className="policy_text">Risk Details</label>
          <div className="quote_details">
            <label className="insurance_text">Category of Employees</label>
            <label className="alpha_text">
              {/* {PolicyDetails.VehicleBrand} */}
           Management
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Occupation</label>
            <label className="alpha_text">
              {/* {PolicyDetails.ModelYear} */}
              Office
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">No. of Staff</label>
            <label className="alpha_text">
              {/* {PolicyDetails.VehicleModel} */}
             150
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Estimated Annual Earning</label>
            <label className="alpha_text">
              {/* {PolicyDetails.ModelVariant} */}
             15,000,000
            </label>
          </div>

          <div className="quote_details">
            <label className="insurance_text">Limit per Person</label>
            <label className="alpha_text">
              {/* {PolicyDetails.VehicleColor} */}
              500,000
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Limit per Occurrence</label>
            <label className="alpha_text">
              {/* {PolicyDetails.SeatingCapacity} */}5,000,000
            </label>
          </div>
        </div>
        <div className="sub_title">
          <label className="policy_text">Coverage details</label>
          <div className="quote_details">
            <label className="insurance_text">Total Sum Insured</label>
            <label className="alpha_text">
              3,25,000.00
              {/* {CoverageDetails.TotalSumInsured} */}
            </label>
          </div>
        </div>
        <div className="sub_title">
          <label className="policy_text">Payment Details</label>
          <div className="quote_details">
            <label className="insurance_text">NET Premium</label>
            <label className="alpha_text">
              100,000.00
              {/* {OrderSummary.NETpremium} */}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">DST</label>
            <label className="alpha_text">
              {/* {OrderSummary.DocumentaryStampTax} */}
              400.00
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">VAT</label>
            <label className="alpha_text">
              {/* {OrderSummary.ValueAddedTax} */}
              500.00
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">LGT</label>
            <label className="alpha_text">
              {/* {OrderSummary.LocalGovtTax} */}
              550.00
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Others</label>
            <label className="alpha_text">
              {/* {OrderSummary.Others} */}
              550
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Discount</label>
            <label className="alpha_text">
              {/* {OrderSummary.Discount} */}
              -500.00
            </label>
          </div>
          <div className="quote_details">
            <label className="gross_text">Gross premium</label>
            <label className="gross_count">
              {/* {OrderSummary.GrossPremium} */}
              104,900.00
            </label>
          </div>
        </div>
      </Card>
      <div className="button_component">
        <Button
          label="Share"
          severity="help"
          text
          className="download_button"
          onClick={() => setModalVisible(true)}
        />
        <Button
          onClick={handleclick}
          label="Send to Insurance Company"
          classNames="policy_button"
        >
          <SvgRightarrow />
        </Button>
      </div>
      <ShareOption
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
      />
    </div>
  );
};

export default CQquoteDetails;
