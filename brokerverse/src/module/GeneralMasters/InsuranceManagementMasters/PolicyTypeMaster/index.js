import { useTranslation } from "react-i18next";
import PageHeader from "../../../../components/PageHeader";
import "./index.scss";
import TableData from "./TableData/index";
import { useNavigate } from "react-router-dom";
import PageActions from "../../../../components/PageActions";

const Index = () => {
  const { t } = useTranslation();
  const navigation = useNavigate();

  const items = [
    {
      label: t("generalMasters.insurance"),
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: t("generalMasters.policyTypeMaster"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const handleAction = () => {
    navigation(`/master/generals/insurancemanagement/policytype/add/${1}`);
  };
  return (
    <div className="container__policy__type__master">
      <div className="grid m-0 top__container">
        
        <div className="col-12 p-0 " style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
          <PageHeader title={t("generalMasters.policyTypeMaster")} home={home.label} trail={items.map((i) => (i.url ? { label: i.label, to: i.url } : i.label))} />}
          />
          </div>
          <div>
          <PageActions onAdd={() => handleAction()} />
          </div>
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
