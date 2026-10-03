import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Button } from "primereact/button";
import TableData from "./TableData/index";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { t } = useTranslation();
  const navigation = useNavigate();


  const items = [
    {
      label: t("generalMasters.insuranceManagement"),
      url: "/master/generals/insurancemanagement/cover",
    },
    {
      label: t("generalMasters.cover"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const handleAction = () => {
    navigation(`/master/generals/insurancemanagement/cover/add/${1}`);
  };
  return (
    <div className="container__cover_master">
      <div className="grid m-0 top__container">
        <div className="col-12 p-0"></div>
        
        <div className="col-12 p-0 " style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
         <div>
          <div className="main__account__title">{t("generalMasters.cover")}</div>
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
          </div>
          <div>
          <Button
            icon={
              <div className="pr-2">
                <SvgAdd />
              </div>
            }
            className="main__btn__action"
            onClick={() => handleAction()} aria-label="Add" tooltip="Add" tooltipOptions={{ position: "top" }} >
            {t("generalMasters.add")}
          </Button>
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
