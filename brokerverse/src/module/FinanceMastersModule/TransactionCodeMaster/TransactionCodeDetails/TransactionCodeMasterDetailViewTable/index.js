import { Card } from "primereact/card";
import React from "react";
import { TabView, TabPanel } from "primereact/tabview";
import TransactionCodeSetupTableDetail from "./TransactionCodeSetupTableDetail";
import UserGroupAccessDetail from "./UserGroupAccessDetail";

const TransactionCodeMasterDetailViewTable = () => {
  return (
    <Card className="view__table mt-4">
      <div className="grid mt-1">
        <div className="col-12 md:col-12 lg-col-12 ">
          <TabView >
            <TabPanel header="Transaction Code Setup" ><TransactionCodeSetupTableDetail/></TabPanel>
            <TabPanel header="User Group Access"><UserGroupAccessDetail/></TabPanel>
          </TabView>
        </div>
      </div>
      
    </Card>
  )
}

export default TransactionCodeMasterDetailViewTable
