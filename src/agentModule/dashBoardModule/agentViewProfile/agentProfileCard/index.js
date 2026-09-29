import { Card } from "primereact/card";
import React, { useState, useEffect, useRef } from "react";
import InputTextField from "../../../component/inputText/index";
import { Button } from "primereact/button";
import { useSelector, useDispatch } from "react-redux";
import { useFormik } from "formik";
import { patchProfileEditMiddleware } from "../agentProfileCard/store/profileMiddleware";
import { RadioButton } from "primereact/radiobutton";
import DatepickerField from "../../../component/datePicker";
const AgentProfileCard = () => {
  const dispatch = useDispatch();
  const [formAction, setFormAction] = useState("view");
  const { profileData, profileEditData, loading, total } = useSelector(
    ({ profileReducers }) => {
      console.log(profileReducers, "find profileReducers");
      return {
        loading: profileReducers?.loading,
        profileData: profileReducers?.profileData,

        profileEditData: profileReducers?.profileEditData,

        total: profileReducers,
      };
    }
  );
  console.log(profileData, "find profileEditData");

  const initialValue = {
    firstName: "",
    lastName: "",
    prefferedName: "",
    dateOfBirth: "",
    gender: "",
    emailId: "",
    contactNumber: "",
    houseNoUnitNoStreet: "",
    barangaySubd: "",
    country: "",
    province: "",
    city: "",
    zipCode: "",
  };
  // const validate = (values) => {
  //   const errors = {};
  //   console.log(values, errors, "values");
  //   if (!values.employeeCode) {
  //     errors.employeeCode = "Employee Code is required";
  //   }
  //   if (!values.firstName) {
  //     errors.firstName = "First name Code is required";
  //   }

  //   if (!values.middleName) {
  //     errors.middleName = "Middle name Name is required";
  //   }

  //   if (!values.employeeType) {
  //     errors.employeeType = "Employee type is required";
  //   }
  //   if (!values.designation) {
  //     errors.designation = "Designation is required";
  //   }
  //   if (!values.reportingto) {
  //     errors.reportingto = "Reporting is required";
  //   }
  //   if (!values.branchCode) {
  //     errors.branchCode = "Branch code is required";
  //   }
  //   if (!values.departmentCode) {
  //     errors.departmentCode = "Department code is required";
  //   }
  //   if (!values.idProofType) {
  //     errors.idProofType = "Id proof type is required";
  //   }
  //   if (!values.idNumber) {
  //     errors.idNumber = "Id number is required";
  //   }

  //   if (!values.city) {
  //     errors.city = "City is required";
  //   }
  //   if (!values.country) {
  //     errors.country = "Country is required";
  //   }
  //   if (!values.state) {
  //     errors.state = "State is required";
  //   }
  //   if (!values.lastName) {
  //     errors.lastName = "Last name is required";
  //   }

  //   return errors;
  // };

  const setFormikValues = () => {
    const updatedValues = {
      id: profileData[0]?.id,
      firstName: profileData[0]?.firstName,
      lastName: profileData[0]?.lastName,
      prefferedName: profileData[0]?.prefferedName,
      lastName: profileData[0]?.lastName,
      dateOfBirth: profileData[0]?.dateOfBirth,
      gender: profileData[0]?.gender,
      houseNoUnitNoStreet: profileData[0]?.houseNoUnitNoStreet,
      emailId: profileData[0]?.emailId,
      contactNumber: profileData[0]?.contactNumber,
      barangaySubd: profileData[0]?.barangaySubd,
      idNumber: profileData[0]?.idNumber,

      zipCode: profileData[0]?.zipCode,
      city: profileData[0]?.city,
      province: profileData[0]?.province,
      country: profileData[0]?.country,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const toastRef = useRef(null);
  const handleSubmit = (value) => {
    console.log(value, "find value");
    dispatch(patchProfileEditMiddleware(value));
    setFormAction("view");
  };
  useEffect(() => {
    setFormikValues();
  }, [profileData]);
  const formik = useFormik({
    initialValues: initialValue,
    // validate,
    onSubmit: handleSubmit,
  });

  const handleCancelAction = () => {
    setFormAction("view");
  };
  const handleEditAction = () => {
    setFormAction("edit");
  };
  const handleDateChange = (e) => {
    const selectedDate = e.value;
    const newFormattedDate = selectedDate
      ? `${selectedDate.getDate()}-${
          selectedDate.getMonth() + 1
        }-${selectedDate.getFullYear()}`
      : "";
    formik.setFieldValue("dateOfBirth", newFormattedDate);
  };

  return (
    <div>
      <Card className="mt-5">
        <div className="grid  m-0">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="First Name*"
              value={formik.values.firstName}
              onChange={formik.handleChange("firstName")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="Last Name"
              value={formik.values.lastName}
              onChange={formik.handleChange("lastName")}
            />
          </div>
        </div>
        <div className="grid  m-0">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="Preferred Name*"
              value={formik.values.prefferedName}
              onChange={formik.handleChange("prefferedName")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {formAction === "edit" ? (
              <DatepickerField
                label="Date of Birth"
                showTime={false}
                dateFormat="dd-mm-yy"
                onChange={handleDateChange}
              />
            ) : (
              <InputTextField
                disabled={formAction === "view" ? true : false}
                label="Date of Birth"
                value={formik.values.dateOfBirth}
                onChange={formik.handleChange("dateOfBirth")}
              />
            )}
          </div>
        </div>
        <div className="grid  m-0">
          {formAction === "edit" ? (
            <div className="col-12">
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
            </div>
          ) : (
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                disabled={formAction === "view" ? true : false}
                label="Gender"
                value={formik.values.gender}
                onChange={formik.handleChange("gender")}
              />
            </div>
          )}
        </div>

        <div className="grid  m-0">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="Email ID"
              value={formik.values.emailId}
              onChange={formik.handleChange("emailId")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="Contact Number"
              value={formik.values.contactNumber}
              onChange={formik.handleChange("contactNumber")}
            />
          </div>
        </div>
        <div className="grid  m-0">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="House No / Unit No / Street"
              value={formik.values.houseNoUnitNoStreet}
              onChange={formik.handleChange("houseNoUnitNoStreet")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="Barangay / Subd"
              value={formik.values.barangaySubd}
              onChange={formik.handleChange("barangaySubd")}
            />
          </div>
        </div>
        <div className="grid  m-0">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="Country"
              value={formik.values.country}
              onChange={formik.handleChange("country")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="Province"
              value={formik.values.province}
              onChange={formik.handleChange("province")}
            />
          </div>
        </div>
        <div className="grid  m-0">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="City"
              value={formik.values.city}
              onChange={formik.handleChange("city")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              disabled={formAction === "view" ? true : false}
              label="ZIP Code"
              value={formik.values.zipCode}
              onChange={formik.handleChange("zipCode")}
            />
          </div>
        </div>
        {formAction === "view" ? (
          <div className="profile__container__btn mt-2">
            <Button
              onClick={handleEditAction}
              label="Edit Profile"
              className="profile__container__add__btn"
            />
          </div>
        ) : (
          <div class="grid mt-2">
            <div className="back__button__container col-12 md:col-12 lg:col-12">
              <div className="back__text__container">
                <Button
                  label="Cancel"
                  className="back__btn"
                  onClick={handleCancelAction}
                />
              </div>
              <div className="next__text__container">
                <Button
                  onClick={() => {
                    formik.handleSubmit();
                  }}
                  label="Update"
                  className="next__btn"
                />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AgentProfileCard;
