import { useRef } from 'react';
import './index.scss';
import { BreadCrumb } from 'primereact/breadcrumb';
import InputField from '../../../../components/InputField';
import SvgDot from '../../../../assets/icons/SvgDot';
import DropDowns from '../../../../components/DropDowns';
import SvgDropdown from '../../../../assets/icons/SvgDropdown';
import { Button } from 'primereact/button';
import { useNavigate } from 'react-router-dom';
import SvgBackicon from '../../../../assets/icons/SvgBackicon';
import { Card } from "primereact/card";
import { useFormik } from "formik";
import CustomToast from "../../../../components/Toast";
import { InputText } from "primereact/inputtext";
import useMasterOptions from "../../../GeneralMasters/common/useMasterOptions";

import { postAddBankMiddleware } from '../store/bankMasterMiddleware';
import { useDispatch } from 'react-redux';
import { phoneCountryCode } from "../../../../utility/phoneFormat";

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
  const dispatch = useDispatch();
  const Navigate = useNavigate()
  const toastRef = useRef(null);


  const City = useMasterOptions("city");
  const State = useMasterOptions("state");
  const Country = useMasterOptions("country");
  const home = { label: "Master" };
  const items = [
    { label: 'Bank', url: '/master/finance/bank' },
    { label: 'Add Bank' },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  // const handleSubmit=(value)=>{
  // }

  const handleSubmit = async (values) => {
    try {
      await dispatch(postAddBankMiddleware(values)).unwrap();
      toastRef.current.showToast();
      setTimeout(() => {
        Navigate("/master/finance/bank");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

  // const handleSubmit = (values) => {
  //   // Handle form submission

  //     setTimeout(() => {
  //     }, 3000);
  //   }

  // };

  const customValidation = (values) => {
    const errors = {};

    if (!values.bankCode) {
      errors.bankCode = "This field is required";
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
    } else if (!/^\+?[\d\s()-]{7,20}$/.test(values.mobile)) {
      errors.mobile = "Invalid phone number";
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

    // },
    onSubmit: handleSubmit
  });

  return (
    <div className='overall__addbankmaster__container'>

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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}

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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}

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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}

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
              label="SWIFT / BIC Code"
              placeholder={"Enter"}
              value={formik.values.ifscCode}
              onChange={formik.handleChange("ifscCode")}

            />
            {formik.touched.ifscCode && formik.errors.ifscCode && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}

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
                style={{ fontSize: 12, color: "var(--color-danger)" }}

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
                style={{ fontSize: 12, color: "var(--color-danger)" }}

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
                style={{ fontSize: 12, color: "var(--color-danger)" }}

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
              label="City / Municipality"
              value={formik.values.City}
              onChange={(e) =>
                formik.setFieldValue("City", e.value)
              }
              options={City}
              optionLabel="label"
              optionValue="value"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.City && formik.errors.City && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}

              >
                {formik.errors.City}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Province"
              value={formik.values.state}
              onChange={(e) =>
                formik.setFieldValue("state", e.value)
              }
              options={State}
              optionLabel="label"
              optionValue="value"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.state && formik.errors.state && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}

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
              optionValue="value"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.Country && formik.errors.Country && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}

              >
                {formik.errors.Country}
              </div>
            )}
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <label className='label_text'>Phone Number</label>
            <div className="p-inputgroup flex-1">

              <span className="p-inputgroup-addon">
                <div>{phoneCountryCode()}</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText placeholder="enter"
                value={formik.values.mobile}
                onChange={formik.handleChange("mobile")}
              />
            </div>
            {formik.touched.mobile && formik.errors.mobile && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}

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
                <div>{phoneCountryCode()}</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText placeholder="enter"
                value={formik.values.Fax}
                onChange={formik.handleChange("Fax")}
              />
            </div>

            {formik.touched.Fax && formik.errors.Fax && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}

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
                style={{ fontSize: 12, color: "var(--color-danger)" }}

              >
                {formik.errors.email}
              </div>
            )}

          </div>
        </div>
      </Card>

      <div className="next_container">

        <Button className="submit_button p-0" label="Save"
          onClick={() => { formik.handleSubmit(); }}
        />
      </div>

    </div>
  );
}

export default AddBankMaster;
