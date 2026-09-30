import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import "./index.scss";
import SvgTable from "../../../../../../assets/icons/SvgTable";
import { Button } from "primereact/button";
import SvgAdd from "../../../../../../assets/icons/SvgAdd";
import { Dialog } from "primereact/dialog";
import InputField from "../../../../../../components/InputField";
import DropDowns from "../../../../../../components/DropDowns";
import SvgDropdown from "../../../../../../assets/icons/SvgDropdown";
import SvgEyeIcon from "../../../../../../assets/icons/SvgEyeIcon";
import { useDispatch, useSelector } from "react-redux";
import {
  getAdditionalRoleViewMiddleWare,
  postAdditionalRoleViewMiddleWare,
} from "../../store/userMiddleware";
import { useFormik } from "formik";

const UserGroupAccess = () => {
  const { t } = useTranslation();
  const {
    mainAdditionalTableList,
    mainAdditionalViewData,
  } = useSelector(({ userReducers }) => {
    return {
      loading: userReducers?.loading,
      mainAdditionalTableList: userReducers?.mainAdditionalTableList,
      searchList: userReducers?.userSearchList,
      mainAdditionalViewData: userReducers?.mainAdditionalViewData,
    };
  });
  const [products] = useState([]);
  const [show, setShow] = useState(false);
  const [showView, setShowView] = useState(false);

  const item = [
    {
      label: "RC0012",
      value: "RC0012",

      // label: mainAdditionalViewData ? mainAdditionalViewData.RoleCode : formik.values.RoleCode&& "role123",
      // value: mainAdditionalViewData ? mainAdditionalViewData.RoleCode : formik.values.RoleCode&& "role123"
    },
  ];
  const handleClick = () => {
    setShow(!show);
  };
  const dispatch = useDispatch();
  const isEmpty = products.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("generalMasters.noDataEntered")}</div>
    </div>
  );

  // const template2 = {
  //   layout:
  //     "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
  //   RowsPerPageDropdown: (options) => {
  //     const dropdownOptions = [
  //     ];

  const headerStyle = {
    // width: '10rem',
    // backgroundColor: 'var(--color-danger)',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };

  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
      ];

      return (
        <div className="tabel_selector">
          <React.Fragment>
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              {t("generalMasters.rowCount")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };
  const ViewheaderStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
  };

  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleView(rowData)}
        />
      </div>
    );
  };

  const handleView = (rowData) => {
    dispatch(getAdditionalRoleViewMiddleWare(rowData));
    setShowView(true);
  };

  const handleSubmit = () => {
    setShow(false);
    dispatch(postAdditionalRoleViewMiddleWare(formik.values));
  };

  const customValidation = (values) => {
    const errors = {};

    if (!values.RoleCode) {
      errors.RoleCode = t("validation.fieldCodeRequired");
    }
    if (!values.RoleName) {
      errors.RoleName = t("validation.fieldRequired");
    }
    if (!values.ActiveHours) {
      errors.ActiveHours = t("validation.fieldRequired");
    }

    return errors;
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const formik = useFormik({
    initialValues: {
      RoleCode: "",
      RoleName: "",
      ActiveHours: "",
    },
    validate: customValidation,
    // onSubmit: (values) => {
    //   // Handle form submission

    // },
    onSubmit: handleSubmit,
  });
  return (
    <div className="transactioncode__master__table_UserGroupAccess">
      {/* <Card className="mt-1"> */}
      <div className="card">
        <div className="btn__container">
          <Button
            label={t("generalMasters.add")}
            icon={<SvgAdd color={"#fff"} />}
            className="add__btn"
            onClick={() => {
              handleClick();
            }}
          />
        </div>
        <DataTable
          value={mainAdditionalTableList}
          style={{ overflowY: "auto", maxWidth: "100%" }}
          responsive={true}
          className="table__view__Journal__Voture"
          paginator
          paginatorLeft
          rows={5}
          rowsPerPageOptions={[5, 10, 25, 50]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          emptyMessage={isEmpty ? emptyTableIcon : null}
          scrollable={true}
          scrollHeight="40vh"
        >
          <Column
            field="RoleCode"
            header="Role code"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="RoleName"
            header="Role name"
            headerStyle={headerStyle}
            className="fieldvalue_container"
            //   sortable
          ></Column>
          <Column
            field="ActiveHours"
            header="Active Hours"
            headerStyle={headerStyle}
            className="fieldvalue_container"
            //   sortable
          ></Column>
          <Column
            field="action"
            body={renderViewButton}
            header="Action"
            headerStyle={ViewheaderStyle}
            className="fieldvalue_container"
            style={{ display: "flex", justifyContent: "center" }}
          ></Column>
        </DataTable>
      </div>
      <Dialog
        header="Add User Group Access"
        visible={show}
        style={{ width: "50vw", boxShadow: "none" }}
        onHide={() => setShow(false)}
        className="master__flow__common__dialog__container"
      >
        <div className="grid mt-1">
          <div className=" col-12 md:col-6 lg-col-6 ">
            <DropDowns
              value={formik.values.RoleCode}
              onChange={formik.handleChange("RoleCode")}
              error={formik.touched.RoleCode && formik.errors.RoleCode}
              className="inputdialog__fieled"
              label={t("generalMasters.roleCode")}
              classNames="label__sub__add"
              placeholder={"Select"}
              options={item}
              optionLabel="label"
              optionValue={"label"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div className=" col-12 md:col-6 lg-col-6 ">
            <InputField
              classNames="input__filed"
              value={formik.values.RoleName}
              onChange={formik.handleChange("RoleName")}
              error={formik.touched.RoleName && formik.errors.RoleName}
              label={t("generalMasters.roleName")}
              placeholder={t("generalMasters.enter")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            />
          </div>
          <div className=" col-12 md:col-6 lg-col-6 ">
            <InputField
              classNames="input__filed"
              value={formik.values.ActiveHours}
              onChange={formik.handleChange("ActiveHours")}
              error={formik.touched.ActiveHours && formik.errors.ActiveHours}
              label={t("generalMasters.activeHours")}
              placeholder={t("generalMasters.enter")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            />
          </div>
        </div>
        <div className="btn__container">
          <Button
            label={t("generalMasters.save")}
            className="add__btn"
            onClick={formik.handleSubmit}
          />
        </div>
      </Dialog>
      <Dialog
        header=" User Group Access"
        visible={showView}
        style={{ width: "50vw", boxShadow: "none" }}
        onHide={() => setShowView(false)}
        className="master__flow__common__dialog__container"
      >
        <div className="grid mt-1">
          <div className=" col-12 md:col-6 lg-col-6 ">
            <DropDowns
              value={mainAdditionalViewData.RoleCode}
              onChange={formik.handleChange("RoleCode")}
              className="inputdialog__fieled"
              label={t("generalMasters.roleCode")}
              classNames="label__sub__add"
              placeholder={"Select"}
              options={item}
              optionLabel="label"
              optionValue={"label"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div className=" col-12 md:col-6 lg-col-6 ">
            <InputField
              classNames="input__filed"
              value={mainAdditionalViewData.RoleName}
              onChange={formik.handleChange("RoleName")}
              label={t("generalMasters.roleName")}
              placeholder={t("generalMasters.enter")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            />
          </div>
          <div className=" col-12 md:col-6 lg-col-6 ">
            <InputField
              classNames="input__filed"
              value={mainAdditionalViewData.ActiveHours}
              onChange={formik.handleChange("ActiveHours")}
              label={t("generalMasters.activeHours")}
              placeholder={t("generalMasters.enter")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            />
          </div>
        </div>
      </Dialog>
      {/* </Card> */}
    </div>
  );
};

export default UserGroupAccess;
