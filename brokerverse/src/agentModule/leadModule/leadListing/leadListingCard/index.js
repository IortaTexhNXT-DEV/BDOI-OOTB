import { Card } from "primereact/card";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import LeadListingMotorTable from "./LeadListingMotorTable";
import LeadListingMotorCards from "./LeadListingMotorCards";
import { useSelector } from "react-redux";

const LeadListingCard = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState("cards");
  const [activeTab, setActiveTab] = useState(0);

  const { leadtabledata, paymentSearchList } = useSelector(
    ({ leadReducers, agentPaymentMainReducers }) => ({
      leadtabledata: leadReducers?.leadtabledata,
      paymentSearchList: leadReducers?.paymentSearchList,
    })
  );

  return (
    <div className="lead__listing__card__container mt-4">
      <Card>
        <TabView
          activeIndex={activeTab}
          onTabChange={(e) => setActiveTab(e.index)}
        >
          <TabPanel header={t("dashboard.Motor")}>
            {viewMode === "table" ? (
              <LeadListingMotorTable
                leadtabledata={leadtabledata}
                paymentSearchList={paymentSearchList}
              />
            ) : (
              <LeadListingMotorCards lob={null} activeTab={activeTab} tabIndex={0} />
            )}
          </TabPanel>
          <TabPanel header={t("dashboard.Fire and Allied Perils")}>
            {viewMode === "table" ? (
              <LeadListingMotorTable
                lob="FIRE"
                leadtabledata={leadtabledata}
                paymentSearchList={paymentSearchList}
              />
            ) : (
              <LeadListingMotorCards lob="FIRE" activeTab={activeTab} tabIndex={1} />
            )}
          </TabPanel>
          <TabPanel header={t("dashboard.Industrial All Risks", "Industrial All Risks")}>
            {viewMode === "table" ? (
              <LeadListingMotorTable
                lob="IAR"
                leadtabledata={leadtabledata}
                paymentSearchList={paymentSearchList}
              />
            ) : (
              <LeadListingMotorCards lob="IAR" activeTab={activeTab} tabIndex={2} />
            )}
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

export default LeadListingCard;
