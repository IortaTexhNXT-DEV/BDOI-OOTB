import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import NavBar from "../../../../components/NavBar";
import SvgDot from "../../../../assets/icons/SvgDot";
import "./index.scss";
import { useNavigate } from "react-router-dom";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import { ScrollPanel } from "primereact/scrollpanel";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import LabelWrapper from "../../../../components/LabelWrapper";

const SubAdd = () => {
  const { t } = useTranslation();
  const { subAccountView, loading } = useSelector(
    ({ subAccountMainReducers }) => {
      return {
        loading: subAccountMainReducers?.loading,
        subAccountView: subAccountMainReducers?.subAccountView,
      };
    }
  );
  console.log(subAccountView, "subAccountView");
  const navigation = useNavigate();
  const [visiblePopup, setVisiblePopup] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedOption1, setSelectedOption1] = useState(null);

  const items = [
    { label: "Sub Account", url: "/master/finance/subaccount" },
    {
      label: "Sub Account Details",
      url: "/master/finance/subaccount/subaccountdetails",
    },
  ];
  const texts = [
    { label: subAccountView.mainAccount, value: subAccountView.mainAccount },
  ];
  const texts1 = [
    { label: subAccountView.currencyCode, value: subAccountView.currencyCode },
  ];

  const home = { label: t("financeMasters.master") };
  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisiblePopup(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visiblePopup]);

  return (
    <div className="grid sub__details">
      <div className="col-12"></div>
      <div className="col-12 mb-2">
        <div className="svgback_container">
          <span onClick={() => navigation(-1)}>
            <SvgBackicon />
          </span>
          <div className="add__sub__title">Sub Account Details</div>
        </div>
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>

      <Card style={{width:"100%"}}>
        <div className="grid sub__details">
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              label="Sub Account Code"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              value={subAccountView.subAccountCode}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              label="Sub Account Code"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              value={subAccountView.subAccountName}
            />
          </div>
        </div>
        <div className="grid sub__details">
          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              label="Description"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              value={subAccountView.description}
            />
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12  md:col-6 lg-col-6">
            <label className="main_acc_text">Main Account Code</label>

            <div>
              <ScrollPanel className="scrollpanal_container">
                <div className="selected__data__view mt-2">
                  {texts.map((selectedValue, index) => (
                    <div key={index}>{selectedValue.value}</div>
                  ))}
                </div>
              </ScrollPanel>
            </div>
          </div>
          <div class="sm-col-12  md:col-6 lg-col-6">
            <label className="main_acc_text">Currency</label>

            <div>
              <ScrollPanel className="scrollpanal_container">
                <div className="selected__data__view mt-2">
                  {texts1.map((selectedValue, index) => (
                    <div key={index}>{selectedValue.value}</div>
                  ))}
                </div>
              </ScrollPanel>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
export default SubAdd;
