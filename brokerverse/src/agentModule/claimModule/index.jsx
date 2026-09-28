import { Card } from "primereact/card";
import React from "react";
import { useTranslation } from "react-i18next";
import ClaimTable from "./claimTable";
import "../claimModule/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../assets/agentIcon/SvgDots";
import "./index.scss";
const ClientListingCard = () => {
  const { t } = useTranslation();
  const items = [{ label: t("claims.title"), url: "/agent/clientlisting" }];
  const Initiate = { label: t("claims.home") };

  return (
    <div className="claim__table__container mt-4">
      <div className="grid mt-3">
        <div className="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">
            {t("claims.title")}
          </label>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
        <div className="card__container__outer">
          <Card>
            <ClaimTable />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClientListingCard;
