import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import "./index.scss";
import SvgTable from "../../../../../../assets/icons/SvgTable";
import SvgAdd from "../../../../../../assets/icons/SvgAdd";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../../../components/LabelWrapper";
import InputField from "../../../../../../components/InputField";
import { useFormik } from "formik";
import DropDowns from "../../../../../../components/DropDowns";
import SvgDropdown from "../../../../../../assets/icons/SvgDropdown";
import { useDispatch, useSelector } from "react-redux";
import SvgEyeIcon from "../../../../../../assets/icons/SvgEyeIcon";
import { getViewMainBranchUser, postViewMainBranchUser } from "../../store/userMiddleware";

const TransactionCodeSetupTable = ({ action }) => {
  const { t } = useTranslation();
  const { loading, mainBranchAccessTableList, searchList, mainUserViewData } = useSelector(({ userReducers }) => {
    return {
      loading: userReducers?.loading,
      mainBranchAccessTableList: userReducers?.mainBranchAccessTableList,
      searchList: userReducers?.userSearchList,
      mainUserViewData: userReducers?.mainUserViewData
    };
  });
  const [products, setProducts] = useState([]);
  const [show, setShow] = useState(false);
  const [showView, setShowView] = useState(false);

  const item = [
    {
      label: show ? "Branch1" : showView && mainUserViewData.branchCode,
      value: show ? "NY" : showView && mainUserViewData.branchCode,
    },
  ];
  const item1 = [
    {
      label: show ? "1002" : showView && mainUserViewData.departmentCode,
      value: show ? "NY" : showView && mainUserViewData.departmentCode,
    },
  ];
  const initialValues = {
    branchCode: "",
    branchName: "",
    TransactionNofrom: "",
    departmentCode: "",
    departmentName: "",
  }

  const handleClick = () => {
    setShow(!show);
  };
  const navigate = useNavigate();
  const isEmpty = products.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("generalMasters.noDataEntered")}</div>
    </div>
  );
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
        <div className="table__selector">
          <React.Fragment>
            <span style={{ color: "var(--text-color)", userSelect: "none" }}>
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

  const handleSubmit = () => {
    dispatch(postViewMainBranchUser(formik.values))
    setShow(false)
    formik.resetForm()
  }

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.branchCode) {
      errors.branchCode = t("validation.fieldCodeRequired");
    }
    if (!values.departmentCode) {
      errors.departmentCode = t("validation.fieldRequired");
    }

    return errors;
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    // onSubmit: (values) => {
    //   // Handle form submission
    //    handleSubmit(values);

    // },
    onSubmit: handleSubmit
  });

  // const handleView = (rowData) => {
  //   console.log("View clicked:", rowData);
  //   // navigate("/accounts/pettycash/PettyCashCodeDetails")
  // };
  const dispatch = useDispatch()
  const handleView = (rowData) => {
    dispatch(getViewMainBranchUser(rowData))
    setShowView(true)
    // dispatch(getUserViewDataMiddleWare(rowData))
    // navigate("/accounts/pettycash/PettyCashCodeDetails")
  };

  // const handlEdit = (rowData) => {
  //   console.log(rowData, "gg");
  //   dispatch(getUserEditDataMiddleWare(rowData))
  //   navigate(`/master/generals/usermanagement/user/edit/${rowData?.id}`);
  // };
  const items = [
    { label: t("generalMasters.userManagement") },
    {
      label: t("generalMasters.user"),
      url: "/master/generals/usermanagement/user",
    },
  ];

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
      <div >
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleView(rowData)}
        />
        {/* <Button
          icon={<SvgEditIcon />}
          className="eye__btn"
          onClick={() => handlEdit(rowData)}
        /> */}
      </div>
    );
  };

  return (
    <div className="transactioncode__master__table_view">
      {/* <Card className="mt-1"> */}
      <div className="card">
        {/* <div className="col-12 md:col-12 lg-col-12 "> */}
        <div className="btn__container__add">
          <Button
            label={t("generalMasters.add")}
            icon={<SvgAdd color={"#fff"} />}
            className="add__btn"
            onClick={() => {
              handleClick();
            }}
          />
        </div>
        {/* </div> */}
        <DataTable
          value={mainBranchAccessTableList}
          tableStyle={{
            minWidth: "50rem",
            color: "#2e2e2e",
          }}
          scrollable={true}
          scrollHeight="40vh"
          paginator
          rows={5}
          rowsPerPageOptions={[5, 10, 25, 50]}
          // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          emptyMessage={isEmpty ? emptyTableIcon : null}
        >
          <Column
            field="branchCode"

            header="Branch Code"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="branchName"
            header="Branch Name"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          //   sortable
          ></Column>
          <Column
            field="TransactionNofrom"
            header="Transaction No from"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          //   sortable
          ></Column>
          <Column
            field="departmentCode"
            header="Department code"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="departmentName"
            header="Department name"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="action"
            body={renderViewButton}
            header="Action"
            headerStyle={ViewheaderStyle}
            className="fieldvalue_container_action"
            style={{ display: 'flex', justifyContent: 'center' }}
          ></Column>
        </DataTable>
      </div>
      <Dialog
        header={t("generalMasters.addBranchDepartment")}
        visible={show}
        style={{ width: "50vw" ,boxShadow:"none"}}
        onHide={() => setShow(false)}
        className="dialogue_style master__flow__common__dialog__container"
       
      >
        <div className="grid mt-1">

        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg-col-6 ">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.branchCode}
              onChange={formik.handleChange("branchCode")}
              error={formik.touched.branchCode && formik.errors.branchCode}
              className="dropdown__add__sub"
              label={t("generalMasters.branch")}
              classNames="label__sub__add"
              placeholder={"Select"}
              options={item}
              optionLabel="label"
              optionValue={"label"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />

          </div>
          <div className="col-12 md:col-6 lg-col-6 ">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.departmentCode}
              onChange={formik.handleChange("departmentCode")}
              error={formik.touched.departmentCode &&formik.errors.departmentCode}
              className="dropdown__add__sub"
              label={t("generalMasters.departmentCode")}
              classNames="label__sub__add"
              placeholder={"Select"}
              options={item1}
              optionLabel="label"
              optionValue={"label"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
        </div>
        <div className="btn__container">
          <Button
            label={t("generalMasters.save")}
            className="add__btn"
            // onClick={() => {
            //   handleSave();
            // }}
            onClick={() => { formik.handleSubmit(); }}
          />
        </div>
      </Dialog>
      <Dialog
        header="View Branch & Department"
        visible={showView}
        style={{ width: "50vw",boxShadow:"none" }}
        onHide={() => setShowView(false)}
        className="dialogue_style master__flow__common__dialog__container"
        
      >
        <div className="grid mt-1">

        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg-col-6 ">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={mainUserViewData.branchCode}
              onChange={formik.handleChange("branchCode")}
              // error={formik.errors.branchCode}
              className="dropdown__add__sub"
              label={t("generalMasters.branch")}
              classNames="label__sub__add"
              placeholder={"Select"}
              options={item}
              optionLabel="label"
              optionValue={"label"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />

          </div>
          <div className="col-12 md:col-6 lg-col-6 ">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={mainUserViewData.departmentCode}
              onChange={formik.handleChange("departmentCode")}
              // error={formik.errors.departmentCode}
              className="dropdown__add__sub"
              label={t("generalMasters.departmentCode")}
              classNames="label__sub__add"
              placeholder={"Select"}
              options={item1}
              optionLabel="label"
              optionValue={"label"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
        </div>

      </Dialog>
      {/* </Card> */}
    </div>
  );
};

export default TransactionCodeSetupTable;
