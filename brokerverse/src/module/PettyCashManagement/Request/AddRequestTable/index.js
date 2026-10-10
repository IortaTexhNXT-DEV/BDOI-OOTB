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
import { Card } from "primereact/card";
import { useDispatch, useSelector } from "react-redux";
import {
  postAddRequestMiddleware,
  postEditRequestMiddleware,
} from "../store/pettyCashRequestMiddleware";
import { removeRequestLine } from "../store/pettyCashRequestReducer";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { optionCode } from "../../pettyCashFormat";

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

  const { formatCurrency } = useFormatCurrency();
  const { AddRequestTable, RequestDraft } = useSelector(
    ({ pettyCashRequestReducer }) => {
      return {
        loading: pettyCashRequestReducer?.loading,
        AddRequestTable: pettyCashRequestReducer?.AddRequestTable,
        RequestDraft: pettyCashRequestReducer?.RequestDraft,
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
          { label: t("pettyCash.requester"), value: RequestDraft?.RequesterName?.label || RequestDraft?.RequesterName?.name || RequestDraft?.RequesterName },
          { label: t("pettyCash.pettyCashCode"), value: optionCode(RequestDraft?.PettyCashCode) },
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

    if (!(Number(values.Amount) > 0)) {
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
    formik.resetForm();
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
              body={(rowData) => formatCurrency(rowData.Amount)}
              bodyClassName="bv-num"
              headerClassName="bv-num"
            ></Column>
            <Column
              header={t("pettyCash.action")}
              className="bv-actions"
              style={{ width: "6rem" }}
              body={(rowData) => (
                <Button icon="pi pi-trash" text severity="danger" onClick={() => handleDelete(rowData.id)}
                  aria-label={t("pettyCash.removeLine")} tooltip={t("pettyCash.removeLine")} tooltipOptions={{ position: "top" }} />
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
              disabled={true}
              value={formatCurrency(totalAmount)}
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
        style={{ width: "min(640px, 96vw)" }}
        onHide={() => setVisible(false)}
        className="bv-centered"
        draggable={false}
        footer={(
          <>
            <Button type="button" label={t("pettyCash.cancel")} text onClick={() => { setVisible(false); formik.resetForm(); }} />
            <Button type="button" label={t("pettyCash.addItem")} icon="pi pi-plus" onClick={() => formik.handleSubmit()} />
          </>
        )}
      >
        <div className="grid">
          <div className="col-12 md:col-8">
            <InputField
              classNames="fielduniqueone__container"
              label={t("pettyCash.narration")}
              required
              value={formik.values.Narration}
              onChange={formik.handleChange("Narration")}
              error={formik.touched.Narration && formik.errors.Narration}
            />
          </div>
          <div className="col-12 md:col-4">
            <InputField
              classNames="fielduniqueone__container"
              label={t("pettyCash.amount")}
              type="number"
              required
              value={formik.values.Amount}
              onChange={formik.handleChange("Amount")}
              error={formik.touched.Amount && formik.errors.Amount}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AddRequestTable;
