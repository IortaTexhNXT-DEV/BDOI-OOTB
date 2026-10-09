import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";
import SvgRightarrow from "../../assets/agentIcon/SvgRightArrow";
import ShareOption from "../quoteModule/quoteDetailView/Modal/ShareOption";

const CQquoteDetails = ({ action }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [modalVisible, setModalVisible] = useState(false);





  const handleclick = () => {
    navigate('/agent/employee-benefit/policy-waiting-for-policy')
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
              SecureGuard Insurance
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("employeeBenefit.insurancePolicyType")}</label>
            <label className="alpha_text">
              CV
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("employeeBenefit.accountCode")}</label>
            <label className="alpha_text">
              Acc012345
            </label>
          </div>
        </div>
        <div className="sub_title">
          <label className="policy_text">Assured Details</label>
          <div className="quote_details">
            <label className="insurance_text">Name</label>
            <label className="alpha_text">
              Carson
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Email ID</label>
            <label className="alpha_text">
              contact@broker.com
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Contact Number</label>
            <label className="alpha_text">
              9874563210
            </label>
          </div>
        </div>
        <div className="sub_title">
          <label className="policy_text">Risk Details</label>
          <div className="quote_details">
            <label className="insurance_text">Category of Employees</label>
            <label className="alpha_text">
           Management
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Occupation</label>
            <label className="alpha_text">
              Office
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">No. of Staff</label>
            <label className="alpha_text">
             150
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Estimated Annual Earning</label>
            <label className="alpha_text">
             15,000,000
            </label>
          </div>

          <div className="quote_details">
            <label className="insurance_text">Limit per Person</label>
            <label className="alpha_text">
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
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">DST</label>
            <label className="alpha_text">
              400.00
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">VAT</label>
            <label className="alpha_text">
              500.00
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">LGT</label>
            <label className="alpha_text">
              550.00
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Others</label>
            <label className="alpha_text">
              550
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Discount</label>
            <label className="alpha_text">
              -500.00
            </label>
          </div>
          <div className="quote_details">
            <label className="gross_text">Gross premium</label>
            <label className="gross_count">
              104,900.00
            </label>
          </div>
        </div>
      </Card>
      <div className="button_component">
        <Button
          label="Share"
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
