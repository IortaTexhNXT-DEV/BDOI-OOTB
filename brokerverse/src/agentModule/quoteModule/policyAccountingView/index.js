import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { useLocation, useNavigate } from "react-router-dom";
import AccountingTable from "./AccountingTable";

const PolicyAccountingView = ({ action }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { state } = useLocation();
    const handleClientViewNavigation = () => {
        if (state?.clientId) {
            navigate(`/agent/clientview/${state.clientId}`);
        } else {
            navigate(-1);
        }
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
            <AccountingTable type={state?.installmentType} />
        </div>
    );
};

export default PolicyAccountingView;
