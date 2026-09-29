import React, { useEffect } from "react";
import { Button } from "primereact/button";
import "./index.scss";
import { useNavigate, useLocation } from "react-router-dom";
import CardComponent from "../Cardcomponent";
import LabelWrapper from "../LabelWrapper";
import { Dialog } from "primereact/dialog";
import { useLanguage } from "../../config/LanguageContext";
import SvgSuccess from "../../Assets/Icon/SvgSuccess";

const QuoteButtonComponent = ({
  handleSubmit,
  label,
  setVisible,
  visible,
  navigation,
  handleExit,
  popLabelname,
  visiblechange,
  setVisiblechange,
  disabled,
}) => {
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if you are on the "clientdetails" or "clientdetails save" screens
  const isClientDetailsScreen = location.pathname.includes(
    "clientdetails" &&
      "PartialPaymentone" &&
      "PartialPaymenttwo" &&
      "fullpayment" &&
      "fullypaid"
  );

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        setVisible(false);
        navigate(`/${navigation}`);
      }, 2000);
    }
  }, [visible]);

  useEffect(() => {
    if (visiblechange) {
      navigate(`/${navigation}`);
    }
  }, [visiblechange]);

  return (
    <div>
      {isClientDetailsScreen ? null : (
        <Button
          label="Exit"
          className="back_button p-0 mr-2"
          rounded
          onClick={handleExit}
          link
        />
      )}
      <Button
        label={label}
        className="submit_button p-0"
        rounded
        onClick={handleSubmit}
        disabled={disabled || false}
        type="submit"
      />

      <Dialog
        visible={visible}
        onHide={() => setVisible(false)}
        className="common__dialog"
      >
        <div class="grid ">
          <div class="col">
            <CardComponent className="success_popup">
              <LabelWrapper
                label={translate("leadcreatescreen")["Successfully"]}
                textSize={"12px"}
                textColor={"#05CD99"}
              />
              <LabelWrapper
                label={popLabelname}
                textSize={"18px"}
                textColor={"#05CD99"}
              />
              <SvgSuccess />
              <LabelWrapper
                label={translate("leadcreatescreen")["Lead ID: 12345678"]}
                textSize={"12px"}
                textColor={"#05CD99"}
              />
            </CardComponent>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default QuoteButtonComponent;
