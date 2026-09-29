import { Card } from "primereact/card";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import ClientListingAllCategory from "./ClientListingAllCategory";
import ClientListingIndividualCategory from "./ClientListingIndividualCategory";
import ClientListingCompanyCategory from "./ClientListingCompanyCategory";
import { useSelector } from "react-redux";
import { ProgressSpinner } from "primereact/progressspinner";


const ClientListingCard = () => {
  const { t } = useTranslation();
  const { clientListTable, paymentSearchList, loading, error } = useSelector(({ clientsReducers, agentPaymentMainReducers }) => {
    return {
      clientListTable: clientsReducers?.clientListTable,
      paymentSearchList: clientsReducers?.paymentSearchList,
      loading: clientsReducers?.loading,
      error: clientsReducers?.error,
    };
  });
  console.log(clientListTable, "clientListTable");
  
  return (
    <div className="lead__listing__card__container mt-4">
      <Card>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '50px' }}>
            <ProgressSpinner />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#ef4444' }}>
            <p>{t("clients.errorLoadingClients", { message: error })}</p>
          </div>
        ) : (
          <TabView>
            <TabPanel header={t("clients.all")}>
              <ClientListingAllCategory data={"All"} clientListTable={clientListTable} paymentSearchList={paymentSearchList} />
            </TabPanel>
            <TabPanel header={t("clients.individualTab")}>
              <ClientListingIndividualCategory data={"Individual"} clientListTable={clientListTable} paymentSearchList={paymentSearchList} />
            </TabPanel>
            <TabPanel header={t("clients.company")}>
              <ClientListingCompanyCategory data={"Corporate"} clientListTable={clientListTable} paymentSearchList={paymentSearchList} />
            </TabPanel>
          </TabView>
        )}
      </Card>
    </div>
  );
};

export default ClientListingCard;
