import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import TableData from "./TableData/index";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import ImportDialog, { masterTarget } from "../../../../components/ImportDialog";
import PageActions from "../../../../components/PageActions";

const UPLOAD_TARGETS = [masterTarget("vehicle-brand", "Vehicle brands"), masterTarget("vehicle-model", "Vehicle models"), masterTarget("vehicle-variant", "Vehicle variants"), masterTarget("vehicle", "Vehicles")];

const Index = () => {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const navigation = useNavigate();

  const items = [
    {
      label: t("generalMasters.insuranceManagement"),
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: t("generalMasters.vehicle"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const handleAction = () => {
    navigation(`/master/generals/insurancemanagement/vehicle/add/${1}`);
  };
  return (
    <div className="container__vehicle__master">
      <div className="grid m-0 top__container">
       
        <div className="col-12 p-0 " style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
        <div className="main__account__title">{t("generalMasters.vehicle")}</div>
        <BreadCrumb
            home={home}
            className="breadCrums__view__reversal"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
          </div>
        
        <div>
          <PageActions onUpload={() => setShowUpload(true)} onAdd={() => handleAction()} />
          <ImportDialog visible={showUpload} onHide={() => setShowUpload(false)} title="Upload vehicles" targets={UPLOAD_TARGETS} />
          </div>
        </div>
        <div className="col-12 p-0">
          
        </div>
      </div>
      <div className="grid m-0 table__container">
        <div className="col-12 p-0">
          <TableData navigate={navigation} />
        </div>
      </div>
    </div>
  );
};

export default Index;
