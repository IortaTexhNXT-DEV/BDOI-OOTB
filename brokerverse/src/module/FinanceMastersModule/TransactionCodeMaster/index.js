import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { useNavigate } from "react-router";
import SvgUploade from "../../../assets/icons/SvgUploade";
import TransactionCodeMasterTable from "./TransactionCodeMasterTable";
import { useState } from "react";
import ImportDialog, { masterTarget } from "../../../components/ImportDialog";

const UPLOAD_TARGETS = [masterTarget("transaction-code", "Transaction codes")];

const TransactionCodeMaster = () => {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const navigate = useNavigate();
  const items = [
    {
      label: t("financeMasters.transactionCode"),
      url: "/master/finance/transactioncode",
    },
  ];
  const Initiate = { label: t("financeMasters.master") };

  const handleClick = () => {
    navigate("/master/finance/transactioncode/addtransactioncode");
  };

  return (
    <div className="Transaction__Code__Master__container">
      
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div className="Transaction__Code__Master__title">
            {t("financeMasters.transactionCodeMaster")}
          </div>
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
          <Button onClick={() => setShowUpload(true)}
              label={t("financeMasters.upload")}
              icon={<SvgUploade color={"#fff"} />}
              className="upload__btn"
            />
            <ImportDialog visible={showUpload} onHide={() => setShowUpload(false)} title="Upload transaction codes" targets={UPLOAD_TARGETS} />
            <Button
              label={t("financeMasters.add")}
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
        <TransactionCodeMasterTable
       
        />
      </div>
    </div>
  );
};

export default TransactionCodeMaster;
