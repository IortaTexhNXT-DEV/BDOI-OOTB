import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import NavBar from "../../../components/NavBar";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { Button } from "primereact/button";
import TableData from "./TableData/index";
import SvgUploade from "../../../assets/icons/SvgUploade";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getPatchMainAccountDetailEdit } from "./store/mainAccountReducer";
// import ModalData from "./PopUpData/ModalData";

const MainAccountMaster = () => {
  const { t } = useTranslation();
  const { MainAccountList, loading } = useSelector(({ mainAccoutReducers }) => {
    return {
      loading: mainAccoutReducers?.loading,
      MainAccountList: mainAccoutReducers?.MainAccountList,
    };
  });
  console.log(MainAccountList[0].mainAccountCode, "MainAccountList");
  const navigation = useNavigate();
  const [visible, setVisible] = useState(false);

  const [popUpAction, setpopUpAction] = useState(null);

  const items = [
    {
      label: t("financeMasters.mainAccountBreadcrumb"),
      url: "/master/finance/mainaccount",
    },
  ];
  const home = { label: t("financeMasters.master") };
  const dispatch = useDispatch();
  const handleAction = (id, navigationPath) => {
    if (navigationPath === "Add") {
      navigation("/master/finance/mainaccount/addmainaccount");
    }
    if (navigationPath === "Edit") {
      // navigation("/master/finance/mainaccount/editmainaccount");
    }
    if (navigationPath === "View") {
      // navigation("/master/finance/mainaccount/viewmainaccount");
    }
  };
  return (
    <div className="container__main__category__master">
      <div className="grid m-0 top__container">
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="main__account__title">{t("financeMasters.mainAccountMaster")}</div>
        </div>
        <div className="col-12 p-0 flex justify-content-end">
          <Button
            icon={
              <div className="pr-2">
                <SvgUploade />
              </div>
            }
            className="main__btn__action__upload mr-4"
            onClick={() => handleAction(0, "Add")}
          >
            {t("financeMasters.upload")}
          </Button>
          <Button
            icon={
              <div className="pr-2">
                <SvgAdd />
              </div>
            }
            className="main__btn__action"
            onClick={() => handleAction(0, "Add")}
          >
            {t("financeMasters.add")}
          </Button>
        </div>
        <div className="col-12 p-0">
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="grid m-0 table__container">
        <div className="col-12 p-0">
          <TableData
            handleAction={handleAction}
            MainAccountList={MainAccountList}
          />
        </div>
      </div>
    </div>
  );
};

export default MainAccountMaster;
