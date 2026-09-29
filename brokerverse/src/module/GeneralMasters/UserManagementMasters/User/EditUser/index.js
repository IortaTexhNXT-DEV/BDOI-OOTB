import { Card } from "primereact/card";
import React from "react";
import { TabView, TabPanel } from "primereact/tabview";
import TransactionCodeSetupTable from "./TransactionCodeSetupTable";
import "./index.scss"
import UserGroupAccess from "./UserGroupAccessTable";
const EditUser = () => {

  return (
    <Card className="view__table mt-4">
      <div className="grid mt-1">
        <div className="col-12 md:col-12 lg-col-12 ">
          <TabView >
            <TabPanel header="Multi Branch Access" ><TransactionCodeSetupTable/></TabPanel>
            <TabPanel header="Additional Role" ><UserGroupAccess/></TabPanel>
          </TabView>
        </div>
      </div>
      
    </Card>
  );
};

export default EditUser;
