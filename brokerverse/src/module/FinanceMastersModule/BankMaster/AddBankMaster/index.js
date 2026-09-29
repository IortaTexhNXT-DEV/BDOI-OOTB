import React, { useState, useRef } from 'react';
import './index.scss';
import { BreadCrumb } from 'primereact/breadcrumb';
import InputField from '../../../../components/InputField';
import SubmitButton from '../../../../components/SubmitButton'
import SvgDot from '../../../../assets/icons/SvgDot';
import DropDowns from '../../../../components/DropDowns';
import SvgDropdown from '../../../../assets/icons/SvgDropdown';
import { Button } from 'primereact/button';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../../../components/NavBar';
import SvgBackicon from '../../../../assets/icons/SvgBackicon';
import { Card } from "primereact/card";
import DatePicker from '../../../../components/DatePicker';
import { Calendar } from 'primereact/calendar';
import LabelWrapper from '../../../../components/LabelWrapper';
import { useFormik } from "formik";
import { Toast } from 'primereact/toast';
import CustomToast from "../../../../components/Toast";
import { InputText } from "primereact/inputtext";
import countriesData from "./data";

import { postAddBankMiddleware, postAddBank } from '../store/bankMasterMiddleware';
import { useDispatch, useSelector } from 'react-redux';




const initialValues = {
  bankCode: "",
  bankName: "",
  bankBranch: "",
  ifscCode: "",
  AddressLine1: "",
  AddressLine2: "",
  AddressLine3: "",
  City: "",
  state: "",
  Country: "",
  mobile: "",
  Fax: "",
  email: ""
  // CompanyCode: "",
  // CompanyName: "",
  // LicenseNumber: "",
  // email: "",
  // Logo: "",
  // Websitelink: "",
  // Description: "",
  // AddressLine1: "",
  // AddressLine2: "",
  // AddressLine3: "",
  // PinCode: "",
  // City: "",
  // State: "",
  // Country: "",
  // mobile: "",
  // Fax: "",
}

function AddBankMaster() {
  const [date, setDate] = useState(null);
  const dispatch = useDispatch();
  const Navigate = useNavigate()
  const [departmentcode, setDepartmentCode] = useState(null);
  const [branchcode, setBranchCode] = useState(null);
  const [payeetype, setPayeeType] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [customercode, setCustomerCode] = useState(null);
  const [transactioncode, setTransactioncode] = useState(null);
  const [selectinstrumentcurrency, setSelectInstrumentCurrency] = useState(null);
  const toastRef = useRef(null);

  const { BankList, loading } = useSelector(({ bankMasterReducer }) => {
    return {
      loading: bankMasterReducer?.loading,
      BankList: bankMasterReducer?.BankList,

    };
  });

  const City = countriesData.city.map(city => ({
    label: city,
  }));

  const State = countriesData.state.map(state => ({
    label: state,
  }));


  const Country = countriesData.countries.map(country => ({
    label: country,
  }));

  const home = { label: "Master" };
  const items = [
    { label: 'Bank', url: '/master/finance/bank' },
    { label: 'Add Bank' },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  // const handleSubmit=(value)=>{

  //     Navigate("/master/finance/bank")
  // }

  // const toastRef = useRef(null);
  const handleSubmit = (values) => {

    const valueWithId = {
      ...values,
      id: BankList?.length + 1,
    };
    console.log(values, "find values");
    dispatch(postAddBankMiddleware(valueWithId))

    // Handle form submission
    console.log(values, "value");

    // dispatch(postAddBank(formik.values));


    toastRef.current.showToast();

    setTimeout(() => {
      Navigate("/master/finance/bank")
    }, 3000);
  };
  // const handleSubmit = (values) => {
  //   // Handle form submission
  //   console.log(values, "find values");

  //   toastRef.current.showToast();
  //   // {
  //     setTimeout(() => {
  //     Navigate("/master/finance/bank")
  //     }, 3000);
  //   }

  // };

  const customValidation = (values) => {
    const errors = {};

    if (!values.bankCode) {
      errors.bankCode = "This field Code is required";
    }
    if (!values.bankName) {
      errors.bankName = "This field is required";
    }
    if (!values.bankBranch) {
      errors.bankBranch = "This field is required";
    }
    if (!values.ifscCode) {
      errors.ifscCode = "This field is required";
    }
    if (!values.AddressLine1) {
      errors.AddressLine1 = "This field is required";
    }
    if (!values.AddressLine2) {
      errors.AddressLine2 = "This field is required";
    }
    if (!values.AddressLine3) {
      errors.AddressLine3 = "This field is required";
    }
    if (!values.City) {
      errors.City = "This field is required";
    }
    if (!values.state) {
      errors.state = "This field is required";
    }
    if (!values.Country) {
      errors.Country = "This field is required";
    }
    if (!values.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.email = "Invalid email address";
    }

    if (!values.mobile) {
      errors.mobile = "Phone Number is required";
    } else if (!/^\d{10}$/.test(values.mobile)) {
      errors.mobile = "Invalid phone number (10 digits)";
    }
    if (!values.Fax) {
      errors.Fax = "This field is required";
    }
    if (!values.email) {
      errors.email = "This field is required";
    }
    return errors;
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    // onSubmit: (values) => {
    //   // Handle form submission
    //    handleSubmit(values);

    // },
    onSubmit: handleSubmit
  });

  return (
    <div className='overall__addbankmaster__container'>


      {/* <CustomToast ref={toastRef} 
            // detail="Some detail text"
            // content={"Voucher Details Save Successfully"}
            /> */}
      <CustomToast ref={toastRef} message="Save Successfully" />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon /></span>
        <label className='label_header'>Add Bank</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className='breadcrumbs_container'
        separatorIcon={<SvgDot color={"#000"} />} />





      <Card>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label="Bank Code"
                placeholder={"Enter"}
                value={formik.values.bankCode}
                onChange={formik.handleChange("bankCode")}

              />
              {formik.touched.bankCode && formik.errors.bankCode && (
                <div
                  style={{ fontSize: 12, color: "red" }}

                >
                  {formik.errors.bankCode}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Bank Name"
                placeholder={"Enter"}
                value={formik.values.bankName}
                onChange={formik.handleChange("bankName")}

              />
              {formik.touched.bankName && formik.errors.bankName && (
                <div
                  style={{ fontSize: 12, color: "red" }}

                >
                  {formik.errors.bankName}
                </div>
              )}
            </div>
          </div>

          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label="Bank Branch"
                placeholder={"Enter"}
                value={formik.values.bankBranch}
                onChange={formik.handleChange("bankBranch")}

              />
              {formik.touched.bankBranch && formik.errors.bankBranch && (
                <div
                  style={{ fontSize: 12, color: "red" }}

                >
                  {formik.errors.bankBranch}
                </div>
              )}
            </div>
          </div>
        </div>



        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">

            <InputField
              classNames="field__container"
              label="IFSC Code"
              placeholder={"Enter"}
              value={formik.values.ifscCode}
              onChange={formik.handleChange("ifscCode")}

            />
            {formik.touched.ifscCode && formik.errors.ifscCode && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.ifscCode}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label="Address Line 1"
              placeholder={"Enter"}
              value={formik.values.AddressLine1}
              onChange={formik.handleChange("AddressLine1")}

            />
            {formik.touched.AddressLine1 && formik.errors.AddressLine1 && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.AddressLine1}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label="Address Line 2"
              placeholder={"Enter"}
              value={formik.values.AddressLine2}
              onChange={formik.handleChange("AddressLine2")}

            />
            {formik.touched.AddressLine2 && formik.errors.AddressLine2 && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.AddressLine2}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label="Address Line 3"
              placeholder={"Enter"}
              value={formik.values.AddressLine3}
              onChange={formik.handleChange("AddressLine3")}

            />
            {formik.touched.AddressLine3 && formik.errors.AddressLine3 && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.AddressLine3}
              </div>
            )}
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">

            <DropDowns
              className="dropdown__container"
              label="City"
              value={formik.values.City}
              onChange={(e) =>
                formik.setFieldValue("City", e.value)
              }
              options={City}
              optionLabel="label"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.City && formik.errors.City && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.City}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="state"
              value={formik.values.state}
              onChange={(e) =>
                formik.setFieldValue("state", e.value)
              }
              options={State}
              optionLabel="label"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.state && formik.errors.state && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.state}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Country"
              value={formik.values.Country}
              onChange={(e) =>
                formik.setFieldValue("Country", e.value)
              }
              options={Country}
              optionLabel="label"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.Country && formik.errors.Country && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.Country}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <label className='label_text'>Phone Number</label>
            <div className="p-inputgroup flex-1">

              <span className="p-inputgroup-addon">
                <div>+91</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText placeholder="enter"
                value={formik.values.mobile}
                onChange={formik.handleChange("mobile")}
              />
            </div>
            {formik.touched.mobile && formik.errors.mobile && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.mobile}
              </div>
            )}
          </div>
        </div>

        <div class="grid">


          <div class="sm-col-12  md:col-3 lg-col-3">
            <label className='label_text'>Fax</label>
            <div className="p-inputgroup flex-1">
              <span className="p-inputgroup-addon">
                <div>+91</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText placeholder="enter"
                value={formik.values.Fax}
                onChange={formik.handleChange("Fax")}
              />
            </div>

            {formik.touched.Fax && formik.errors.Fax && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.Fax}
              </div>
            )}
          </div>
          <div class="sm-col-12  md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label="Email ID"
              placeholder={"Enter"}
              value={formik.values.email}
              onChange={formik.handleChange("email")}
            />
            {formik.touched.email && formik.errors.email && (
              <div
                style={{ fontSize: 12, color: "red" }}

              >
                {formik.errors.email}
              </div>
            )}

          </div>
        </div>
      </Card>


      <div className="next_container">

        <Button className="submit_button p-0" label="Save" disabled={!formik.isValid}
          onClick={() => { formik.handleSubmit(); }}
        />
      </div>







    </div>
  );
}

export default AddBankMaster;
