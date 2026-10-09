import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import TransactionCodeMasterTable from "./TransactionCodeMasterTable";
import { useState } from "react";
import ImportDialog, { masterTarget } from "../../../components/ImportDialog";
import PageActions from "../../../components/PageActions";

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
          <PageActions onUpload={() => setShowUpload(true)} onAdd={() => handleClick()} />
            <ImportDialog visible={showUpload} onHide={() => setShowUpload(false)} title="Upload transaction codes" targets={UPLOAD_TARGETS} />
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
