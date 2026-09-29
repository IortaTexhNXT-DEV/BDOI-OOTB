import React, { useState, useRef } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import CustomToast from "../../../../components/Toast";
import SvgTable from "../../../../assets/icons/SvgTable";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import InputField from "../../../../components/InputField";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { useSelector } from "react-redux";

const AddReplenishTable = () => {
  const [visible, setVisible] = useState(false);
  const [totalAmounts, setTotalAmounts] = useState(0);
  const toastRef = useRef(null);
  const navigate = useNavigate();

  const [selectedRows, setSelectedRows] = useState([]);
  const { AddReplenishTable, loading } = useSelector(
    ({ pettyCashReplenishReducer }) => {
      return {
        loading: pettyCashReplenishReducer?.loading,
        AddReplenishTable: pettyCashReplenishReducer?.AddReplenishTable,
      };
    }
  );

  const isEmpty = AddReplenishTable.length === 0;
  console.log(AddReplenishTable.Transactioncode, "AddReceiptTable");
  const totalAmount = selectedRows.reduce((total, item) => {
    const Amount = parseFloat(item.Amount);
    return !isNaN(Amount) ? total + Amount : total;
  }, 0);
  console.log(totalAmount, "totalAmount");
  const handleSubmit = () => {
    toastRef.current.showToast();
    {
      setTimeout(() => {
        navigate("/accounts/pettycash/replenish");
      }, 2000);
    }
  };
  const [selectedProducts, setSelectedProducts] = useState([]);
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );

  const items = [
    {
      label: "Petty Cash",
      command: () => navigate("/accounts/pettycash/replenish"),
    },
    {
      label: "Add Replenish",
      to: "/accounts/pettycash/addreceiptstable",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handleClick = (rowData) => {
    setVisible(true);
    const clickedAmount = parseInt(rowData.Amount);
    setTotalAmounts((prevTotalAmounts) => prevTotalAmounts + clickedAmount);
  };

  const handleBack = () => {
    navigate("/accounts/pettycash/addreplenish");
  };

  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
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
    <div className="add__replenish__table">
      <CustomToast ref={toastRef} message="Petty Cash Replenish Successfully" />
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="pettycash__title"
            onClick={() => {
              handleBack();
            }}
          >
            <SvgBackArrow />
            Add Replenish
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
          <div className="sub__container__title col-12 md:col-12 lg:col-6 mb-2">
            <div className="sub__request__title">Replenish list</div>
          </div>
        </div>
        <div className="table__container">
          <DataTable
            value={AddReplenishTable}
            tableStyle={{ minWidth: "50rem" }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            selectionMode="checkbox"
            emptyMessage={isEmpty ? emptyTableIcon : null}
            selection={selectedRows}
            onSelectionChange={(e) => setSelectedRows(e.value)}

            // rowClassName={(rowData) => getStatusClassName(rowData.status)}
          >
            <Column
              selectionMode="multiple"
              selectedItem
              className="multipleicon_container"
              headerStyle={{ width: "4rem", paddingLeft: 10 }}
            ></Column>
            <Column
              field="Transactioncode"
              header="Transaction Code"
              headerStyle={headerStyle}
            ></Column>
            <Column
              field="DocNumber"
              header="Disbursement Doc Number"
              headerStyle={headerStyle}
            ></Column>

            <Column
              field="Narration"
              header="Narration"
              headerStyle={headerStyle}
            ></Column>

            <Column
              field="Date"
              header="Date"
              headerStyle={headerStyle}
              sortable
            ></Column>
            <Column
              field="Remarks"
              header="Remarks"
              headerStyle={headerStyle}
            ></Column>
            <Column
              field="Amount"
              header="Amount"
              headerStyle={headerStyle}
              sortable
            ></Column>
          </DataTable>
        </div>
      </Card>
      <div className="grid mt-4">
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label="Disbursed Amount"
            // placeholder="Enter"
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={totalAmount}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label="Reimbursement Amount"
            // placeholder="Enter"
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={totalAmount}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label="Current balance"
            // placeholder="Enter"
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={"1000"}
          />
        </div>
      </div>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label="Approve"
              className="add__btn"
              disabled={selectedRows.length === 0}
              onClick={() => {
                handleSubmit();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddReplenishTable;
