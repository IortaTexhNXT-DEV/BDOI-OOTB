import { useTranslation } from "react-i18next";
import "../../PettyCashManagement/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { useNavigate } from "react-router";
import PettyCashReceiptsTable from "./PettyCashReceiptsTable";

const PettyCashReceipts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = [
    { label: t("pettyCash.pettyCashManagement"), to: "/accounts/pettycash/receipts" },
    {
      label: t("pettyCash.pettyCashReceipts"),
      to: "/accounts/pettycash/receipts",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleClick = () => {
    navigate("/accounts/pettycash/addreceipts");
  };

  return (
    <div className="pettycash__management">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div className="pettycash__title">{t("pettyCash.pettyCashReceipts")}</div>
          <div>
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className="btn__container">
            <Button
              label={t("pettyCash.receipts")}
              icon={<SvgAdd color={"#fff"} />}
              className="add__btn"
              onClick={() => {
                handleClick();
              }}
            />
          </div>
        </div>
      </div>
      <div>
        <PettyCashReceiptsTable />
      </div>
    </div>
  );
};

export default PettyCashReceipts;
