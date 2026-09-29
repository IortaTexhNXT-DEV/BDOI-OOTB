import React, { useState } from "react";
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
import { useDispatch, useSelector } from "react-redux";
import { postAddTransactionCodeSetup } from "../../../store/transactionCodeMasterMiddleware";

const TransactionCodeSetupTable = () => {
  const { TransactioncodeListsearch, TransactionCodeSetup, loading } = useSelector(({ transactionCodeMasterReducer }) => {
    return {
      loading: transactionCodeMasterReducer?.loading,
      TransactionCodeSetup: transactionCodeMasterReducer?.TransactionCodeSetup,


    };
  });
  console.log(TransactionCodeSetup, "TransactionCodeSetup")
  const [products, setProducts] = useState([]);
  const [show, setShow] = useState(false);

  const initialValues = {
    AccountingPeriodStart: new Date(),
    AccountingPeriodEnd: new Date(),
    TransactionNumberFrom: "",
    TransactionNumberTo: "",
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
      <div className="no__data__found">No data entered</div>
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
        <div className="paginator__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{
                color: "var(--text-color)",
                userSelect: "none",
                width: "127%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
              }}
            >
              Row count :{" "}
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

  const dispatch=useDispatch()

  const handleSubmit = (values) => {
    dispatch(postAddTransactionCodeSetup(formik.values))
    setShow(false)
  }

  const handleView = (rowData) => {
    console.log("View clicked:", rowData);
    // navigate("/accounts/pettycash/PettyCashCodeDetails")
  };
  const headerStyle = {
    fontSize: 16,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.TransactionNumberFrom) {
      errors.TransactionNumberFrom = "This field Code is required";
    }
    if (!values.TransactionNumberTo) {
      errors.TransactionNumberTo = "This field is required";
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


  return (
    <div className="transactioncode__master__table_edit">
      {/* <Card className="mt-1"> */}
      <div className="card">
        <div className="col-12 md:col-12 lg-col-12 ">
          <div className="btn__container__add">
            <Button
              label="Add"
              icon={<SvgAdd color={"#fff"} />}
              className="add__btn"
              onClick={() => {
                handleClick();
              }}
            />
          </div>
        </div>
        <DataTable
          value={TransactionCodeSetup}
          tableStyle={{
            minWidth: "50rem",
            color: "#1C2536",
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
            field="AccountingPeriodStart"
            header="Accounting Period start"
            headerStyle={headerStyle}
            className="fieldvalue_container"
            
          ></Column>
          <Column
            field="AccountingPeriodEnd"
            header="Accounting Period End"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          //   sortable
          ></Column>
          <Column
            field="TransactionNumberFrom"
            header="Transaction No from"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          //   sortable
          ></Column>
          <Column
            field="TransactionNumberTo"
            header="Transaction No To"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="lastUsed"
            header="Last Used"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
        </DataTable>
      </div>
      <Dialog
        header="Add Transaction code Setup"
        visible={show}
        style={{ width: "50vw" }}
        onHide={() => setShow(false)}
      >
        <div className="grid mt-1">
          <div className="calender__container col-12 md:col-6 lg-col-6 ">
            <LabelWrapper className="calenderlable__container">
              Accounting Period Start
            </LabelWrapper>
            <Calendar
              showIcon
              // placeholder="Select"

              className="calendar_container"
              value={formik.values.AccountingPeriodStart}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("AccountingPeriodStart", e.target.value);
              }}
              dateFormat="yy-mm-dd"
              error={formik.errors.AccountingPeriodStart}
            />
          </div>
          <div className="calender__container col-12 md:col-6 lg-col-6 ">
            <LabelWrapper className="calenderlable__container">
              Accounting Period End
            </LabelWrapper>
            <Calendar
              className="calendar_container"
              showIcon
              placeholder="Select"
              value={formik.values.AccountingPeriodEnd}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("AccountingPeriodEnd", e.target.value);
              }}
              dateFormat="yy-mm-dd"
              error={formik.errors.AccountingPeriodEnd}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg-col-6 ">
            <InputField
              classNames="input__filed"
              label="Transaction Number From"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.TransactionNumberFrom}
              onChange={formik.handleChange("TransactionNumberFrom")}
              error={
                formik.touched.TransactionNumberFrom &&
                formik.errors.TransactionNumberFrom
              }
            />

          </div>
          <div className="col-12 md:col-6 lg-col-6 ">
            <InputField
              classNames="input__filed"
              label="Transaction Number To"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.TransactionNumberTo}
              onChange={formik.handleChange("TransactionNumberTo")}
              error={
                formik.touched.TransactionNumberTo &&
                formik.errors.TransactionNumberTo
              }
            />
          </div>
        </div>
        <div className="btn__container">
          <Button
            label="Save"
            className="add__btn"
            // onClick={() => {
            //   handleSave();
            // }}
            onClick={() => { formik.handleSubmit(); }}
          />
        </div>
      </Dialog>
      {/* </Card> */}
    </div>
  );
};

export default TransactionCodeSetupTable;
