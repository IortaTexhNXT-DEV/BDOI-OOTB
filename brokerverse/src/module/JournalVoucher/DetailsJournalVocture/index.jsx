import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import NavBar from "../../../components/NavBar";
import DropDowns from "../../../components/DropDowns";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import InputField from "../../../components/InputField";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../components/LabelWrapper";
import SvgDatePicker from "../../../assets/icons/SvgDatePicker";
import SvgDot from "../../../assets/icons/SvgDot";
import "../DetailsJournalVocture/index.scss";
import ArrowLeftIcon from "../../../assets/icons/ArrowLeftIcon";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgArrow from "../../../assets/icons/SvgArrow";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import { data } from "./data";
import { useFormik } from "formik";
import ViewDataTabel from "./ViewDataTabel";
import { useDispatch, useSelector } from "react-redux";
import {
  getJournalVoucherViewData,
  getJournalVoucherDetails,
} from "../store/journalVoucherMiddleware";

const DetailsJournalVocture = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { id } = useParams();
  const dispatch = useDispatch();

  // useEffect(() => {
  //   dispatch(getpaymentVocherByIdMiddleware(id));
  // }, [id]);

  const {
    journalVoucherView,
    loading,
    journalVoucherPostTabelData,
    journalVoucherDetailsPagination,
  } = useSelector(({ journalVoucherMainReducers }) => {
    return {
      loading: journalVoucherMainReducers?.loading,
      journalVoucherView: journalVoucherMainReducers?.journalVoucherView,
      journalVoucherPostTabelData:
        journalVoucherMainReducers?.journalVoucherPostTabelData,
      journalVoucherDetailsPagination:
        journalVoucherMainReducers?.journalVoucherDetailsPagination || {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
    };
  });
  console.log(journalVoucherView, "journalVoucherView");

  const totalCredit = journalVoucherPostTabelData.reduce((total, item) => {
    if (item.entryType === "Credit") {
      const localAmount = parseFloat(item.localAmount);
      return !isNaN(localAmount) ? total + localAmount : total;
    }
    return total; // Important: Return the total for each iteration.
  }, 0);

  const totalDebit = journalVoucherPostTabelData.reduce((total, item) => {
    if (item.entryType === "Debit") {
      const localAmount = parseFloat(item.localAmount);
      return !isNaN(localAmount) ? total + localAmount : total;
    }
    return total;
  }, 0);

  const [visiblePopup, setVisiblePopup] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);
  const [date, setDate] = useState(new Date());
  const items = [
    {
      label: t("accounts.journalVoucherDetails.journalVoucher"),
      command: () => navigate("/accounts/journalvoucher"),
    },
    {
      id: 1,
      label: t("accounts.journalVoucherDetails.title"),
      to: "/accounts/journalvoucher/detailsjournalvocture",
    },
  ];
  const home = { label: t("accounts.journalVoucherDetails.account") };

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const isInitialMount = useRef(true);

  // Load journal voucher details on component mount
  useEffect(() => {
    if (id) {
      dispatch(
        getJournalVoucherDetails({
          page: 1,
          pageSize: rowsPerPage,
          transactionNumber: id,
        })
      );
      isInitialMount.current = false;
    }
  }, [id, dispatch]);

  // Handle pagination changes
  useEffect(() => {
    if (!isInitialMount.current && id) {
      dispatch(
        getJournalVoucherDetails({
          page: currentPage,
          pageSize: rowsPerPage,
          transactionNumber: id,
        })
      );
    }
  }, [currentPage, rowsPerPage, id, dispatch]);

  const onPageChange = (event) => {
    const newPage = event.page + 1; // PrimeReact uses 0-based indexing
    const newPageSize = event.rows;
    setFirst(event.first);
    setRowsPerPage(newPageSize);
    setCurrentPage(newPage);
  };

  const rows = [
    {
      id: 1,
      main: "",
      sub: "",
      remarks: "",
      currency: "",
      foreign: "",
      local: "",
      entry: "",
    },
    {
      id: 2,
      main: "",
      sub: "",
      remarks: "",
      currency: "",
      foreign: "",
      local: "",
      entry: "",
    },
  ];
  const toast = useRef(null);
  const [newDataTable, setnewDataTable] = useState([]);
  const [visible, setVisible] = useState(false);
  const handleEdit = () => {
    console.log("handleEdit success");
    setVisible(true);
  };

  const showSuccess = () => {
    toast.current.show({
      severity: "success",
      summary: t("accounts.journalVoucherDetails.success"),
      detail: t("accounts.journalVoucherDetails.messageContent"),
      life: 3000,
      icon: "pi pi-check-circle",
    });
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.transactioncode) {
      errors.transactioncode = t("accounts.journalVoucherDetails.mainAccountRequired");
    }

    return errors;
  };

  const handleFormSubmit = () => {
    showSuccess();
  };
  const handleSubmit = (values) => {
    dispatch(getJournalVoucherViewData());
    // Handle form submission
    console.log(values, "valuesuuu");
    // setVisible(false);
    // setVisiblePopup(true);
  };
  const mainAccountOptions = [
    {
      label:
        journalVoucherView?.transationCode ||
        journalVoucherView?.transactionCode ||
        "",
      value:
        journalVoucherView?.transationCode ||
        journalVoucherView?.transactionCode ||
        "",
    },
  ];
  const formik = useFormik({
    initialValues: {
      transactioncode:
        journalVoucherView?.transationCode ||
        journalVoucherView?.transactionCode ||
        "",
      transactionDescription:
        journalVoucherView?.transationDescription ||
        journalVoucherView?.transactionDescription ||
        "",
      transactionNumber:
        journalVoucherView?.transactionNumber ||
        journalVoucherView?.transationCode ||
        "",
      date: journalVoucherView?.date
        ? new Date(journalVoucherView.date)
        : new Date(),
      totalCredit: totalCredit.toString(),
      totalDebit: totalDebit.toString(),
      net: (totalCredit - totalDebit).toFixed(2),
    },
    validate: customValidation,
    onSubmit: handleSubmit,
    enableReinitialize: true,
  });

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };

  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisiblePopup(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visiblePopup]);

  // Update formik values when journalVoucherView changes (from API response)
  useEffect(() => {
    if (
      journalVoucherView?.transationCode ||
      journalVoucherView?.transactionCode
    ) {
      const transactionCode =
        journalVoucherView?.transationCode ||
        journalVoucherView?.transactionCode ||
        "";
      const transactionDescription =
        journalVoucherView?.transationDescription ||
        journalVoucherView?.transactionDescription ||
        "";

      if (formik.values.transactioncode !== transactionCode) {
        formik.setFieldValue("transactioncode", transactionCode);
      }
      if (formik.values.transactionDescription !== transactionDescription) {
        formik.setFieldValue("transactionDescription", transactionDescription);
      }
      if (
        formik.values.transactionNumber !==
        (journalVoucherView?.transactionNumber || transactionCode)
      ) {
        formik.setFieldValue(
          "transactionNumber",
          journalVoucherView?.transactionNumber || transactionCode
        );
      }

      if (journalVoucherView?.date) {
        const dateValue = new Date(journalVoucherView.date);
        if (!date || date.getTime() !== dateValue.getTime()) {
          setDate(dateValue);
          formik.setFieldValue("date", dateValue);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalVoucherView]);
  const handleGoback = () => {
    navigate("/accounts/journalvoucher");
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
        <React.Fragment>
          <div className="row__count__view">
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              {t("accounts.journalVoucherDetails.rowCount")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </div>
        </React.Fragment>
      );
    },
  };

  return (
    <div className="grid sub__add__container">
      <div className="col-12"></div>
      <Toast ref={toast} />

      <div className="col-12 mb-2">
        <div className="add__sub__title">
          <span className="mr-2" onClick={handleGoback}>
            <ArrowLeftIcon />
          </span>{" "}
          {t("accounts.journalVoucherDetails.title")}
        </div>
        <div className="mt-4">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <form onSubmit={formik.handleSubmit}>
        <div className="col-12 m-0 ">
          <div className="grid add__journal__vocture p-3 m-1">
            <div class="sm-col-12  md:col-3 lg-col-4 ">
              <DropDowns
                className="dropdown__add__sub"
                label={t("accounts.journalVoucherDetails.transactionCode")}
                classNames="label__sub__add"
                value={
                  journalVoucherView?.transationCode ||
                  journalVoucherView?.transactionCode ||
                  ""
                }
                onChange={(e) =>
                  formik.setFieldValue("transactioncode", e.target.value)
                }
                options={mainAccountOptions}
                optionLabel="label"
                defaultValue={formik.values.transactioncode}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                label={t("accounts.journalVoucherDetails.transactionDescription")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("accounts.journalVoucherDetails.enter")}
                value={
                  formik.values.transactionDescription ||
                  journalVoucherView?.transationDescription ||
                  journalVoucherView?.transactionDescription ||
                  ""
                }
                disabled={true}
                onChange={(e) =>
                  formik.setFieldValue("transactionDescription", e.target.value)
                }
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                label={t("accounts.journalVoucherDetails.transactionNumber")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                // placeholder="Enter"
                value={journalVoucherView?.transactionNumber || ""}
                onChange={(e) =>
                  formik.setFieldValue("transactionNumber", e.target.value)
                }
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
              <div class="calender_container_claim p-0">
                <LabelWrapper
                  label={t("accounts.journalVoucherDetails.date")}
                  textSize={"16px"}
                  textColor={"#000"}
                  textWeight={"300"}
                  classNames="label__sub__add"
                >
                  {/* <Calendar
                                        value={formik.values.date}
                                        onChange={(e) => setDate(e.value)}
                                        showIcon
                                        className="calender_field_claim"
                                        disabled={true}
                                    /> */}
                  <Calendar
                    value={
                      date ||
                      (journalVoucherView?.date
                        ? new Date(journalVoucherView.date)
                        : null) ||
                      null
                    }
                    onChange={(e) => {
                      setDate(e.value);
                      formik.setFieldValue("date", e.value);
                    }}
                    showIcon
                    className="calender_field_claim"
                    disabled={true}
                  />

                  <div className="calender_icon_claim">
                    <SvgDatePicker />
                  </div>
                </LabelWrapper>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 m-0 ">
          <div className="sub__account__details__jV">
            <div
              className="col-12 md:col-12 lg-col-12"
              style={{ maxWidth: "100%" }}
            >
              <div className="card">
                <ViewDataTabel
                  journalVoucherPostTabelData={journalVoucherPostTabelData}
                  handleEdit={handleEdit}
                  newDataTable={newDataTable}
                  visible={visible}
                  pagination={journalVoucherDetailsPagination}
                  loading={loading}
                  onPageChange={onPageChange}
                  first={first}
                  rowsPerPage={rowsPerPage}
                />
              </div>
            </div>
          </div>
          <div className="col-12 m-0 ">
            <div className="grid add__journal__vocture__view p-3">
              <div class="sm-col-12  md:col-3 lg-col-4 ">
                <InputField
                  label={t("accounts.journalVoucherDetails.totalCredit")}
                  classNames="dropdown__add__sub"
                  className="label__sub__add"
                  placeholder={t("accounts.journalVoucherDetails.enter")}
                  value={totalCredit}
                  disabled={true}
                  onChange={(e) =>
                    formik.setFieldValue("totalCredit", e.target.value)
                  }
                />
              </div>
              <div className="col-12 md:col-3 lg:col-3">
                <InputField
                  label={t("accounts.journalVoucherDetails.totalDebit")}
                  classNames="dropdown__add__sub"
                  className="label__sub__add"
                  placeholder={t("accounts.journalVoucherDetails.enter")}
                  value={totalDebit}
                  disabled={true}
                  onChange={(e) =>
                    formik.setFieldValue("totalDebit", e.target.value)
                  }
                />
              </div>
              <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
                <InputField
                  label={t("accounts.journalVoucherDetails.net")}
                  classNames="dropdown__add__sub"
                  className="label__sub__add"
                  placeholder={t("accounts.journalVoucherDetails.enter")}
                  value={(totalCredit - totalDebit).toFixed(2)}
                  disabled={true}
                  onChange={(e) => formik.setFieldValue("net", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
export default DetailsJournalVocture;
