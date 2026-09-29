import { Card } from "primereact/card";
import React from "react";
import { TabView, TabPanel } from "primereact/tabview";
import TransactioncodeSetupTable from "./TransactionCodeSetupTable/index"
import UserGroupAccessEdit from "./UserGroupAccessEdit";

const TransactionCodeMasterEdit = () => {
  return (
    <Card className="view__table mt-4">
      <div className="grid mt-1">
        <div className="col-12 md:col-12 lg-col-12 ">
          <TabView >
            <TabPanel header="Transaction Code Setup" ><TransactioncodeSetupTable/></TabPanel>
            <TabPanel header="User Group Access"><UserGroupAccessEdit/></TabPanel>
          </TabView>
        </div>
      </div>
      
    </Card>
  )
}

export default TransactionCodeMasterEdit
