import React from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { useLocation, useNavigate } from "react-router-dom";
import AccountingTable from "./AccountingTable";
import CustomTable from "./NewTable";
import data from './AccountingTable';

const PolicyAccountingView = ({ action }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { state } = useLocation();
    const handleClientViewNavigation = () => {
        navigate(`/agent/clientview/${123}`);
    };

    return (
        <div className="policy__details__view__container">
            <div className="policy__details__view__container__title">{t("policyAccounting.clients")}</div>
            <div
                className="policy__details__view__back__btn__container mt-3 cursor-pointer"
                onClick={handleClientViewNavigation}
            >
                <SvgLeftArrow />
                <div className="policy__details__view__back__btn__container__title">
                    Carson Darrin / {t("policyAccounting.clientIdLabel")} : 12345678
                </div>
            </div>
            {/* <CustomTable data={[
                { custCode: "CUST-001", mainAcc: "Premium Receivable", drCr: "Dr", amount: 100000 },
                { custCode: "SGUARD", mainAcc: "Premium Payable", drCr: "Cr", amount: 36000 },
                { custCode: "CO-INS-1", mainAcc: "Premium Payable", drCr: "Cr", amount: 18000 },
                { custCode: "CO-INS-2", mainAcc: "Premium Payable", drCr: "Cr", amount: 27000 },
                { custCode: "CO-INS-3", mainAcc: "Premium Payable", drCr: "Cr", amount: 9000 },
                { custCode: "BROK-001", mainAcc: "Comm Income", drCr: "Cr", amount: 10000 },
            ]} /> */}
            <AccountingTable type={state?.installmentType} />
        </div>
    );
};

export default PolicyAccountingView;
