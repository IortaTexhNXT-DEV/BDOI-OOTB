import React from "react";
import { useTranslation } from "react-i18next";
import "../../PettyCashManagement/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import RequestTable from "./RequestTable";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { useNavigate } from "react-router";
import NavBar from "../../../components/NavBar";

const PettyCashRequest = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = [
    { label: t("pettyCash.pettyCashManagement"), to: "/accounts/pettycash/pettycashrequest" },
    {
      label: t("pettyCash.pettyCashRequest"),
      to: "/accounts/pettycash/pettycashrequest",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleClick = () => {
    navigate(`/accounts/pettycash/addrequest/add/${123}`);
  };

  return (
    <div className="pettycash__management">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div className="pettycash__title">{t("pettyCash.pettyCashRequest")}</div>
          <div>
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className="btn__container">
            <Button
              label={t("pettyCash.request")}
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
        <RequestTable />
      </div>
    </div>
  );
};

export default PettyCashRequest;
