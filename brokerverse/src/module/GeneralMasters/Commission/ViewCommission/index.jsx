import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect, useState } from "react";
import SvgDot from "../../../../assets/icons/SvgDot";
import "../ViewCommission/index.scss";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { useFormik } from "formik";
import LabelWrapper from "../../../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";
import SvgDatePicker from "../../../../assets/icons/SvgDatePicker";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgTable from "../../../../assets/icons/SvgTable";
import ArrowLeftIcon from "../../../../assets/icons/ArrowLeftIcon";
import { SelectButton } from "primereact/selectbutton";
import { useDispatch, useSelector } from "react-redux";
import { getCommissionView } from "../store/commissionMiddleWare";
import { Card } from "primereact/card";
import { useTranslation } from "react-i18next";
import { calendarDateFormat } from "../../../../utility/dateFormat";

const ViewCommission = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const dispatch = useDispatch();
  useEffect(() => {
    if (id) dispatch(getCommissionView(id));
  }, [id, dispatch]);
  const { commissionView, addLevelCommissionSharing } = useSelector(
    ({ commissionMianReducers }) => {
      return {
        loading: commissionMianReducers?.loading,
        commissionView: commissionMianReducers?.commissionView,
        addLevelCommissionSharing:
          commissionMianReducers?.addLevelCommissionSharing,
      };
    }
  );
  const [visiblePopup, setVisiblePopup] = useState(false);
  const [, setDate] = useState(new Date());
  const selectSwitchoptions = ["Yes", "No"];

  const [selectSwitch, setselectSwitch] = useState(selectSwitchoptions[0]);
  const items = [
    { label: t("sidebar.Commission"), url: "/master/generals/commission" },
    {
      label: t("accounts.viewCommissions"),
      url: "/master/generals/commission/viewcommission",
    },
  ];
  const home = { label: t("sidebar.Master") };
  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisiblePopup(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visiblePopup]);

  const [step, setStep] = useState(0);
  const customValidation = (values) => {
    const errors = {};

    if (!values.prttycashcode) {
      errors.prttycashcode = t("validation.fieldRequired");
    }

    if (!values.pettycashname) {
      errors.pettycashname = t("validation.fieldRequired");
    }
    if (!values.pettycashsize) {
      errors.pettycashsize = t("validation.fieldRequired");
    }
    if (!values.avilabelcash) {
      errors.avilabelcash = t("validation.fieldRequired");
    }
    if (!values.mincashback) {
      errors.mincashback = t("validation.fieldRequired");
    }
    if (!values.transactionlimit) {
      errors.transactionlimit = t("validation.fieldRequired");
    }

    return errors;
  };
  const productOptions = [
    { label: commissionView.product, value: commissionView.product },
  ];
  const selectAgentOptions = [
    { label: commissionView.selectAgent, value: commissionView.selectAgent },
  ];
  const selectCoverOptions = [
    { label: commissionView.selectCover, value: commissionView.selectCover },
  ];
  const handleSubmit = (values) => {
  };
  const formik = useFormik({
    initialValues: {
      prttycashcode: "",
      pettycashname: "",
      pettycashsize: "",
      avilabelcash: "",
      mincashback: "",
      transactionlimit: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
      setStep(1);
    },
  });

  const navigate = useNavigate();
  const handleGoBack = () => {
    navigate("/master/generals/commission");
  };
  const [products] = useState([]);
  const [, setFirst] = useState(0);
  const [, setRowsPerPage] = useState(10);
  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };
  const isEmpty = products.length === 0;
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );
  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          className="table__selector"
        >
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


  return (
    <div className="grid view__commission__add__container">
      <div className="col-12 ">
        <div className="add__sub__title">
          <div onClick={handleGoBack} className="mr-2 mt-1">
            <ArrowLeftIcon />
          </div>
          View Commissions
        </div>
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <Card className="card__container">
        <div className="grid  p-2 ">
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
            <InputField
              classNames="input__field__reversal__inactive"
              className={
                step === 0
                  ? "input__label__reversal"
                  : "input__label__reversal__inactive"
              }
              label={t("generalMasters.commissionCode")}
              placeholder={t("generalMasters.enter")}
              value={commissionView.commissionCode}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 input__view__reversal">
            <InputField
              classNames="input__field__reversal__inactive"
              className={
                step === 0
                  ? "input__label__reversal"
                  : "input__label__reversal__inactive"
              }
              label={t("generalMasters.description")}
              placeholder={t("generalMasters.enter")}
              value={commissionView.desc}
              onChange={(e) =>
                formik.setFieldValue("pettycashname", e.target.value)
              }
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
            <DropDowns
              disabled={true}
              className={
                step === 0
                  ? "input__field__reversal"
                  : "input__field__reversal__inactive"
              }
              classNames={
                step === 0
                  ? "input__label__reversal"
                  : "input__label__reversal__inactive"
              }
              label={t("generalMasters.product")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={commissionView.product}
              onChange={(e) =>
                formik.setFieldValue("transactionCode", e.target.value)
              }
              options={productOptions}
              optionLabel="value"
              placeholder={"Select"}
            />

            {formik.touched.transactionCode &&
              formik.errors.transactionCode && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.transactionCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
            <DropDowns
              disabled={true}
              className={
                step === 0
                  ? "input__field__reversal"
                  : "input__field__reversal__inactive"
              }
              classNames={
                step === 0
                  ? "input__label__reversal"
                  : "input__label__reversal__inactive"
              }
              label={t("generalMasters.selectCovers")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={commissionView.selectCover}
              onChange={(e) =>
                formik.setFieldValue("transactionCode", e.target.value)
              }
              options={selectCoverOptions}
              optionLabel="value"
              placeholder={"Select"}
            />

            {formik.touched.transactionCode &&
              formik.errors.transactionCode && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.transactionCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
            <InputField
              classNames="input__field__reversal__inactive"
              className={
                step === 0
                  ? "input__label__reversal"
                  : "input__label__reversal__inactive"
              }
              label={t("generalMasters.maximumRate")}
              placeholder={t("generalMasters.enter")}
              value={commissionView.maxRate}
              onChange={(e) =>
                formik.setFieldValue("pettycashsize", e.target.value)
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper
                label={t("generalMasters.effectiveFrom")}
                textSize={"16px"}
                textColor={"#000"}
                textWeight={"500"}
                classNames="label__sub__add"
              >
                <Calendar
                  dateFormat={calendarDateFormat()}
                  value={commissionView.effectiveFrom ? new Date(commissionView.effectiveFrom) : null}
                  onChange={(e) => setDate(e.value)}
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
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper
                label="Effective To"
                textSize={"16px"}
                textColor={"#000"}
                textWeight={"500"}
                classNames="label__sub__add"
              >
                <Calendar
                  dateFormat={calendarDateFormat()}
                  value={commissionView.effectiveTo ? new Date(commissionView.effectiveTo) : null}
                  onChange={(e) => setDate(e.value)}
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
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
            <DropDowns
              disabled={true}
              className={
                step === 0
                  ? "input__field__reversal"
                  : "input__field__reversal__inactive"
              }
              classNames={
                step === 0
                  ? "input__label__reversal"
                  : "input__label__reversal__inactive"
              }
              label={t("generalMasters.selectAgents")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={commissionView.selectAgent}
              onChange={(e) =>
                formik.setFieldValue("transactionCode", e.target.value)
              }
              options={selectAgentOptions}
              optionLabel="value"
              placeholder={"Select"}
            />

            {formik.touched.transactionCode &&
              formik.errors.transactionCode && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.transactionCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
            <div className="input__label__reversal">Modifiable</div>
            <SelectButton
              className="mt-2 select__switch__option"
              value={selectSwitch}
              onChange={(e) => setselectSwitch(e.value)}
              options={selectSwitchoptions}
              disabled={true}
            />
          </div>
        </div>
      </Card>
      <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal m-1"></div>
      <div className="col-12 bottom__view p-2 m-1">
        <div className="grid  input__view__reversal p-2 mt-1">
          <div className="col-12 md:col-6 lg:col-6 add__level__text">
            Add Level Wise Commission Sharing
          </div>
        </div>
        <div className="col-12 card">
          <DataTable
            value={addLevelCommissionSharing}
            style={{ overflowY: "auto", maxWidth: "100%" }}
            responsive={true}
            className="table__view__Journal__Voture"
            paginator
            paginatorLeft
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            onPage={onPageChange}
            onPageChange={onPageChange}
            emptyMessage={isEmpty ? emptyTableIcon : null}
            scrollable={true}
            scrollHeight="40vh"
          >
            <Column
              field="level"
              header="Level"
              style={{ width: "40%", padding: "1rem" }}
            ></Column>
            <Column
              field="commissionCode"
              header="Commission Code"
              style={{ width: "40%", padding: "1rem" }}
            ></Column>
            <Column
              field="sharingRate"
              header="Share Rate"
              style={{ width: "40%", padding: "1rem" }}
            ></Column>
          </DataTable>
        </div>
      </div>
    </div>
  );
};
export default ViewCommission;
