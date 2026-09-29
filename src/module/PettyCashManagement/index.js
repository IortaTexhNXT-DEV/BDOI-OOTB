import React from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../assets/icons/SvgDot";
import InitiateComponent from "./Initiate";
import RequestComponent from "./Request";
import Disbursement from "./Disbursement";
import { TabView, TabPanel } from "primereact/tabview";

const Pettycashmanagement = () => {
  const { t } = useTranslation();
  const items = [
    { label: t("pettyCash.accounts"), to: "/accounts" },
    { label: t("pettyCash.pettyCashManagement"), to: "Petty Cash Management" },
  ];
  const Initiate = { label: t("pettyCash.dashboard") };
  return (
    <div className="grid pettycash__management m-0">
      <div className="col-12">
        <div className="pettycash__title">{t("pettyCash.pettyCashManagement")}</div>
      </div>
      <div className="col-12 md:col-2-5 lg-col-2-5 mb-4 sidebar">
        <BreadCrumb
          model={items}
          home={Initiate}
          className="breadCrums"
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>
      <div className="col-12 mb-3">
        <TabView className="p-tabmenu p-component tab-border p-tabmenu-nav p-reset">
          <TabPanel header={t("pettyCash.initiate")}>
            <InitiateComponent />
          </TabPanel>
          <TabPanel header={t("pettyCash.request")}>
            <RequestComponent />
          </TabPanel>
          <TabPanel header={t("pettyCash.disbursement")}>
            <Disbursement />
          </TabPanel>
          <TabPanel header={t("pettyCash.receipts")}></TabPanel>
          <TabPanel header={t("pettyCash.replenish")}></TabPanel>
        </TabView>
      </div>
    </div>
  );
};

export default Pettycashmanagement;
