import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import { Card } from "primereact/card";
import InputField from "../../../../components/InputField";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import usePettyCashOptions from "../../usePettyCashOptions";
import { useDispatch } from "react-redux";
import { setRequestDraft } from "../store/pettyCashRequestReducer";
import { Calendar } from "primereact/calendar";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgDeleteIcon from "../../../../assets/icons/SvgDeleteIcon";
import { Dialog } from "primereact/dialog";
import { Checkbox } from "primereact/checkbox";
import { calendarDateFormat } from "../../../../utility/dateFormat";

const initialValue = {
  Date: new Date(),
  TransactionCode: "",
  TransactionNumber: "",
  RequestDate: new Date(),
  RequesterName: "",
  PettyCashCode: "",
};
const RequestForm = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  const { funds, requesters } = usePettyCashOptions();
  const handleSubmit = (values) => {
    dispatch(setRequestDraft(values));
    navigate("/accounts/pettycash/addrequesttable");
  };
  const validate = (values) => {
    let errors = {};

    if (!values.RequesterName) {
      errors.RequesterName = t("pettyCash.transactionNumberRequired");
    }
    if (!values.PettyCashCode) {
      errors.PettyCashCode = t("pettyCash.pettyCashCodeRequiredMsg");
    }

    return errors;
  };
  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
    textAlign: "center",
  };

  const items = [
    {
      label: t("pettyCash.pettyCashLabel"),
      command: () => navigate("/accounts/pettycash/pettycashrequest"),
    },
    {
      label: t("pettyCash.addRequest"),
      to: "/accounts/pettycash/addrequest",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };
  const [visible, setVisible] = useState(false);
  const handleClick = () => {
    navigate("/accounts/pettycash/pettycashrequest");
  };

  const handleAddClick = () => {
    setVisible(true);
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  return (
    <div className="request__form">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="pettycash__title"
            onClick={() => {
              handleClick();
            }}
          >
            <SvgBackArrow />
            {action === "view"
              ? t("pettyCash.requestView")
              : action === "edit"
                ? t("pettyCash.editPettyCashRequest")
                : t("pettyCash.addRequest")}
          </div>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
      </div>

      <form onSubmit={formik.handleSubmit}>
        <Card className="mt-4">
          <div className="grid mt-1">
            <div class="col-12 md:col-6 lg:col-3">
              <label className="labelfield_container">{t("pettyCash.date")}</label>
              <Calendar
                showIcon

                className="calendar_container"
                value={formik.values.Date}
                onChange={(e) => {
                  formik.setFieldValue("Date", e.target.value);
                }}
                dateFormat={calendarDateFormat()}
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <InputField
                classNames="input__filed"
                label={t("pettyCash.transactionCode")}
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <InputField
                classNames="input__filed"
                label={t("pettyCash.transactionNumber")}
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.TransactionNumber}
                onChange={formik.handleChange("TransactionNumber")}
                error={
                  formik.touched.TransactionNumber &&
                  formik.errors.TransactionNumber
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <label className="labelfield_container">{t("pettyCash.requestDate")}</label>
              <Calendar
                showIcon

                className="calendar_container"
                value={formik.values.RequestDate}
                onChange={(e) => {
                  formik.setFieldValue("RequestDate", e.target.value);
                }}
                dateFormat={calendarDateFormat()}
              />
            </div>

            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.requesterName")}
                placeholder={t("pettyCash.select")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.RequesterName}
                options={requesters}
                onChange={(e) => {
                  formik.setFieldValue("RequesterName", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.RequesterName && formik.errors.RequesterName
                }
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.pettyCashCode")}
                placeholder={t("pettyCash.select")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.PettyCashCode}
                options={funds}
                onChange={(e) => {
                  formik.setFieldValue("PettyCashCode", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.PettyCashCode && formik.errors.PettyCashCode
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 input__view">
              <div className="flex checkbox__container">
                <Checkbox
                  onChange={(e) => setChecked(e.checked)}
                  checked={checked}
                ></Checkbox>
                <label className="labelfield_container">{t("pettyCash.cashInAdvance")}</label>
              </div>
            </div>
          </div>
        </Card>
      </form>

      {action === "edit" || action === "view" ? (
        <>
          <Card className="mt-6">
            <div className="sub__container grid ">
              <div className="sub__container__title col-12 md:col-6 lg:col-6">
                <div className="sub__request__title">{t("pettyCash.requestList")}</div>
              </div>
              <div className="col-12 md:col-6 lg:col-6">
                <div className="btn__container">
                  <Button
                    label={t("pettyCash.add")}
                    icon={<SvgAdd color={"#fff"} />}
                    className="add__btn"
                    onClick={() => {
                      handleAddClick();
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="table__container">
              <DataTable
                tableStyle={{ minWidth: "50rem" }}
                scrollable={true}
                scrollHeight="40vh"
              >
                <Column
                  field="Narration"
                  header={t("pettyCash.narration")}
                  headerStyle={headerStyle}
                  sortable
                ></Column>
                <Column
                  field="Amount"
                  header={t("pettyCash.amount")}
                  headerStyle={headerStyle}
                  sortable
                ></Column>
                <Column
                  field="Action"
                  header={t("pettyCash.action")}
                  headerStyle={{
                    ...headerStyle,
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                  body={(rowData) => (
                    <div
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <Button
                        icon={<SvgDeleteIcon />}
                        className="delete__btn"
                      />
                    </div>
                  )}
                ></Column>
              </DataTable>
            </div>
          </Card>
          <div className="grid mt-4">
            <div className="col-12 md:col-3 lg-col-3 ">
              <InputField
                classNames="input__filed"
                label={t("pettyCash.totalAmount")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
              />
            </div>
          </div>
        </>
      ) : null}

      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label={t("pettyCash.next")}
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
              disabled={!formik.isValid}
            />
          </div>
        </div>
      </div>

      <Dialog
        header={t("pettyCash.addRequestItem")}
        visible={visible}
        style={{ width: "50vw" }}
        onHide={() => setVisible(false)}
        headerStyle={{
          color: "#343434",
          fontFamily: "Nunito, Arial, sans-serif",
          fontSize: 16,
          fontWeight: 500,
          // lineHeight: "150%",
        }}
        className="dailog__container"
      >
        <form onSubmit={formik.handleSubmit}>
          <div className="grid">
            <div className="col-12 md:col-8 lg:col-8">
              <InputField
                classNames="fielduniqueone__container"
                label={t("pettyCash.narration")}
                placeholder={t("pettyCash.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.Narration}
                onChange={formik.handleChange("Narration")}
                error={formik.touched.Narration && formik.errors.Narration}
              />
            </div>
            <div className="col-12 md:col-4 lg:col-4">
              <InputField
                classNames="fielduniqueone__container"
                label={t("pettyCash.amount")}
                placeholder={t("pettyCash.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.Amount}
                onChange={formik.handleChange("Amount")}
                error={formik.touched.Amount && formik.errors.Amount}
              />
            </div>
          </div>
        </form>
        <div className="grid">
          <div className="col-12 md:col-12 lg:col-12 bt__container">
            <Button
              label={t("pettyCash.save")}
              className="add__btn"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default RequestForm;
