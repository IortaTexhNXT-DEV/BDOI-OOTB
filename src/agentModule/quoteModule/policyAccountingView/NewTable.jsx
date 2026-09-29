import React from "react";
import "./CustomTable.css"; // Add custom styles here if needed

const CustomTable = ({ data }) => {
    return (
        <div className="custom-table">
            <div className="table-header">
                <div className="header-cell">Cust Code</div>
                <div className="header-cell">Main Acc</div>
                <div className="header-cell">Dr/Cr</div>
                <div className="header-cell">Amount</div>
            </div>
            <div className="table-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {data.map((row, index) => (
                    <div className="table-row" key={index}>
                        <div className="row-cell">{row.custCode}</div>
                        <div className="row-cell">{row.mainAcc}</div>
                        <div className="row-cell">{row.drCr}</div>
                        <div className="row-cell">{row.amount}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CustomTable;
