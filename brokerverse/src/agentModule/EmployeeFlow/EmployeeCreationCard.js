import { useEffect, useRef, useState } from "react";
import { Card } from "primereact/card"; 
import { Button } from "primereact/button"; 
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; 
import { useFormik } from "formik";
import countriesData from "./mockdata";
 import { RadioButton } from "primereact/radiobutton";
import CustomToast from "../../components/Toast";
import InputTextField from "../component/inputText";
import DatepickerField from "../component/datePicker";
import DropdownField from "../component/DropdownField";
import { postCreateleadMiddleware,patchLeadEditMiddleWare } from "../leadModule/Store/leadMiddleware";
import { patchClientEditMiddleWare } from "../quoteModule/clientListing/store/clientsMiddleware";

const initialValue = {
  CompanyName: "",
  TaxNumber: "",
  FirstName: "",
  LastName: "",
  PreferredName: "",
  EmailID: "",
  ContactNumber: "",
  HouseNo: "",
  Barangay: "",
  Country: "",
  Province: "",
  City: "",
  ZIPCode: "",
  DateofBirth: "",
  category: "Retail",
  gender: "Male",
  Quotes: "01",
  LeadID: "877",
};

export const EmployeeCreationCard = ({ flow, action }) => {
  const { leadtabledata, getEditLeadData, getClientEditData } =
    useSelector(({ leadReducers, clientsReducers }) => {
      return {
        loading: leadReducers?.loading,
        leadtabledata: leadReducers?.leadtabledata,
        getEditLeadData: leadReducers?.getEditLeadData,
        getClientEditData: clientsReducers?.getClientEditData,
      };
    });
  const [show, setShow] = useState(false);
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleclick = (values) => {
    if (action === "post") {
      const valueWithId = {
        ...values,
        id: leadtabledata?.length + 1,
      };
      dispatch(postCreateleadMiddleware(valueWithId));
      toastRef.current.showToast();
      setTimeout(() => {
        navigate(`/agent/createquote/policydetails/createquote/${12}`);
      }, 2000);
    }
    if (action === "edit") {
      if (flow === "client") {
        dispatch(patchClientEditMiddleWare(values));
        toastRef.current.showToast();
        setTimeout(() => {
          navigate(`/agent/clientlisting`);
        }, 2000);
      }
      if (flow === "lead") {
        dispatch(patchLeadEditMiddleWare(values));
        toastRef.current.showToast();
        setTimeout(() => {
          navigate(`/agent/leadlisting`);
        }, 2000);
      }
    }
  };
  const customValidation = (values) => {
    const errors = {};
    if (values.category === "Corporate") {
      if (!values.CompanyName) {
        errors.CompanyName = "This field is required";
      }
      if (!values.TaxNumber) {
        errors.TaxNumber = "This field is required";
      }
    }
    if (!values.FirstName) {
      errors.FirstName = "This field is required";
    }
    if (!values.PreferredName) {
      errors.PreferredName = "This field is required";
    }
    if (!values.LastName) {
      errors.LastName = "This field is required";
    }
    if (!values.EmailID) {
      errors.EmailID = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.EmailID)) {
      errors.EmailID = "Invalid email address";
    }
    if (!values.ContactNumber) {
      errors.ContactNumber = "Phone Number is required";
    } else if (!/^\d{10}$/.test(values.ContactNumber)) {
      errors.ContactNumber = "Invalid phone number (10 digits)";
    }
    if (!values.HouseNo) {
      errors.HouseNo = "This field is required";
    }

    if (!values.Barangay) {
      errors.Barangay = "This field is required";
    }
    if (!values.Country) {
      errors.Country = "This field is required";
    }
    if (!values.Province) {
      errors.Province = "This field is required";
    }
    if (!values.City) {
      errors.City = "This field is required";
    }
    if (!values.ZIPCode) {
      errors.ZIPCode = "This field is required";
    }
    if (!values.DateofBirth) {
      errors.DateofBirth = "This field is required";
    }
    if (!values.category) {
      errors.category = "This field is required";
    }
    if (!values.gender) {
      errors.gender = "This field is required";
    }
    return errors;
  };


  const formik = useFormik({
    initialValues: initialValue,
    validate: customValidation,
    onSubmit: (values) => {
      handleclick(values);
    },
  });
  const City = countriesData.city.map((city) => ({
    label: city,
  }));

  const State = countriesData.state.map((state) => ({
    label: state,
  }));

  const Country = countriesData.countries.map((country) => ({
    label: country,
  }));

  const [countryDataOption, setCountryDataOption] = useState([]);
  const [cityDataOption, setCityDataOption] = useState([]);
  const [stateDataOption, setStateDataOption] = useState([]);
  const setFormikValues = () => {
    const CountryData = getEditLeadData?.Country;
    const StateData = getEditLeadData?.Province;
    const CityData = getEditLeadData?.City;
    const updatedValues = {
      id: getEditLeadData?.id,
      TaxNumber: getEditLeadData?.TaxNumber,
      CompanyName: getEditLeadData?.CompanyName,
      FirstName: getEditLeadData?.FirstName,
      LastName: getEditLeadData?.LastName,
      PreferredName: getEditLeadData?.PreferredName,
      EmailID: getEditLeadData?.EmailID,
      ContactNumber: getEditLeadData?.ContactNumber,
      HouseNo: getEditLeadData?.HouseNo,
      Barangay: getEditLeadData?.Barangay,
      Country: CountryData,
      Province: StateData,
      City: CityData,
      ZIPCode: getEditLeadData?.ZIPCode,
      DateofBirth: new Date(getEditLeadData?.DateofBirth),
      category: getEditLeadData?.category,
      gender: getEditLeadData?.gender,
      Type: getEditLeadData?.Type,
    };
    if (CountryData) {
      setCountryDataOption([{ label: CountryData, value: CountryData }]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (CityData) {
      setCityDataOption([{ label: CityData, value: CityData }]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (StateData) {
      setStateDataOption([{ label: StateData, value: StateData }]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const setFormikValuesClient = () => {
    const CountryData = getClientEditData?.Country;
    const StateData = getClientEditData?.Province;
    const CityData = getClientEditData?.City;
    const updatedValues = {
      id: getClientEditData?.id,
      TaxNumber: getClientEditData?.TaxNumber,
      CompanyName: getClientEditData?.CompanyName,
      FirstName: getClientEditData?.FirstName,
      LastName: getClientEditData?.LastName,
      PreferredName: getClientEditData?.PreferredName,
      EmailID: getClientEditData?.EmailID,
      ContactNumber: getClientEditData?.ContactNumber,
      HouseNo: getClientEditData?.HouseNo,
      Barangay: getClientEditData?.Barangay,
      Country: CountryData,
      Province: StateData,
      City: CityData,
      ZIPCode: getClientEditData?.ZIPCode,
      DateofBirth: new Date(getClientEditData?.DateofBirth),
      category: getClientEditData?.category,
      gender: getClientEditData?.gender,
    };
    if (CountryData) {
      setCountryDataOption([{ label: CountryData, value: CountryData }]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (CityData) {
      setCityDataOption([{ label: CityData, value: CityData }]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (StateData) {
      setStateDataOption([{ label: StateData, value: StateData }]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  useEffect(() => {
    if (action === "edit") {
      setFormikValues();
    }
    if (flow === "client") {
      setFormikValuesClient();
    }
  }, [getEditLeadData, getClientEditData]);

  return (
    <div className="card_overall_container mt-4">
      <CustomToast ref={toastRef} message="Lead Created Successfully" />
      {/* <form onSubmit={formik.handleSubmit}> */}
      <Card
        title={
          action === "post"
            ? "Create Lead"
            : flow === "client"
            ? "Edit Client"
            : "Edit Lead"
        }
      >
        {action === "post" ? (
          <div>
            <div className="subheadinglabel_txt mt-3">Select Category</div>
            <div className="flex flex-wrap gap-3 mt-3">
              <div className="flex align-items-center">
                <RadioButton
                  inputId="individual"
                  name="category"
                  value="Retail"
                  onChange={() => {
                    formik.setFieldValue("category", "Retail");
                    setShow(false);
                  }}
                  checked={formik.values.category === "Retail"}
                />
                <label htmlFor="ingredient1" className="labeltxt_container">
                  Individual
                </label>
              </div>
              <div className="flex align-items-center">
                <RadioButton
                  inputId="company"
                  name="category"
                  value="Corporate"
                  onChange={() => {
                    formik.setFieldValue("category", "Corporate");
                    setShow(true);
                  }}
                  checked={formik.values.category === "Corporate"}
                />
                <label htmlFor="ingredient2" className="labeltxt_container">
                  Company
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div>
            Category :{" "}
            <span className="category__style">
              {flow === "client"
                ? getClientEditData?.category
                : getEditLeadData?.category}
            </span>
          </div>
        )}
        {show === true ? (
          <div class="grid mt-2">
            <div class="col-12 md:col-6 lg:col-6">
              <InputTextField
                label="Company Name*"
                value={formik.values.CompanyName}
                onChange={formik.handleChange("CompanyName")}
              />
              {formik.touched.CompanyName && formik.errors.CompanyName && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.CompanyName}
                </div>
              )}
            </div>
            <div class="col-12 md:col-6 lg:col-6">
              <InputTextField
                label="Tax Information Number*"
                value={formik.values.TaxNumber}
                onChange={formik.handleChange("TaxNumber")}
              />
              {formik.touched.TaxNumber && formik.errors.TaxNumber && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.TaxNumber}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="First Name*"
              value={formik.values.FirstName}
              onChange={formik.handleChange("FirstName")}
            />
            {formik.touched.FirstName && formik.errors.FirstName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.FirstName}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="Last Name*"
              value={formik.values.LastName}
              onChange={formik.handleChange("LastName")}
            />
            {formik.touched.LastName && formik.errors.LastName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.LastName}
              </div>
            )}
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="Preferred Name*"
              value={formik.values.PreferredName}
              onChange={formik.handleChange("PreferredName")}
            />
            {formik.touched.PreferredName && formik.errors.PreferredName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.PreferredName}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label="Date of Birth*"
              value={formik.values.DateofBirth}
              onChange={(date) => {
                return formik.setFieldValue("DateofBirth", date.target.value);
              }}
            />

            {formik.touched.DateofBirth && formik.errors.DateofBirth && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.DateofBirth}
              </div>
            )}
          </div>
        </div>

        <div className="subheadinglabel_txt mt-3">Select Gender</div>
        <div className="flex flex-wrap gap-3  mt-3">
          <div className="flex align-items-center gap-2 checkbox_container">
            <RadioButton
              inputId="male"
              name="gender"
              value="Male"
              onChange={() => formik.setFieldValue("gender", "Male")}
              checked={formik.values.gender === "Male"}
            />
            <label htmlFor="ingredient1" className="labeltxt_container">
              Male
            </label>
          </div>
          <div className="flex align-items-center gap-2 checkbox_container">
            <RadioButton
              inputId="female"
              name="gender"
              value="Female"
              onChange={() => formik.setFieldValue("gender", "Female")}
              checked={formik.values.gender === "Female"}
            />
            <label htmlFor="ingredient2" className="labeltxt_container">
              Female
            </label>
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="Email ID*"
              value={formik.values.EmailID}
              onChange={formik.handleChange("EmailID")}
            />
            {formik.touched.EmailID && formik.errors.EmailID && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.EmailID}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="Contact Number*"
              value={formik.values.ContactNumber}
              onChange={formik.handleChange("ContactNumber")}
            />
            {formik.touched.ContactNumber && formik.errors.ContactNumber && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.ContactNumber}
              </div>
            )}
          </div>
        </div>
        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="House No / Unit No / Street*"
              value={formik.values.HouseNo}
              onChange={formik.handleChange("HouseNo")}
            />
            {formik.touched.HouseNo && formik.errors.HouseNo && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.HouseNo}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="Barangay / Subd*"
              value={formik.values.Barangay}
              onChange={formik.handleChange("Barangay")}
            />
            {formik.touched.Barangay && formik.errors.Barangay && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.Barangay}
              </div>
            )}
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <DropdownField
              label="Country*"
              value={formik.values.Country}
              options={action === "post" ? Country : countryDataOption}
              onChange={(e) => {
                formik.setFieldValue("Country", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.Country && formik.errors.Country && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.Country}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <DropdownField
              label="Province*"
              value={formik.values.Province}
              options={action === "post" ? State : stateDataOption}
              onChange={(e) => {
                formik.setFieldValue("Province", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.Province && formik.errors.Province && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.Province}
              </div>
            )}
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <DropdownField
              label="City*"
              value={formik.values.City}
              options={action === "post" ? City : cityDataOption}
              onChange={(e) => {
                formik.setFieldValue("City", e.value);
              }}
              optionLabel="label"
            />
            {formik.touched.City && formik.errors.City && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.City}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label="ZIP Code*"
              value={formik.values.ZIPCode}
              onChange={formik.handleChange("ZIPCode")}
            />
            {formik.touched.ZIPCode && formik.errors.ZIPCode && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.ZIPCode}
              </div>
            )}
          </div>
        </div>

        <div className="save_continue_conatiner">
          <div className="btn_lable_save_container flex justify-content-end mt-2">
            <Button
              onClick={() => {
                navigate("/agent/employee-benefit/create-quote")
              }}
              label={action === "post" ? "Save & Continue" : "Update"}
            />
          </div>
        </div>
      </Card>
      {/* </form> */}
    </div>
  );
};

