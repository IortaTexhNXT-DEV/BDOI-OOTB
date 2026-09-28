import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import NavBar from "../../../../components/NavBar";
import SvgDot from "../../../../assets/icons/SvgDot";
import "./index.scss";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SuccessIcon from "../../../../assets/icons/SuccessIcon";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Card } from "primereact/card";
import { MultiSelect } from "primereact/multiselect";
import { useNavigate } from "react-router-dom";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { patchSubAccountEdit } from "../store/subAccountMiddleWare";
import useSubAccountOptions from "../useSubAccountOptions";
import CustomToast from "../../../../components/Toast";

const SubAdd = () => {
  const { t } = useTranslation();
  const navigation = useNavigate();

  const [visiblePopup, setVisiblePopup] = useState(false);
  const [selectedOption, setSelectedOption] = useState([
    { name: "Main0123" },
    { name: "Main0126" },
    { name: "Main0128" },
  ]);
  const [selectedOption1, setSelectedOption1] = useState([
    { name: "PHP" },
    { name: "THB" },
    { name: "USD" },
  ]);
  const handleDropdownChange = (e) => {
    setSelectedOption(e.value);
  };
  const handleDropdownChange1 = (e) => {
    setSelectedOption1(e.value);
  };
  const initialValues = {
    subAccountCode: "",
    description: "",
    subAccountName: "",
    mainAccount: [],
    currencyCode: [],
  };
  const { getSubDetailEdit, loading } = useSelector(
    ({ subAccountMainReducers }) => {
      return {
        loading: subAccountMainReducers?.loading,
        getSubDetailEdit: subAccountMainReducers?.getSubDetailEdit,
      };
    }
  );

  const items = [
    { label: "Sub Account", url: "/master/finance/subaccount" },
    {
      label: "Sub Account Details",
      url: "/master/finance/subaccount/subaccountdetails",
    },
  ];
  const home = { label: "Master" };
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const handleSubmit = async (value) => {
    try {
      await dispatch(patchSubAccountEdit(value)).unwrap();
      navigate("/master/finance/subaccount");
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
    // toastRef.current.showToast();
    // setTimeout(() => {
    //     navigate("/master/finance/subaccount");
    // }, 2000);
  };
  const subAccountOptions = useSubAccountOptions();
  const isoCode = subAccountOptions.mainAccounts;
  const currencyOption = subAccountOptions.currencies;
  const setFormikValues = () => {
    const mainData = getSubDetailEdit?.mainAccount;
    const currencyData = getSubDetailEdit?.currencyCode;
    const updatedValues = {
      id: getSubDetailEdit?.id,
      subAccountCode: getSubDetailEdit?.subAccountCode,
      description: getSubDetailEdit?.description,
      subAccountName: getSubDetailEdit?.subAccountName,
      mainAccount: mainData,
      currencyCode: currencyData,
    };

    if (mainData) {
      // if (mainData) {
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (currencyData) {
      formik.setValues({ ...formik.values, ...updatedValues });
    }

    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const toastRef = useRef(null);

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  useEffect(() => {
    setFormikValues();
  }, [getSubDetailEdit]);


  return (
    <div className="grid sub__details_edit">
      <CustomToast ref={toastRef} />
      <div className="col-12"></div>
      <div className="col-12 mb-2">
        <div className="svgback_container">
          <span onClick={() => navigation(-1)}>
            <SvgBackicon />
          </span>
          <div className="add__sub__title">{t("financeMasters.subAccountDetails")}</div>
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

      <Card style={{ width: "100%" }}>
        <div className="grid sub__details">
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              label="Sub Account Code"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              value={formik.values.subAccountCode}
              onChange={formik.handleChange("subAccountCode")}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              label="Sub Account Code"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              value={formik.values.subAccountName}
              onChange={formik.handleChange("subAccountName")}
            />
          </div>
        </div>
        <div className="grid sub__details">
          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              label="Description"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              value={formik.values.description}
              onChange={formik.handleChange("description")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12  md:col-8 lg-col-8">
            <label className="main_acc_text">Main Account</label>
            <MultiSelect
              value={[formik.values.mainAccount]}
              // options={item}
              onChange={(e) => {
                formik.setFieldValue("mainAccount", e.value);
              }}
              options={isoCode}
              className="dropdown__add__sub"
              label="Main Account"
              display="chip"
              optionLabel="label"
              classNames="label__sub__add"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12  md:col-8 lg-col-8">
            <label className="main_acc_text">Currency Code</label>
            <MultiSelect
              value={[formik.values.currencyCode]}
              // options={item}
              onChange={(e) => {
                formik.setFieldValue("currencyCode", e.value);
              }}
              options={currencyOption}
              className="dropdown__add__sub"
              display="chip"
              optionLabel="value"
              classNames="label__sub__add"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
        </div>
      </Card>

      {/* </Card> */}

      <div className="col-12 btn__view__Add mt-6">
        <Button
          label={t("financeMasters.update")}
          className="save__add__btn"
          onClick={formik.handleSubmit}
          // onClick={() => setVisiblePopup(true)}
        />
      </div>
    </div>
  );
};
export default SubAdd;
