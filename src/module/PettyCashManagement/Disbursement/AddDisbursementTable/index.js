import React, { useState, useRef, useEffect } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import CustomToast from "../../../../components/Toast";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useFormik } from "formik";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Column } from "primereact/column";
import InputField from "../../../../components/InputField";
import SvgEditIcon from "../../../../assets/icons/SvgEditicons";
import { Card } from "primereact/card";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import DropDowns from "../../../../components/DropDowns";
import { Maincode, SubAccount } from "../../mock";
import { useDispatch, useSelector } from "react-redux";
import { getPatchDisbursementData, postDisbursementData, postEditDisbursmentMiddleware, postPatchDisbursementData } from "../store/pettyCashDisbursementMiddleware";
import { Dropdown } from "primereact/dropdown";
import SvgAdd from "../../../../assets/icons/SvgAdd";

const initialValue = {

  PettycashCode: "",
  RequestNumber: "",
  RequesterName: "",
  SubAc: "",
  ExpenseCode: "",
  Purpose: "",
  Remarks: "",
  Amount: "",
  VAT: "",
  WHT: "",
  NetAmount: "",
  Branchcode: "",
  Departmentcode: "",
  TotalAmount: "",
  Date: "",
};

const AddDisbursementTable = () => {
  const [visible, setVisible] = useState(false);
  const [addvisible, setaddVisible] = useState(false);
  const [moduleData, setModuleData] = useState();
  const [selectedRows, setSelectedRows] = useState([]);
  const [totalAmounts, setTotalAmounts] = useState(0);
  const [formAction, setformAction] = useState(null);
  const [show, setshow] = useState(false);
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const navigate = useNavigate();

  console.log(selectedRows, "selectedRows");
  const { AddDisbursmentTable, loading, getPatchDisbursment } = useSelector(
    ({ pettyCashDisbursementReducers }) => {
      return {
        loading: pettyCashDisbursementReducers?.loading,
        AddDisbursmentTable: pettyCashDisbursementReducers?.AddDisbursmentTable,
        getPatchDisbursment: pettyCashDisbursementReducers?.getPatchDisbursment
      };
    }
  );

  const isEmpty = AddDisbursmentTable.length === 0;

  const [amountData, setAmountData] = useState()
  const [totalNetAmount, setTotalNetAmount] = useState(0);
  useEffect(() => {
    const newTotalNetAmount = selectedRows.reduce((total, item) => {
      const netAmount = parseFloat(item.Amount) + parseFloat(item.VAT) - parseFloat(item.WHT);
      return !isNaN(netAmount) ? total + netAmount : total;
    }, 0);

    setTotalNetAmount(newTotalNetAmount);
  }, [selectedRows]);
  console.log(totalNetAmount, "totalNetAmount");
  const handleNext = () => {

    toastRef.current.showToast();
    {
      setTimeout(() => {
        navigate("/accounts/pettycash/disbursement");
      }, 2000);
    }
  };


  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );

  const items = [
    {
      label: "Petty Cash",
      command: () => navigate("/accounts/pettycash/disbursement"),
    },
    {
      label: "Add Disbursement",
      to: "/accounts/pettycash/adddisbursementtable",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handlehide = () => {
    setVisible(false)
    console.log("first8", formAction)
    // // {formAction === "add" &&  }
    // formik.resetForm()
  }


  const handleBack = () => {
    navigate("/accounts/pettycash/adddisbursement");
  };
  const headaction = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    // padding: "18px 8px",
    // paddingTop:4,
    color: "#000",
    border: " none",
    display: "flex",
    // paddingBottom:"28px",
    // paddingTop:"8px"
  };

  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 8,
    color: "#000",
    border: "none",
    textAlign: "center",
    paddingLeft: 0,
  };
  const handleEdit = (data) => {
    // if (formAction === "Edit") {
    dispatch(getPatchDisbursementData(data))
    // }
    console.log(data, "sata");
    setformAction("Edit");
    setModuleData({ ...data });
    setVisible(true);
  };
  const handleView = () => {
    setformAction("Add");
    setaddVisible(true);
    formik.resetForm()

  };
  const validate = (values) => {
    const errors = {};

    if (!values.MainAccountCode) {
      errors.MainAccountCode = "Main Account Code is required";
    }

    if (!values.RequestNumber) {
      errors.RequestNumber = "Sub Account Code is required";
    }

    return errors;
  };

  const handleSubmit = (value) => {
    // alert("hii")
    console.log(value, "valuevalue");
    if (formAction === "Edit") {
      dispatch(postPatchDisbursementData(value));
      setVisible(false);
      setshow(true);
      formik.resetForm()
    }
    if (formAction === "Add") {
      dispatch(postDisbursementData(formik.values))
      setaddVisible(false);
      setshow(true);
      formik.setFieldValue("Amount",);
      formik.setFieldValue("PettycashCode",);
      formik.setFieldValue("RequestNumber",);
      formik.setFieldValue("SubAc",);
      formik.setFieldValue("ExpenseCode",);
      formik.setFieldValue("Purpose",);
      formik.setFieldValue("Remarks",);
      formik.setFieldValue("VAT",);
      formik.setFieldValue("WHT",);
      formik.setFieldValue("NetAmount",);
      formik.setFieldValue("Branchcode",);
      formik.setFieldValue("Departmentcode",);
      formik.setFieldValue("TotalAmount",);
      formik.setFieldValue("Date",);
    }
  };

  const formik = useFormik({
    initialValues: initialValue,
    onSubmit: handleSubmit
  });

  const handlePettyCashSubAccountCodedecription = (value) => {
    let description = "";
    switch (value.SubAccount) {
      case "Sub1929920":
        description = "SUB-1";
        break;
      case "Sub8299201":
        description = "SUB-2";
        break;
      case "Sub9920010":
        description = "SUB-3";
        break;
      case "Sub1818811":
        description = "SUB-4";
        break;
      default:
        description = "Unknown";
        break;
    }
    formik.setFieldValue("SubAccountDescription", description);
  };

  const handlePettyCashMainAccountDescribtion = (value) => {
    let description = "";
    switch (value.Maincode) {
      case "192992":
        description = "Main-1";
        break;
      case "199191":
        description = "Main-2";
        break;
      case "101019":
        description = "Main-3";
        break;
      case "181929":
        description = "Main-4";
        break;
      default:
        description = "Unknown";
        break;
    }
    formik.setFieldValue("MainAccountDescription", description);
  };


  const item = [
    { label: "PC001", value: "PC001" },
    { label: "PC002", value: "PC002" },
  ]
  const item1 = [
    { label: "123", value: "123" },
    { label: "995", value: "145" }
  ]
  const item2 = [
    { label: "123", value: "123" },
    { label: "954", value: "111" }
  ]
  const [RequestNumberOptionData, setRequestNumberOptionData] = useState([]);
  const [SubAcOptionData, setSubAcOptionData] = useState([]);
  const [ExpenseCodeOptionData, setExpenseCodeOptionData] = useState([]);
  const SetFormikValue = () => {
    const RequestNumberData = getPatchDisbursment?.RequestNumber
    const SubAcData = getPatchDisbursment?.SubAc
    const ExpenseCodeData = getPatchDisbursment?.RequestNumber
    const updatedValues = {
      id: getPatchDisbursment?.id,
      PettycashCode: getPatchDisbursment?.PettycashCode,
      RequestNumber: RequestNumberData,
      RequesterName: getPatchDisbursment?.RequesterName,
      SubAc: SubAcData,
      ExpenseCode: ExpenseCodeData,
      Purpose: getPatchDisbursment?.Purpose,
      Remarks: getPatchDisbursment?.Remarks,
      Amount: getPatchDisbursment?.Amount,
      VAT: getPatchDisbursment?.VAT,
      WHT: getPatchDisbursment?.WHT,
      NetAmount: getPatchDisbursment?.NetAmount,
      Branchcode: getPatchDisbursment?.Branchcode,
      Departmentcode: getPatchDisbursment?.Departmentcode,
      TotalAmount: getPatchDisbursment?.TotalAmount,
      Date: getPatchDisbursment?.Date,

    };
    if (RequestNumberData) {
      setRequestNumberOptionData([{ label: RequestNumberData, value: RequestNumberData }])
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (SubAcData) {
      setSubAcOptionData([{ label: SubAcData, value: SubAcData }])
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (ExpenseCodeData) {
      setExpenseCodeOptionData([{ label: ExpenseCodeData, value: ExpenseCodeData }])
      formik.setValues({ ...formik.values, ...updatedValues });
    }

    formik.setValues({ ...formik.values, ...updatedValues });
  };

  useEffect(() => {
    console.log("first9",formAction)
if(formAction === "Edit" ){
  SetFormikValue();
}
    

  }, [getPatchDisbursment]);

  console.log(AddDisbursmentTable, "RequestList");


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
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              Row count :{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdownunique_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };

  return (
    <div className="add__disbursement__table">
      <CustomToast
        ref={toastRef}
        message="Petty Cash Disbursment Successfully"
      />
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="pettycash__title"
            onClick={() => {
              handleBack();
            }}
          >
            <SvgBackArrow />
            Add Disbursement
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
      <Card>
        <div className="sub__container grid ">
          <div className="sub__container__title col-12">
            <div className="table__top__btn__container">
              <div className="sub__request__title">Request List</div>

              <Button
                label="Add"
                icon={<SvgAdd color={"#fff"} />}
                className="add__btn"
                onClick={() => {
                  handleView();
                }}
              />
            </div>
          </div>
        </div>
        <div className="table__container">
          <DataTable
            value={AddDisbursmentTable}
            tableStyle={{ minWidth: "50rem" }}
            emptyMessage={isEmpty ? emptyTableIcon : null}
            selection={selectedRows}
            onSelectionChange={(e) => setSelectedRows(e.value)}
            selectionMode="checkbox"
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
          >
            <Column
              headerStyle={headaction}
              selectionMode="multiple"
              selectedItem
              style={{ textAlign: "center" }}
            // headerStyle={{ width: "4rem" }}
            ></Column>
            <Column
              field="RequestNumber"
              header="Requested By"
              headerStyle={headerStyle}
              sortable
            ></Column>
            <Column
              field="ExpenseCode"
              header="Expense Code"
              headerStyle={headerStyle}
              sortable
            ></Column>

            <Column
              field="SubAc"
              header="Sub Ac"
              headerStyle={headerStyle}
            ></Column>
            <Column
              field="Purpose"
              header="Purpose"
              headerStyle={headerStyle}
            ></Column>
            <Column
              field="Remarks"
              header="Remarks"
              headerStyle={headerStyle}
              sortable
            ></Column>
            <Column
              field="Amount"
              header="Amount"
              headerStyle={headerStyle}
              sortable
            ></Column>

            <Column field="VAT" header="VAT" headerStyle={headerStyle}></Column>
            <Column
              field="WHT"
              header="WHT"
              headerStyle={headerStyle}

            ></Column>
            <Column
              header="Net Amount"
              headerStyle={headerStyle}
              body={(rowData) => (
                <span>{parseFloat(rowData.Amount) + parseFloat(rowData.VAT) - parseFloat(rowData.WHT)}</span>
              )}
            ></Column>

            <Column
              field="Action"
              header="Action"
              headerStyle={headaction}
              style={{ textAlign: "center" }}
              body={(rowData) => (
                <Button
                  icon={<SvgEditIcon />}
                  className="delete__btn"
                  onClick={() => handleEdit(rowData)}
                />
              )}
            ></Column>
          </DataTable>
        </div>
      </Card>
      <div className="grid mt-4">
        <div className="col-12 md:col-4 lg:col-4">
          <InputField
            classNames="input__filed"
            label="Total"
            // placeholder="Enter"
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={totalNetAmount}
          />
        </div>
      </div>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label="Approve"
              className="add__btn"
              onClick={() => {
                handleNext();
              }}
            />
          </div>
        </div>
      </div>

      <Dialog
        header={`${formAction} Disbursement`}
        visible={visible}
        style={{ width: "40vw" }}
        // onHide={() => setVisible(false)}
        onHide={() => handlehide()}
        headerStyle={{
          color: "#343434",
          fontFamily: "Inter, sans-serif",
          fontSize: "24px",
          fontWeight: "600",
          lineHeight: "150%",
        }}
        className="dailog__container"
      >
        <div>
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <DropDowns
                className="input__filed"
                label="Requested By"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // value={formAction === "Add" ? formik.values.RequestNumber : formAction === "Edit" && formik.values.RequestNumber}
                options={formAction === "Edit" ? RequestNumberOptionData : item

                }
                value={formik.values.RequestNumber}
                disabled={formAction === "Edit" ? true : false}
                onChange={(e) => {
                  formik.setFieldValue("RequestNumber", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.RequestNumber && formik.errors.RequestNumber
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <DropDowns
                className="input__filed"
                label="Expense Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // value={formAction === "Add" ? formik.values.ExpenseCode : formAction === "Edit" && formik.values.ExpenseCode}
                options={
                  formAction === "Edit" ? ExpenseCodeOptionData : item1}
                  value={formik.values.ExpenseCode}
                onChange={(e) => {
                  formik.setFieldValue("ExpenseCode", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.ExpenseCode && formik.errors.ExpenseCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <DropDowns
                className="input__filed"
                label="Sub Account"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // value={formAction === "Add" ? formik.values.SubAc : formAction === "Edit" && formik.values.SubAc}
                options={formAction === "Edit" ? SubAcOptionData : item2}
                value={formik.values.SubAc}
                onChange={(e) => {
                  formik.setFieldValue("SubAc", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.SubAc && formik.errors.SubAc
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="input__filed"
                label="Purpose"
                // disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? formik.values.Purpose : formAction === "Edit" && formik.values.Purpose}
                onChange={formik.handleChange("Purpose")}
                disabled={formAction === "Edit" ? true : false}
                placeholder="Enter"
              value={formik.values.Purpose}
              />
            </div>
            <div className="col-12 ">
              <InputField
                classNames="input__filed"
                label="Remarks"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? formik.values.Remarks : formAction === "Edit" && formik.values.Remarks}
                onChange={formik.handleChange("Remarks")}
                value={formik.values.Remarks}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="VAT"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? formik.values.VAT : formAction === "Edit" && formik.values.VAT}
                onChange={formik.handleChange("VAT")}
                value={formik.values.VAT}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="WHT"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? formik.values.WHT : formAction === "Edit" && formik.values.WHT}
                onChange={formik.handleChange("WHT")}
                value={formik.values.WHT}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="Amount"
                // placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? "" : formAction === "Edit" && formik.values.Amount}
                value={formik.values.Amount}
                onChange={formik.handleChange("Amount")}
                placeholder="Enter"
                disabled={formAction === "Edit" ? true : false}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="Net Amount"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? "" : formAction === "Edit" && formik.values.NetAmount}
                onChange={formik.handleChange("NetAmount")}
                value={formik.values.NetAmount}
              />
            </div>
          </div>
        </div>
        <div className="grid">
          <div className="col-12 md:col-12 lg:col-12 bt__container">
            <Button
              label={formAction === "Edit" ? "Update" : "Add"}
              className="add__btn"
              onClick={formik.handleSubmit}
            />
          </div>
        </div>
      </Dialog>



      {/* add */}

      <Dialog
        header={`${formAction} Disbursement`}
        visible={addvisible}
        style={{ width: "40vw" }}
        onHide={() => setaddVisible(false)}

        headerStyle={{
          color: "#343434",
          fontFamily: "Inter, sans-serif",
          fontSize: "24px",
          fontWeight: "600",
          lineHeight: "150%",
        }}
        className="dailog__container"
      >
        <div>
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <DropDowns
                className="input__filed"
                label="Requested By"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // value={formAction === "Add" ? formik.values.RequestNumber : formAction === "Edit" && formik.values.RequestNumber}
                options={formAction === "Edit" ? RequestNumberOptionData : item

                }
                value={formik.values.RequestNumber}
                disabled={formAction === "Edit" ? true : false}
                onChange={(e) => {
                  formik.setFieldValue("RequestNumber", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.RequestNumber && formik.errors.RequestNumber
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <DropDowns
                className="input__filed"
                label="Expense Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formAction === "Add" ? formik.values.ExpenseCode : formAction === "Edit" && formik.values.ExpenseCode}
                options={
                  formAction === "Edit" ? ExpenseCodeOptionData : item1}
                onChange={(e) => {
                  formik.setFieldValue("ExpenseCode", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.ExpenseCode && formik.errors.ExpenseCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <DropDowns
                className="input__filed"
                label="Sub Account"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formAction === "Add" ? formik.values.SubAc : formAction === "Edit" && formik.values.SubAc}
                options={formAction === "Edit" ? SubAcOptionData : item2}
                onChange={(e) => {
                  formik.setFieldValue("SubAc", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.SubAc && formik.errors.SubAc
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="input__filed"
                label="Purpose"
                // disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? formik.values.Purpose : formAction === "Edit" && formik.values.Purpose}
                onChange={formik.handleChange("Purpose")}
                disabled={formAction === "Edit" ? true : false}
                placeholder="Enter"
              // value={formik.values.RequestNumber}
              />
            </div>
            <div className="col-12 ">
              <InputField
                classNames="input__filed"
                label="Remarks"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? formik.values.Remarks : formAction === "Edit" && formik.values.Remarks}
                onChange={formik.handleChange("Remarks")}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="VAT"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formAction === "Add" ? formik.values.VAT : formAction === "Edit" && formik.values.VAT}
                onChange={formik.handleChange("VAT")}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="WHT"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formAction === "Add" ? formik.values.WHT : formAction === "Edit" && formik.values.WHT}
                onChange={formik.handleChange("WHT")}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="Amount"
                // placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formAction === "Add" ? "" : formAction === "Edit" && formik.values.Amount}
                value={formik.values.Amount}
                onChange={formik.handleChange("Amount")}
                placeholder="Enter"
                disabled={formAction === "Edit" ? true : false}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                classNames="input__filed"
                label="Net Amount"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formAction === "Add" ? "" : formAction === "Edit" && formik.values.NetAmount}
                onChange={formik.handleChange("NetAmount")}
              />
            </div>
          </div>
        </div>
        <div className="grid">
          <div className="col-12 md:col-12 lg:col-12 bt__container">
            <Button
              label={formAction === "Edit" ? "Update" : "Add"}
              className="add__btn"
              onClick={formik.handleSubmit}
            />
          </div>
        </div>
      </Dialog>

    </div>
  );
};

export default AddDisbursementTable;
