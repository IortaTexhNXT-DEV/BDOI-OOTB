import { BreadCrumb } from "primereact/breadcrumb";
import React, { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SvgDot from "../../../../../assets/icons/SvgDot";
import "./index.scss";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import { useFormik } from "formik";
import SvgBack from "../../../../../assets/icons/SvgBack";
import CustomToast from "../../../../../components/Toast";
import { useNavigate, useParams } from "react-router-dom";
import EditUser from "../EditUser";
import { useDispatch, useSelector } from "react-redux";
import {
  getUserListByIdMiddleware,
  patchUserEditMiddleware,
  postAddUserMiddleware,
} from "../store/userMiddleware";
import moment from "moment";
import userService from "../../../../../services/userService";
import { MultipleSelectRadioGroup } from "../../../../../components/RadioComponent/Multiselect";
import { unwrapResult } from "@reduxjs/toolkit";
import { TemporaryPasswordDialog } from "../UserMaster/UserSecurityActions";
import { ADMIN_ROLES } from "../../../../../utils/menuPermissions";

/** Only a System Administrator may grant the System Administrator role (the server enforces the same rule). */
const PRIVILEGED_ROLES = ADMIN_ROLES;
const canGrantPrivileged = () => {
  try {
    return (JSON.parse(localStorage.getItem("USER_ROLES") || "[]") || []).some((r) => ADMIN_ROLES.includes(r));
  } catch {
    return false;
  }
};

const AddUser = ({ action }) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  // temporary password of a user created without one (shown once)
  const [temporary, setTemporary] = useState(null);

  const items = [
    { label: t("generalMasters.userManagement") },
    {
      label: action === "add" ? t("generalMasters.addUser") : action === "edit" ? t("generalMasters.editUser") : t("generalMasters.viewUser"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const initialValue = {
    username: "",
    email: "",
    password: "",
    displayName: "",
    roles: [],
    permissions: [],
  };
  const { userDetailList, userEditData } = useSelector(
    ({ userReducers }) => {
      return {
        userDetailList: userReducers?.userDetailList,
        userEditData: userReducers?.userEditData,
      };
    }
  );
  // Role options come from GET /roles (active roles; the value is the role code)
  const [roleOptions, setRoleOptions] = useState([]);
  useEffect(() => {
    userService
      .getRoles()
      .then((roles) =>
        setRoleOptions(
          roles
            .filter((role) => role.status !== "inactive")
            .filter((role) => canGrantPrivileged() || !PRIVILEGED_ROLES.includes(role.code))
            .map((role) => ({ name: "roles", label: role.name, value: role.code }))
        )
      )
      .catch((error) => toastRef.current?.showToast({ severity: "error", detail: error.message }));
  }, []);
  const validate = (values) => {
    const errors = {};

    if (!values.username) {
      errors.username = "Username is required";
    }

    if (!values.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.email = "Invalid email address";
    }

    if (!values.displayName) {
      errors.displayName = "Display name is required";
    }

    if (!values.roles || values.roles.length === 0) {
      errors.roles = "At least one role is required";
    }

    // Password is optional: left empty, the server generates a temporary password (shown once below) that the user
    // must change at the first sign-in. A typed password is checked against the password policy by the server.

    return errors;
  };
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const handleSubmit = async (value, formikHelpers) => {
    const { setSubmitting } = formikHelpers || {};
    try {
      if (action === "edit") {
        const updatePayload = { ...value, id };
        await dispatch(patchUserEditMiddleware(updatePayload)).unwrap();
        toastRef.current.showToast({
          severity: "success",
          summary: "Success",
          detail: "User updated successfully",
        });
        setTimeout(() => {
          navigate("/master/generals/usermanagement/user");
        }, 1500);
      }
      if (action === "add") {
        const createdUser = await dispatch(postAddUserMiddleware(value)).unwrap();
        toastRef.current.showToast({
          severity: "success",
          summary: "Success",
          detail: "User created successfully",
        });
        if (createdUser?.temporaryPassword) {
          // shown once; the list opens when the administrator closes the dialog
          setTemporary({ username: createdUser.username, temporaryPassword: createdUser.temporaryPassword });
        } else {
          setTimeout(() => {
            navigate("/master/generals/usermanagement/user");
          }, 1500);
        }
      }
    } catch (error) {
      const errorMessage =
        typeof error === "string"
          ? error
          : error?.details || error?.message || "Failed to save user";
      toastRef.current.showToast({
        severity: "error",
        summary: "Error",
        detail: errorMessage,
      });
    } finally {
      if (setSubmitting) setSubmitting(false);
    }
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: handleSubmit,
    validateOnMount: true,
    validateOnChange: false,
    validateOnBlur: true,
  });

  const handleRoleChange = (selectedRoles) => {
    // Mark touched without validating, then set the value with validation: validating on touch as
    // well ran against the previous (empty) roles and left "At least one role is required" in place.
    formik.setFieldTouched("roles", true, false);
    formik.setFieldValue("roles", selectedRoles, true);
  };

  // Set form values when user data is loaded (for edit/view)
  const setFormikValues = () => {

    // The record loaded for this route first, then the row picked in the list
    const userData =
      userDetailList?.userId === id
        ? userDetailList
        : userEditData?.fullUserData || userEditData || userDetailList;

    const rolesArray = Array.isArray(userData?.roles)
      ? userData.roles
      : userData?.roles
      ? typeof userData.roles === "string"
        ? userData.roles.split(", ").map((role) => role.trim())
        : []
      : [];

    const updatedValues = {
      id: userData?.userId ?? userData?.id,
      username: userData?.username,
      email: userData?.email,
      displayName: userData?.displayName,
      roles: rolesArray,
      modifiedBy: userData?.modifiedBy,
      modifiedOn: moment().format("DD/MM/YYYY"),
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formikEdit = useFormik({
    initialValues: initialValue,
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (action === "edit" || action === "view") {
      // Use userDetailList or userEditData
      if (
        (userDetailList && Object.keys(userDetailList).length > 0) ||
        (userEditData && Object.keys(userEditData).length > 0)
      ) {
        setFormikValues();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEditData, userDetailList, action]);

  // Load user data on edit/view
  useEffect(() => {
    if (action === "edit" || action === "view") {
      if (id) {
        dispatch(getUserListByIdMiddleware(id));
      }
    }
  }, [id, action, dispatch]);

  // useEffect(() => {
  //   if (action === "edit" || action === "view") {
  //     dispatch(getUserListByIdMiddleware(id)).then(() => {
  //       setFormikValues();
  //     });
  //     setFormikValues();
  //   }
  // }, [action, id]);
  return (
    <div className="grid add__user__container">
      <div
        style={{
          justifyContent: "center",
          alignItems: "center",
          display: "flex",
          gap: 10,
          padding: "8px 0px",
        }}
      >
        <span onClick={() => navigate(-1)}>
          <SvgBack />
        </span>

        <div className="add__sub__title">
          {action === "add"
            ? "Add User"
            : action === "edit"
            ? "Edit User"
            : "View User"}
        </div>
      </div>

      <div className="col-12 mb-4">
        <div>
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12 m-0 ">
        <div className="grid add__account__sub__container p-3">
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={
                action === "add"
                  ? formik.values.username
                  : action === "edit"
                  ? formik.values.username
                  : formik.values.username
              }
              onChange={formik.handleChange("username")}
              label={t("generalMasters.username")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
              error={formik.touched.username && formik.errors.username}
            />
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={
                action === "add"
                  ? formik.values.email
                  : action === "edit"
                  ? formik.values.email
                  : formik.values.email
              }
              onChange={formik.handleChange("email")}
              label={t("generalMasters.eMail")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
              error={formik.touched.email && formik.errors.email}
            />
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={
                action === "add"
                  ? formik.values.displayName
                  : action === "edit"
                  ? formik.values.displayName
                  : formik.values.displayName
              }
              onChange={formik.handleChange("displayName")}
              label={t("generalMasters.displayName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
              error={formik.touched.displayName && formik.errors.displayName}
            />
          </div>

          {action === "add" && (
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                disabled={action === "view" ? true : false}
                value={formik.values.password}
                onChange={formik.handleChange("password")}
                label={t("generalMasters.password")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("security.leaveEmptyForTemporary")}
                type="password"
                error={formik.touched.password && formik.errors.password}
              />
            </div>
          )}

          <div className="col-12 md:col-12 lg:col-12">
            <label
              className="label__sub__add"
              style={{ marginBottom: "10px", display: "block" }}
            >
              {t("generalMasters.roles")} *
            </label>
            <MultipleSelectRadioGroup
              options={roleOptions}
              onChange={handleRoleChange}
              selectedValues={formik.values.roles || []}
              isDisabled={action === "view"}
              isRequired={true}
            />
            {formik.touched.roles && formik.errors.roles && (
              <div className="mt-2" style={{ fontSize: 10, color: "red" }}>
                {formik.errors.roles}
              </div>
            )}
          </div>
        </div>
      </div>
      {action === "edit" && (
        <div style={{ width: "100%" }}>
          <EditUser />
        </div>
      )}

      <div className="col-12 btn__view__Add mt-2">
        {action === "add" && (
          <Button
            label={t("generalMasters.save")}
            className="save__add__btn"
            onClick={() => {
              formik.handleSubmit();
            }}
            disabled={!formik.isValid}
          />
        )}
        {action === "edit" && (
          <Button
            className="save__add__btn"
            onClick={() => {
              formikEdit.handleSubmit();
            }}
          >
            Update
          </Button>
        )}
      </div>
      <CustomToast ref={toastRef} />
      <TemporaryPasswordDialog
        result={temporary}
        onHide={() => {
          setTemporary(null);
          navigate("/master/generals/usermanagement/user");
        }}
      />
    </div>
  );
};
export default AddUser;
