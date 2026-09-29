import React from "react";
import { useTranslation } from "react-i18next";
import "../../PettyCashManagement/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { useNavigate } from "react-router";
import PettyCashReplenishTable from "./ReplenishTable";
import NavBar from "../../../components/NavBar";

const PettyCashReplenish = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = [
    { label: t("pettyCash.pettyCashManagement"), to: "/accounts/pettycash/replenish" },
    {
      label: t("pettyCash.pettyCashReplenish"),
      to: "/accounts/pettycash/replenish",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleClick = () => {
    navigate("/accounts/pettycash/addreplenish");
  };

  return (
    <div className="pettycash__management">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div className="pettycash__title">{t("pettyCash.addReplenish")}</div>
          <div>
            <BreadCrumb
              model={items}
              home={Initiate}
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className="btn__container">
            <Button
              label={t("pettyCash.replenish")}
              icon={<SvgAdd color={"#fff"} />}
              className="add__btn"
              onClick={() => {
                handleClick();
              }}
            />
          </div>
        </div>
      </div>
      <div>
        <PettyCashReplenishTable />
      </div>
    </div>
  );
};

export default PettyCashReplenish;
