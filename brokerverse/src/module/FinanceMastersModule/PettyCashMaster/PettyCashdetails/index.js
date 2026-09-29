import { BreadCrumb } from "primereact/breadcrumb";
import { useEffect, useState } from "react";
import SvgDot from "../../../../assets/icons/SvgDot";
import "../PettyCashdetails/index.scss";
import InputField from "../../../../components/InputField";
import ArrowLeftIcon from "../../../../assets/icons/ArrowLeftIcon";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const PettyCashDetail = () => {
  const navigate = useNavigate();
  const [visiblePopup, setVisiblePopup] = useState(false);

  const items = [
    { label: "Petty Cash", url: "/master/finance/pettycash" },
    {
      label: "Petty Cash Details",
      url: "/master/finance/pettycash/pettycashdetail",
    },
  ];
  const { pettyCashView } = useSelector(
    ({ pettyCashMainReducers }) => {
      return {
        loading: pettyCashMainReducers?.loading,
        pettyCashView: pettyCashMainReducers?.pettyCashView,
        // pettyCashSearchList: pettyCashMainReducers?.pettyCashSearchList
      };
    }
  );

  const handleGoBack = () => {
    navigate("/master/finance/pettycash");
  };
  const home = { label: "Master" };
  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisiblePopup(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visiblePopup]);

  const [step] = useState(0);


  return (
    <div className="grid detail__add__container">
      <div className="col-12"></div>
      <div className="col-12 mb-2">
        <div className="add__sub__title ">
          <div onClick={handleGoBack} className="mr-2 mt-1">
            <ArrowLeftIcon />
          </div>{" "}
          Petty Cash Details
        </div>
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="grid card__container p-2">
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Petty Cash Code"
            placeholder="Enter"
            value={pettyCashView.pettycashcode}
            disabled={true}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Petty Cash Name"
            placeholder="Enter"
            value={pettyCashView.pettycashname}
            disabled={true}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Petty Cash Size"
            placeholder="Enter"
            value={pettyCashView.pettycashsize}
            disabled={true}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Available Cash"
            placeholder="Enter"
            value={pettyCashView.avilabelcash}
            disabled={true}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Minimum Cash Box"
            placeholder="Enter"
            value={pettyCashView.minicashbox}
            disabled={true}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Transaction Limit"
            placeholder="Enter"
            value={pettyCashView.transactionlimit}
            disabled={true}
          />
        </div>
      </div>
    </div>
  );
};
export default PettyCashDetail;
