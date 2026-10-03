import { BreadCrumb } from "primereact/breadcrumb";
import { useEffect, useState, useRef } from "react";
import SvgDot from "../../../../assets/icons/SvgDot";
import "../EditCommission/index.scss";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { useFormik } from "formik";
import LabelWrapper from "../../../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";
import SvgDatePicker from "../../../../assets/icons/SvgDatePicker";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgTable from "../../../../assets/icons/SvgTable";
import ArrowLeftIcon from "../../../../assets/icons/ArrowLeftIcon";
import EditCommissionPopup from "./EditCommissionPopup";
import CustomToast from "../../../../components/Toast";
import { SelectButton } from "primereact/selectbutton";
import useMasterOptions from "../../common/useMasterOptions";
import { agentOptions } from "../../../../services/mastersService";
import SvgEditIcon from "../../../../assets/icons/SvgEditIcon";
import { useDispatch, useSelector } from "react-redux";
import {
  getEditCommissionPopup,
  patchCommissionEdit,
} from "../store/commissionMiddleWare";
import { Card } from "primereact/card";
import AddCommissionPopup from "../AddCommission/AddCommissionPopup";
import { useTranslation } from "react-i18next";
import { calendarDateFormat, toIsoDate } from "../../../../utility/dateFormat";
import { MultiSelect } from "primereact/multiselect";

const EditCommission = () => {
  const { t } = useTranslation();
  const {
    getCommissionEdit,
    addLevelCommissionSharing,
  } = useSelector(({ commissionMianReducers }) => {
    return {
      loading: commissionMianReducers?.loading,
      getCommissionEdit: commissionMianReducers?.getCommissionEdit,
      addLevelCommissionSharing:
        commissionMianReducers?.addLevelCommissionSharing,
    };
  });

  const toastRef = useRef(null);
  const [visiblePopup, setVisiblePopup] = useState(false);

  const selectSwitchoptions = ["Yes", "No"];
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [selectSwitch, setselectSwitch] = useState(selectSwitchoptions[0]);
  const items = [
    { label: t("sidebar.Commission"), url: "/master/generals/commission" },
    {
      label: t("accounts.editCommissions"),
      url: "/master/generals/commission/editcommission",
    },
  ];
  const [visible, setVisible] = useState(false);
  const home = { label: t("sidebar.Master") };
  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisible(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visiblePopup]);

  const [step, setStep] = useState(0);
  const customValidation = (values) => {
    const errors = {};


    if (!values.desc) {
      errors.desc = t("validation.fieldRequired");
    }
    if (!values.product) {
      errors.product = t("commission.productRequired");
    }
    if (!values.selectCover?.length) {
      errors.selectCover = t("commission.selectCoverRequired");
    }
    if (!values.maxRate) {
      errors.maxRate = t("commission.maxRateRequired");
    }
    if (!values.effectiveFrom) {
      errors.effectiveFrom = t("validation.fieldRequired");
    }
    // Effective To is optional (open ended) and may not be before Effective From
    if (values.effectiveTo && values.effectiveFrom && values.effectiveTo < values.effectiveFrom) {
      errors.effectiveTo = t("generalMasters.effectiveToBeforeFrom");
    }

    return errors;
  };
  const handleSubmit = async (value) => {
    try {
      await dispatch(patchCommissionEdit(value)).unwrap();
      setStep(1);
      toastRef.current.showToast({ detail: t("financeMasters.saveSuccessfully") });
      setTimeout(() => {
        navigate("/master/generals/commission");
      }, 2000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const insuranceCompanyOptionData = useMasterOptions("insurance-company");
  const productOptionData = useMasterOptions("product");
  const selectedCoverOption = useMasterOptions("cover");
  const [selectAgentDataOption, setSelectAgentDataOption] = useState([]);
  useEffect(() => {
    agentOptions()
      .then(setSelectAgentDataOption)
      .catch(() => setSelectAgentDataOption([]));
  }, []);
  const setFormikValues = () => {
    const productData = getCommissionEdit?.product;
    const selectCoversData = getCommissionEdit?.selectCover;
    const selectAgentData = getCommissionEdit?.selectAgent;
    const updatedValues = {
      id: getCommissionEdit?.id,
      commissionCode: getCommissionEdit?.commissionCode,
      insuranceCompany: getCommissionEdit?.insuranceCompany,
      product: productData,
      desc: getCommissionEdit?.desc,
      selectCover: Array.isArray(selectCoversData) ? selectCoversData : selectCoversData ? [selectCoversData] : [],
      effectiveFrom: getCommissionEdit?.effectiveFrom,
      effectiveTo: getCommissionEdit?.effectiveTo,
      maxRate: getCommissionEdit?.maxRate,
      selectAgent: selectAgentData,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const formik = useFormik({
    initialValues: {
      commissionCode: "",
      insuranceCompany: "",
      desc: "",
      product: "",
      selectCover: "",
      maxRate: "",
      selectAgent: "",
      effectiveFrom: "",
      effectiveTo: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  useEffect(() => {
    setFormikValues();
  }, [getCommissionEdit]);
  const handleGoBack = () => {
    navigate("/master/generals/commission");
  };
  // const formik = useFormik({
  //     initialValues: {
  //         commissionCode: "",
  //         desc: "",
  //         // pettycashname: "",
  //         product: "",
  //         selectCover: "",
  //         maxRate: "",
  //         selectAgent: "",
  //         effectiveFrom: "",
  //         effectiveTo: ""

  //     },
  //     validate: customValidation,

  //     onSubmit: (values) => {
  //     },
  // });
  const handlePolicy = () => {
    setVisible(true);
  };
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [, setFirst] = useState(0);
  const [, setRowsPerPage] = useState(10);
  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };
  const isEmpty = !addLevelCommissionSharing?.length;
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
        <div style={{ width: "40%" }} className="table__selector">
          <span style={{ color: "var(--text-color)", userSelect: "none" }}>
            {t("generalMasters.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </div>
      );
    },
  };
  const handleEditNavigate = (rowData) => {
    setVisiblePopup(true);
    dispatch(getEditCommissionPopup(rowData));
    setShowEditPopup(true);
  };

  const renderEditButton = (rowData) => {
    return (
      <div className="centercontent">
        <div onClick={() => handleEditNavigate(rowData)}>
          <SvgEditIcon />
        </div>
      </div>
    );
  };

  return (
    <div className="grid edit__commission__add__container">
      <CustomToast ref={toastRef} message="updated Commission" />

      <div className="col-12 ">
        <div className="add__sub__title">
          <div onClick={handleGoBack} className="mr-2 mt-1">
            <ArrowLeftIcon />
          </div>
          Edit Commissions
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
        <div className="grid  p-2 m-1">
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
              value={formik.values.commissionCode}
              disabled
            />
            {formik.touched.commissionCode && formik.errors.commissionCode && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.commissionCode}
              </div>
            )}
                   </div>
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
            <DropDowns
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
              label={t("generalMasters.insuranceCompany")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.insuranceCompany}
              onChange={(e) => formik.setFieldValue("insuranceCompany", e.target.value)}
              options={insuranceCompanyOptionData}
              optionLabel="value"
              placeholder={"Select"}
            />

            {formik.touched.product && formik.errors.product && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.product}
              </div>
            )}
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
              value={formik.values.desc}
              onChange={(e) => formik.setFieldValue("desc", e.target.value)}
            />
            {formik.touched.desc && formik.errors.desc && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.desc}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
            <DropDowns
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
              value={formik.values.product}
              onChange={(e) => formik.setFieldValue("product", e.target.value)}
              options={productOptionData}
              optionLabel="value"
              placeholder={"Select"}
            />

            {formik.touched.product && formik.errors.product && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.product}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
            <LabelWrapper label={t("generalMasters.selectCovers")} textSize={"16px"} textColor={"#000"} textWeight={"300"} classNames="label__sub__add">
              <MultiSelect
                value={formik.values.selectCover}
                onChange={(e) => formik.setFieldValue("selectCover", e.value)}
                options={selectedCoverOption}
                optionLabel="label"
                optionValue="value"
                display="chip"
                filter
                placeholder={t("generalMasters.selectCoversPlaceholder")}
                className="w-full"
              />
            </LabelWrapper>

            {formik.touched.selectCover && formik.errors.selectCover && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.selectCover}
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
              value={formik.values.maxRate}
              onChange={(e) => formik.setFieldValue("maxRate", e.target.value)}
            />
            {formik.touched.maxRate && formik.errors.maxRate && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.maxRate}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper
                label={t("generalMasters.effectiveFrom")}
                textSize={"16px"}
                textColor={"#000"}
                textWeight={"300"}
                classNames="label__sub__add"
              >
                <Calendar
                  value={
                    formik.values.effectiveFrom
                      ? new Date(formik.values.effectiveFrom)
                      : null
                  }
                  onChange={(e) => {
                    formik.handleChange("effectiveFrom")(
                      e.value ? toIsoDate(e.value) : ""
                    );
                  }}
                  dateFormat={calendarDateFormat()}
                  showIcon
                  className="calender_field_claim"
                />
                <div className="calender_icon_claim">
                  <SvgDatePicker />
                </div>
              </LabelWrapper>
            </div>
            {formik.touched.effectiveFrom && formik.errors.effectiveFrom && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.effectiveFrom}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper
                label={t("generalMasters.effectiveTo")}
                textSize={"16px"}
                textColor={"#000"}
                textWeight={"300"}
                classNames="label__sub__add"
              >
                <Calendar
                  value={
                    formik.values.effectiveTo
                      ? new Date(formik.values.effectiveTo)
                      : null
                  }
                  onChange={(e) => {
                    formik.handleChange("effectiveTo")(
                      e.value ? toIsoDate(e.value) : ""
                    );
                  }}
                  dateFormat={calendarDateFormat()}
                  showIcon
                  showButtonBar
                  placeholder={t("generalMasters.openEnded")}
                  minDate={formik.values.effectiveFrom ? new Date(formik.values.effectiveFrom) : undefined}
                  className="calender_field_claim"
                />
                <div className="calender_icon_claim">
                  <SvgDatePicker />
                </div>
              </LabelWrapper>
            </div>
            {formik.touched.effectiveTo && formik.errors.effectiveTo && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.effectiveTo}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
            <DropDowns
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
              label={t("generalMasters.salesPersonOptional")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.selectAgent}
              onChange={(e) =>
                formik.setFieldValue("selectAgent", e.target.value)
              }
              options={selectAgentDataOption}
              optionLabel="value"
              placeholder={"Select"}
            />

            {formik.touched.selectAgent && formik.errors.selectAgent && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.selectAgent}
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
            />
          </div>
        </div>
      </Card>
      <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal"></div>
      <div className=" bottom__view p-2 m-1">
        <div className="  input__view__reversal p-2">
          <div className="add__level__text">
            Add Level Wise Commission Sharing
          </div>
          <div className="col-12 md:col-6 lg:col-6 add__icon__alighn__Journal__Voture ">
            <button type="button" className="add__icon__view__petty bv-add-button" onClick={handlePolicy}>
              <div className="add__icon__petty">
                <SvgAdd color={"#fff"} />
              </div>
              <div className="add__text__petty">{t("generalMasters.add")}</div>
            </button>
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
              className="fieldvalue_container"
            ></Column>
            <Column
              field="commissionCode"
              header="Commission Code"
              className="fieldvalue_container"
            ></Column>
            <Column
              field="sharingRate"
              header="Share Rate"
              className="fieldvalue_container"
            ></Column>
            <Column
              field="quantity"
              header="Action"
              body={renderEditButton}
              style={{
                display: "grid",
                alignItems: "center",
                justifyContent: "center",
              }}
              className="fieldvalue_container"
            ></Column>
          </DataTable>
        </div>
      </div>
      <div className="col-12">
        <AddCommissionPopup visible={visible} setVisible={setVisible} />
      </div>
      <div className="col-12">
        <EditCommissionPopup
          showEditPopup={showEditPopup}
          setShowEditPopup={setShowEditPopup}
        />
      </div>

      <div className="col-12 btn__view__Add">
        <Button
          label={t("generalMasters.update")}
          className="save__add__btn"
          disabled={!formik.isValid}
          onClick={formik.handleSubmit}
        />
      </div>
    </div>
  );
};
export default EditCommission;
