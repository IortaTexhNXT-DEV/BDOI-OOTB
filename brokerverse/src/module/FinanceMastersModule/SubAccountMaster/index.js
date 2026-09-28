import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/icons/SvgAdd";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import NavBar from "../../../components/NavBar";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import { Paginator } from "primereact/paginator";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import SvgEditIcon from "../../../assets/icons/SvgEditicons";
import SvgUploade from "../../../assets/icons/SvgUploade";
import { Dialog } from "primereact/dialog";
import InputField from "../../../components/InputField";
import DropDowns from "../../../components/DropDowns";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import { MultiSelect } from "primereact/multiselect";
import CustomToast from "../../../components/Toast";
import { useDispatch, useSelector } from "react-redux";
import SvgTable from "../../../assets/icons/SvgTable";
import { useFormik } from "formik";
import {
  getSubAccountEdit,
  getSubAccountSearchList,
  getSubAccountView,
  postSubAccount,
} from "./store/subAccountMiddleWare";
import useSubAccountOptions from "./useSubAccountOptions";
import MasterStatusToggle from "../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";

const SubAccountMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [visiblePopup, setVisiblePopup] = useState(false);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedOption1, setSelectedOption1] = useState(null);
  const handleDropdownChange = (e) => {
    setSelectedOption(e.value);
  };
  const handleDropdownChange1 = (e) => {
    setSelectedOption1(e.value);
  };

  const handleClick = () => {};

  const { subAccountList, loading, subAccountSearchList } = useSelector(
    ({ subAccountMainReducers }) => {
      return {
        loading: subAccountMainReducers?.loading,
        subAccountList: subAccountMainReducers?.subAccountList,
        subAccountSearchList: subAccountMainReducers?.subAccountSearchList,
      };
    }
  );

  const items = [{ label: t("financeMasters.subAccount"), url: "/master/finance/subaccount" }];
  const home = { label: t("financeMasters.master") };
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  const ViewheaderStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
  };

  const columns = [
    { field: "tax", headerName: "Tax Code", flex: 1 },
    { field: "taxName", headerName: " Tax Name", flex: 1 },

    { field: "desc", headerName: "Tax Rate", flex: 1 },
    { field: "effective", headerName: "Effective From", flex: 1 },
    { field: "effectiveTo", headerName: "Effective To", flex: 1 },
    { field: "status", headerName: "Status", flex: 1 },
    { field: "action", headerName: "Action", flex: 1 },
  ];

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };
  const subAccountOptions = useSubAccountOptions();
  const item = subAccountOptions.mainAccounts;
  const item1 = subAccountOptions.currencies;
  const toastRef = useRef(null);
  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleDetail(rowData)}
        />
        <Button
          icon={<SvgEditIcon />}
          className="eye__btn"
          onClick={() => handlEdit(rowData)}
        />
      </div>
    );
  };


  const handleView = (rowData) => {
    setVisiblePopup(true);
  };

  // const handleToast = (values) => {
  //   // Handle form submission
  //   console.log(values, "find values");

  //   toastRef.current.showToast();
  //   // {
  //   setTimeout(() => {
  //     setVisiblePopup(false)
  //   }, 3000);
  // }
  const handlEdit = (rowData) => {

    dispatch(getSubAccountEdit(rowData));
    navigate("/master/finance/subaccount/subaccountedit");
  };
  const handleDetail = (rowData) => {
    dispatch(getSubAccountView(rowData));
    navigate("/master/finance/subaccount/subaccountdetails");
  };

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("financeMasters.noDataEntered")}</div>
    </div>
  );
  const isEmpty = !subAccountList?.length;

  // const emptyTableIcon = (
  //   <div className="empty-table-icon">
  //     <SvgTable />
  //   </div>
  // );
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
              {t("financeMasters.rowCount")}{" "}
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

  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getSubAccount());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getSubAccount());
  }, [dispatch]);
  const handleSubmit = async (values) => {
    try {
      await dispatch(postSubAccount(values)).unwrap();
      toastRef.current.showToast();
      setTimeout(() => {
        setVisiblePopup(false);
      }, 2000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.subAccountCode) {
      errors.subAccountCode = "This Field is Required";
    }
    if (!values.description) {
      errors.description = "This Field is Required";
    }
    if (!values.subAccountName) {
      errors.subAccountName = "This Field is Required";
    }
    if (!values.mainAccount) {
      errors.mainAccount = "This Field is Required";
    }
    if (!values.currencyCode) {
      errors.currencyCode = "This Field is Required";
    }
    return errors;
  };

  const formik = useFormik({
    initialValues: {
      subAccountCode: "",
      description: "",
      subAccountName: "",
      mainAccount: "",
      currencyCode: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getSubAccountSearchList(search));
    }
  }, [search]);

  return (
    <div className="grid  container__subaccount">
      <Toast ref={statusToast} />
      <div className="col-12"></div>
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__taxation">{t("financeMasters.subAccountMaster")}</div>
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal__taxation"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>

      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="btn__container">
          <Button
            outlined
            label={t("financeMasters.upload")}
            icon={<SvgUploade color={"#fff"} />}
            className="upload__btn"
            onClick={() => {
              handleClick();
            }}
          />
          <Button
            label={t("generalMasters.add")}
            icon={<SvgAdd color={"#fff"} />}
            className="add__btn"
            onClick={() => {
              handleView();
            }}
          />
        </div>
      </div>
      <div className="col-12 m-0 ">
        <div className="sub__account__sub__container__taxation">
          <div className="col-12 search__filter__view__taxation">
            <div className="col-12 md:col-12 lg:col-12">
              <div className="searchIcon__view__input__taxation">
                {/* <span className='p-3'> <SvgSearchIcon /></span> */}
                <i className="pi pi-search pl-3" />
                <InputText
                  style={{ width: "100%" }}
                  classNames="input__sub__account__taxation"
                  placeholder={t("financeMasters.searchBySubAccountCode")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-12 ">
            <div className="main__tabel__title__taxation p-2">
              {t("financeMasters.subAccountList")}
            </div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%" }}
          >
            <div className="card">
              <DataTable
                value={search ? subAccountSearchList : subAccountList}
                paginator
                rows={5}
                rowsPerPageOptions={[5, 10, 25, 50]}
                currentPageReportTemplate="{first} - {last} of {totalRecords}"
                paginatorTemplate={template2}
                className="reversal__table__main"
                scrollable={true}
                scrollHeight="40vh"
                emptyMessage={isEmpty ? emptyTableIcon : null}
              >
                <Column
                  field="subAccountCode"
                  header="Sub Account Code"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.subAccountCode?.toUpperCase()}
                  sortable
                ></Column>
                <Column
                  field="description"
                  header={t("financeMasters.description")}
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.description?.toUpperCase()}
                ></Column>

                <Column
                  field="status"
                  body={(columnData) => <MasterStatusToggle type="sub-account" record={columnData} onChanged={reloadList} onError={showStatusError} />}
                  header={t("financeMasters.status")}
                  headerStyle={{ textAlign: "center", ...headerStyle }}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="action"
                  body={renderViewButton}
                  header={t("financeMasters.action")}
                  headerStyle={{ ...ViewheaderStyle }}
                  className="fieldvalue_container centered"
                ></Column>
              </DataTable>

              <div className="col-12">
                <Dialog
                  header={t("financeMasters.addSubAccount")}
                  visible={visiblePopup}
                  className="dialog_fields master__flow__common__dialog__container"
                  onHide={() => setVisiblePopup(false)}
                  style={{ width: "60vw", boxShadow: "none" }}
                >
                  <div class="grid">
                    <div class="sm-col-12  md:col-4 lg-col-4">
                      <InputField
                        classNames="dropdown__add__sub"
                        label="Sub Account Code"
                        placeholder={"Enter"}
                        textWeight="500"
                        value={formik.values.subAccountCode}
                        onChange={(e) =>
                          formik.setFieldValue("subAccountCode", e.target.value)
                        }
                      />
                      {formik.touched.subAccountCode &&
                        formik.errors.subAccountCode && (
                          <div style={{ fontSize: 12, color: "red" }}>
                            {formik.errors.subAccountCode}
                          </div>
                        )}
                    </div>
                    <div class="sm-col-12  md:col-8 lg-col-8">
                      <InputField
                        classNames="dropdown__add__sub"
                        label="Sub Account Name"
                        placeholder={"Enter"}
                        textWeight="500"
                        value={formik.values.subAccountName}
                        onChange={(e) =>
                          formik.setFieldValue("subAccountName", e.target.value)
                        }
                      />
                      {formik.touched.subAccountName &&
                        formik.errors.subAccountName && (
                          <div style={{ fontSize: 12, color: "red" }}>
                            {formik.errors.subAccountName}
                          </div>
                        )}
                    </div>
                  </div>
                  <div class="grid">
                    <div class="sm-col-12  md:col-8 lg-col-8">
                      <InputField
                        classNames="dropdown__add__sub"
                        label="Description"
                        placeholder={"Enter"}
                        textWeight="500"
                        value={formik.values.description}
                        onChange={(e) =>
                          formik.setFieldValue("description", e.target.value)
                        }
                      />
                      {formik.touched.description &&
                        formik.errors.description && (
                          <div style={{ fontSize: 12, color: "red" }}>
                            {formik.errors.description}
                          </div>
                        )}
                    </div>
                  </div>
                  <div class="grid">
                    <div class="sm-col-12  md:col-8 lg-col-8">
                      <label className="main_acc_text">Main Account</label>
                      <MultiSelect
                        // value={selectedOption}
                        options={item}
                        // onChange={handleDropdownChange}

                        value={formik.values.mainAccount}
                        onChange={(e) =>
                          formik.setFieldValue("mainAccount", e.value)
                        }
                        className="dropdown__add__sub"
                        label="Main Account"
                        display="chip"
                        optionLabel="value"
                        classNames="label__sub__add"
                        placeholder={"Select"}
                        dropdownIcon={<SvgDropdown color={"#000"} />}
                      />

                      {formik.touched.mainAccount &&
                        formik.errors.mainAccount && (
                          <div
                            style={{ fontSize: 12, color: "red" }}
                            className="formik__errror__JV"
                          >
                            {formik.errors.mainAccount}
                          </div>
                        )}
                    </div>
                  </div>
                  <div class="grid">
                    <div class="sm-col-12  md:col-8 lg-col-8">
                      <label className="main_acc_text">Currency Code</label>
                      <MultiSelect
                        value={formik.values.currencyCode}
                        onChange={(e) =>
                          formik.setFieldValue("currencyCode", e.value)
                        }
                        options={item1}
                        className="dropdown__add__sub"
                        display="chip"
                        optionLabel="value"
                        classNames="label__sub__add"
                        placeholder={"Select"}
                        dropdownIcon={<SvgDropdown color={"#000"} />}
                      />
                      {formik.touched.currencyCode &&
                        formik.errors.currencyCode && (
                          <div
                            style={{ fontSize: 12, color: "red" }}
                            className="formik__errror__JV"
                          >
                            {formik.errors.currencyCode}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="update_btn">
                    <Button
                      label={t("financeMasters.save")}
                      className="update_btnlabel"
                      // onClick={() => handleToast()}
                      onClick={formik.handleSubmit}
                    />
                  </div>
                </Dialog>
                <CustomToast
                  ref={toastRef}
                  message={t("financeMasters.subAccountAdded", { code: "SAC1234" })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubAccountMaster;
