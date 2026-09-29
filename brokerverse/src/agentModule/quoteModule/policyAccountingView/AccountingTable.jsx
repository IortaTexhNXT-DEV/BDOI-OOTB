import { useState } from "react";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useNavigate } from "react-router-dom";
import './index.scss'
// Import PrimeReact styles
const AccountingTable = ({ type }) => {
    const { formatCurrency } = useFormatCurrency();
    const navigate = useNavigate()
    const data = [
        { custCode: "CUST-001", mainAcc: "Premium Receivable", drCr: "Dr", amount: 100000, "docDt": "1-Jan-25", "dueDt": "1-Jan-25", },
        { custCode: "SGUARD", mainAcc: "Premium Payable", drCr: "Cr", amount: 36000, "docDt": "1-Jan-25", "dueDt": "1-Jan-25", },
        { custCode: "CO-INS-1", mainAcc: "Premium Payable", drCr: "Cr", amount: 18000, "docDt": "1-Jan-25", "dueDt": "1-Jan-25", },
        { custCode: "CO-INS-2", mainAcc: "Premium Payable", drCr: "Cr", amount: 27000, "docDt": "1-Jan-25", "dueDt": "1-Jan-25", },
        { custCode: "CO-INS-3", mainAcc: "Premium Payable", drCr: "Cr", amount: 9000, "docDt": "1-Jan-25", "dueDt": "1-Jan-25", },
        { custCode: "BROK-001", mainAcc: "Commition Income", drCr: "Cr", amount: 10000, "docDt": "1-Jan-25", "dueDt": "1-Jan-25", },
    ];
    const data1 = [
        { "custCode": "CUST-001", "docDt": "1-Jan-25", "dueDt": "1-Jan-25", "mainAcc": "Premium Receivable", "drCr": "Dr", "amount": 29000 },
        { "custCode": "CUST-001", "docDt": "1-Jan-25", "dueDt": "1-Apr-25", "mainAcc": "Premium Receivable", "drCr": "Dr", "amount": 29000 },
        { "custCode": "CUST-001", "docDt": "1-Jan-25", "dueDt": "1-Jul-25", "mainAcc": "Premium Receivable", "drCr": "Dr", "amount": 29000 },
        { "custCode": "CUST-001", "docDt": "1-Jan-25", "dueDt": "1-Oct-25", "mainAcc": "Premium Receivable", "drCr": "Dr", "amount": 29000 },
        { "custCode": "SGUARD", "docDt": "1-Jan-25", "dueDt": "1-Jan-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 10440 },
        { "custCode": "CO-INS-1", "docDt": "1-Jan-25", "dueDt": "1-Jan-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 5220 },
        { "custCode": "CO-INS-2", "docDt": "1-Jan-25", "dueDt": "1-Jan-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 7830 },
        { "custCode": "CO-INS-3", "docDt": "1-Jan-25", "dueDt": "1-Jan-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 2610 },
        { "custCode": "SGUARD", "docDt": "1-Jan-25", "dueDt": "1-Apr-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 10440 },
        { "custCode": "CO-INS-1", "docDt": "1-Jan-25", "dueDt": "1-Apr-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 5220 },
        { "custCode": "CO-INS-2", "docDt": "1-Jan-25", "dueDt": "1-Apr-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 7830 },
        { "custCode": "CO-INS-3", "docDt": "1-Jan-25", "dueDt": "1-Apr-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 2610 },
        { "custCode": "SGUARD", "docDt": "1-Jan-25", "dueDt": "1-Jul-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 10440 },
        { "custCode": "CO-INS-1", "docDt": "1-Jan-25", "dueDt": "1-Jul-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 5220 },
        { "custCode": "CO-INS-2", "docDt": "1-Jan-25", "dueDt": "1-Jul-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 7830 },
        { "custCode": "CO-INS-3", "docDt": "1-Jan-25", "dueDt": "1-Jul-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 2610 },
        { "custCode": "SGUARD", "docDt": "1-Jan-25", "dueDt": "1-Oct-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 10440 },
        { "custCode": "CO-INS-1", "docDt": "1-Jan-25", "dueDt": "1-Oct-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 5220 },
        { "custCode": "CO-INS-2", "docDt": "1-Jan-25", "dueDt": "1-Oct-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 7830 },
        { "custCode": "CO-INS-3", "docDt": "1-Jan-25", "dueDt": "1-Oct-25", "mainAcc": "Premium Payable", "drCr": "Cr", "amount": 2610 },
        { "custCode": "BROK-001", "docDt": "1-Jan-25", "dueDt": "1-Jan-25", "mainAcc": "Comm Income", "drCr": "Cr", "amount": 2900 },
        { "custCode": "BROK-001", "docDt": "1-Jan-25", "dueDt": "1-Apr-25", "mainAcc": "Comm Income", "drCr": "Cr", "amount": 2900 },
        { "custCode": "BROK-001", "docDt": "1-Jan-25", "dueDt": "1-Jul-25", "mainAcc": "Comm Income", "drCr": "Cr", "amount": 2900 },
        { "custCode": "BROK-001", "docDt": "1-Jan-25", "dueDt": "1-Oct-25", "mainAcc": "Comm Income", "drCr": "Cr", "amount": 2900 }
    ]

    const headerStyle = {
        textalign: "center",
        fontSize: 16,
        fontFamily: "Nunito, Arial, sans-serif",
        fontWeight: 500,
        color: "#000",
        border: "none",
    };

    const [selectionMode] = useState("multiple");

    const [selectedProducts] = useState([]);
    const handleEdit = (rowData) => {
        navigate("/agent/leadedit");
    };

    const renderName = (rowData) => {
        return (

            <div className="name__text">{rowData.custCode}</div>
        );
    };
    const renderAmount = (rowData) => {
        return (
            <div className="name__box__container">

                <div className="name__text">{formatCurrency(rowData.amount)}</div>
            </div>
        );
    };
    const rendercheckedHeader = (value) => {
        return selectedProducts.length === 0 ? (
            value
        ) : selectedProducts.length === 1 ? (
            <div className="header__btn__container">
                <div className="header__delete__btn">Delete</div>
                <div className="header__edit__btn" onClick={() => handleEdit("1")}>
                    Edit
                </div>
            </div>
        ) : (
            <div className="header__delete__btn">Delete</div>
        );
    };

    const renderUncheckedHeader = (value) => {
        return selectedProducts.length == 0 && value;
    };

    return (
        <div className="lead__table__container">
            <DataTable
                value={type == "Quarterly" ? data1 : data}
                // paginator
                rows={5}
                style={{
                    textAlign: "left",
                    border: "1px solid #e5e7eb",
                    borderWidth: "0 0 1px 0",
                    padding: "0"
                }}
                selectionMode={selectionMode}
                rowsPerPageOptions={[5, 10, 25, 50]}
                currentPageReportTemplate="{first} - {last} of {totalRecords}"
                className="corrections__table__main"
                dataKey="id"
                scrollable={true}
                scrollHeight="80vh"
                tableStyle={{ minWidth: "50rem" }}
            >
                <Column
                    body={renderName}
                    header={rendercheckedHeader("Code")}
                    headerStyle={headerStyle}
                ></Column>
                <Column
                    field="docDt"
                    header={renderUncheckedHeader("Document Date")}
                    headerStyle={headerStyle}
                ></Column>

                <Column
                    field="dueDt"
                    header={renderUncheckedHeader("Due Date")}
                    headerStyle={headerStyle}
                ></Column>

                <Column
                    field="mainAcc"
                    header={renderUncheckedHeader("Main Account")}
                    headerStyle={headerStyle}
                ></Column>
                <Column
                    field="drCr"
                    header={renderUncheckedHeader("Dr/Cr")}
                    headerStyle={headerStyle}
                    // sortable
                    sortField="dateSortField"
                ></Column>

                <Column
                    body={renderAmount}
                    header={renderUncheckedHeader("Amount")}
                    headerStyle={headerStyle}
                ></Column>

            </DataTable>
        </div>
    );
};

export default AccountingTable;
