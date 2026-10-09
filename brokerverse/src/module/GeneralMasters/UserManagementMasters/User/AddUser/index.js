import { BreadCrumb } from "primereact/breadcrumb";
import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SvgDot from "../../../../../assets/icons/SvgDot";
import "./index.scss";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import { useFormik } from "formik";
import SvgBack from "../../../../../assets/icons/SvgBack";
import CustomToast from "../../../../../components/Toast";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getUserListByIdMiddleware,
  patchUserEditMiddleware,
  postAddUserMiddleware,
} from "../store/userMiddleware";
import moment from "moment";
import userService from "../../../../../services/userService";
import mastersService from "../../../../../services/mastersService";
import DropDowns from "../../../../../components/DropDowns";
import RoleChecklist from "../../../../../components/RoleChecklist";
import FieldError from "../../../../../components/FieldError";
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
    branchCode: "",
    designation: "",
    reportingTo: "",
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
            .map((role) => ({ label: role.name, value: role.code }))
        )
      )
      .catch((error) => toastRef.current?.showToast({ severity: "error", detail: error.message }));
  }, []);
  // Users are the staff register: the designation comes from the Designation master, the reporting line from users,
  // the branch from the Branch master (the Employee master is retired).
  const [designationOptions, setDesignationOptions] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  useEffect(() => {
    mastersService
      .options("designation")
      .then((rows) => setDesignationOptions(rows.map((r) => ({ name: `${r.code} - ${r.label}`, value: r.label }))))
      .catch(() => setDesignationOptions([]));
    mastersService
      .options("branch")
      .then((rows) => setBranchOptions(rows.map((r) => ({ name: `${r.code} - ${r.label}`, value: r.code }))))
      .catch(() => setBranchOptions([]));
    userService
      .getUsers({ limit: 200, sortBy: "displayName", sortOrder: "asc" })
      .then((r) => setUserOptions((r?.data || []).map((u) => ({ name: u.displayName || u.username, value: u.userId }))))
      .catch(() => setUserOptions([]));
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
      branchCode: userData?.branchCode || "",
      designation: userData?.designation || "",
      reportingTo: userData?.reportingTo || "",
      modifiedBy: userData?.modifiedBy,
      modifiedOn: moment().format("DD/MM/YYYY"),
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
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
              required
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
              required
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
              required
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

          <div className="col-12 md:col-4 lg:col-4">
            <DropDowns
              className="dropdown__add__sub"
              label={t("generalMasters.branch", "Branch")}
              placeholder={t("generalMasters.select", "Select")}
              options={branchOptions}
              optionValue="value"
              value={formik.values.branchCode || null}
              onChange={(e) => formik.setFieldValue("branchCode", e.value || "")}
              disabled={action === "view"}
            />
          </div>
          <div className="col-12 md:col-4 lg:col-4">
            <DropDowns
              className="dropdown__add__sub"
              label={t("generalMasters.designation", "Designation")}
              placeholder={t("generalMasters.select", "Select")}
              options={
                formik.values.designation && !designationOptions.some((o) => o.value === formik.values.designation)
                  ? [...designationOptions, { name: formik.values.designation, value: formik.values.designation }]
                  : designationOptions
              }
              optionValue="value"
              value={formik.values.designation || null}
              onChange={(e) => formik.setFieldValue("designation", e.value || "")}
              disabled={action === "view"}
            />
          </div>
          <div className="col-12 md:col-4 lg:col-4">
            <DropDowns
              className="dropdown__add__sub"
              label={t("generalMasters.reportingTo", "Reporting To")}
              placeholder={t("generalMasters.select", "Select")}
              options={userOptions.filter((u) => u.value !== id)}
              optionValue="value"
              value={formik.values.reportingTo || null}
              onChange={(e) => formik.setFieldValue("reportingTo", e.value || "")}
              disabled={action === "view"}
            />
          </div>

          <div className="col-12">
            <label className="label__sub__add add__user__roles-label" htmlFor="roles">
              {t("generalMasters.roles")}
              <span className="bv-required">*</span>
            </label>
            <RoleChecklist
              roles={roleOptions}
              value={formik.values.roles || []}
              onChange={handleRoleChange}
              disabled={action === "view"}
              invalid={!!(formik.touched.roles && formik.errors.roles)}
            />
            <FieldError error={formik.touched.roles && formik.errors.roles} />
          </div>
        </div>
      </div>

      <div className="col-12 btn__view__Add mt-2">
        {action === "add" && (
          <Button
            label={t("generalMasters.save")}
            className="save__add__btn"
            onClick={() => {
              formik.handleSubmit();
            }}
          />
        )}
        {action === "edit" && (
          <Button
            className="save__add__btn"
            onClick={() => {
              formik.handleSubmit();
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
