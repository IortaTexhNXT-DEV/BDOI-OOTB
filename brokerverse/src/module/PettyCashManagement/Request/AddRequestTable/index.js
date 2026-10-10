import { useState, useRef } from "react";
import { showSuccessMessage } from "../../../../utility/toastUtils";
import { useTranslation } from "react-i18next";
import { openConfirm } from "../../../../components/ConfirmDialog";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { useFormik } from "formik";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import CustomToast from "../../../../components/Toast";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Column } from "primereact/column";
import InputField from "../../../../components/InputField";
import SvgDelete from "../../../../assets/icons/SvgDeleteIcon";
import { Card } from "primereact/card";
import { useDispatch, useSelector } from "react-redux";
import {
  postAddRequestMiddleware,
  postEditRequestMiddleware,
} from "../store/pettyCashRequestMiddleware";
import { removeRequestLine } from "../store/pettyCashRequestReducer";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";

const initialValue = {
  Narration: "",
  Amount: "",
};

const AddRequestTable = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [show, setshow] = useState(false);
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const toastRefApprove = useRef(null);
  const navigate = useNavigate();

  const { AddRequestTable } = useSelector(
    ({ pettyCashRequestReducer }) => {
      return {
        loading: pettyCashRequestReducer?.loading,
        AddRequestTable: pettyCashRequestReducer?.AddRequestTable,
      };
    }
  );

  const isEmpty = !AddRequestTable?.length;

  const handleapprove = async (actionName) => {
    if (actionName === "approve") {
      const ok = await openConfirm({
        title: t("pettyCash.confirm.submitNewTitle"),
        message: t("pettyCash.confirm.submitMessage"),
        facts: [
          { label: t("pettyCash.confirm.lines"), value: AddRequestTable.length, type: "number" },
          { label: t("pettyCash.totalAmount"), value: totalAmount, type: "amount", emphasis: true },
        ],
        confirmLabel: t("pettyCash.confirm.submit"),
      });
      if (!ok) return;
    }
    const result = await dispatch(
      postAddRequestMiddleware({ submit: actionName === "approve" })
    );
    if (postAddRequestMiddleware.rejected.match(result)) {
      toastRef.current.showToast({ severity: "error", detail: result.payload });
      return;
    }
    if (actionName === "save") {
      showSuccessMessage(t("pettyCash.successfullySaved"));
    } else {
      showSuccessMessage(t("pettyCash.transactionCreated", { number: result.payload.RequestNumber }));
    }
    navigate("/accounts/pettycash/pettycashrequest");
  };
  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("pettyCash.noDataEntered")}</div>
    </div>
  );

  const items = [
    {
      label: t("pettyCash.pettyCashLabel"),
      command: () => navigate("/accounts/pettycash/pettycashrequest"),
    },
    {
      label: t("pettyCash.addRequest"),
      to: "/accounts/pettycash/addrequesttable",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleClick = () => {
    setVisible(true);
  };

  const handleBack = () => {
    navigate("/accounts/pettycash/pettycashrequest");
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

  const validate = (values) => {
    const errors = {};

    if (!values.Narration) {
      errors.Narration = t("pettyCash.narrationRequired");
    }

    if (!values.Amount) {
      errors.Amount = t("pettyCash.amountRequired");
    }
    return errors;
  };

  const handleSave = (value) => {
    const valueWithId = {
      ...value,
      id: AddRequestTable?.length + 1,
    };
    dispatch(postEditRequestMiddleware(valueWithId));
    setVisible(false);
    setshow(true);
    formik.setFieldValue("Narration",);
    formik.setFieldValue("Amount",);
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSave(values);
    },
  });

  const totalAmount = AddRequestTable.reduce(
    (total, item) => total + (parseFloat(item.Amount) || 0),
    0
  );

  const handleDelete = (id) => dispatch(removeRequestLine(id));

  return (
    <div className="add__request__table">

      <CustomToast ref={toastRef} message={t("pettyCash.successfullySaved")} />
      <CustomToast ref={toastRefApprove} />

      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
         
           <div>
          <span onClick={handleBack}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          {t("pettyCash.addRequest")}
          </label>
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
      <Card className="table__container__outer mt-4">
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
                  handleClick();
                }}
              />
            </div>
          </div>
        </div>
        <div className="table__container">
          <DataTable
            value={AddRequestTable}
            tableStyle={{ minWidth: "50rem" }}
            emptyMessage={isEmpty ? emptyTableIcon : null} scrollable={true}
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
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    icon={<SvgDelete />}
                    className="delete__btn"
                    onClick={() => handleDelete(rowData.id)} aria-label="Delete" tooltip="Delete" tooltipOptions={{ position: "top" }} />
                </div>
              )}
            ></Column>
          </DataTable>
        </div>
      </Card>
      {show === true ? (
        <div className="grid mt-4">
          <div className="col-12 md:col-4 lg:col-4">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.totalAmount")}
              placeholder={t("pettyCash.enter")}
              textColor={"#111927"}
              disabled={true}
              textSize={"16"}
              textWeight={500}
              value={totalAmount}
            />
          </div>
        </div>
      ) : null}
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label={t("pettyCash.save")}
              className="add__btn"
              outlined
              onClick={() => {
                handleapprove("save");
              }}
            />
            <Button
              label={t("pettyCash.confirm.submit")}
              className="add__btn"
              onClick={() => {
                handleapprove("approve");
              }}
            />
          </div>
        </div>
      </div>
      <Dialog
        header={t("pettyCash.addRequestItem")}
        visible={visible}
        style={{ width: "50vw" }}
        onHide={() => setVisible(false)}
        dismissableMask={true}
        headerStyle={{
          color: "#343434",
          fontFamily: "Nunito, Arial, sans-serif",
          fontSize: 16,
          fontWeight: 500,
          // lineHeight: "150%",
        }}
        className="dailog__container"
      >

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
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-12 md:col-12 lg:col-12 bt__container">
            <Button
              label={t("pettyCash.save")}
              className="add__btn"
              outlined
              onClick={() => {
                formik.handleSubmit();
              }}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AddRequestTable;
