import { Card } from "primereact/card";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import PolicyTable from "./policyTable/index";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../assets/agentIcon/SvgDots";
import PolicyStatsCards from "../../components/PolicyStatsCards";
import { useSelector } from "react-redux";

const ExpiredPoliciesPage = () => {
  const { t } = useTranslation();
  const items = [{ label: t("expiredPolicies.breadcrumb"), url: "/agent/expired-policies" }];
  const Initiate = { label: t("expiredPolicies.home") };

  const [displayDialog, setDisplayDialog] = useState({
    display: false,
    policyId: null,
  });

  // Get policy data from Redux store
  const { policyListData } = useSelector(({ policyMainReducers }) => ({
    policyListData: policyMainReducers?.policyListData || [],
  }));

  return (
    <div className="policy__table__container mt-4">
      <div className="grid mt-3">
        <div className="col-12 md:col-12 lg:col-12">
          <label className="leadlisting__overal__container__title">
            {t("expiredPolicies.title")}
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

        {/* Policy Statistics Cards */}
        <div className="col-12">
          <PolicyStatsCards policyData={policyListData} />
        </div>

        <div className="card__container__outer">
          <Card style={{ borderRadius: "20px" }}>
            <PolicyTable
              filterExpiredOnly={true}
              setDisplayDialog={setDisplayDialog}
              displayDialog={displayDialog}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExpiredPoliciesPage;
