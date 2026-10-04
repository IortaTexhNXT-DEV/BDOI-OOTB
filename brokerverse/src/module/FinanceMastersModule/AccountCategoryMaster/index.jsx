import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { Button } from "primereact/button";
import TableData from "./TableData/index";
import ModalEditData from "./PopUpData/ModalEditData";
import ModalViewData from "./PopUpData/ModalViewData";
import ModalAddData from "./PopUpData/ModalAddData";
import { useDispatch } from "react-redux";
import {
  getAccountCategoryDetailViewMiddleWare,
  getAccountCategoryDetailEditMiddleWare,
} from "./store/accountCategoryMeddleware";

const AccountCategoryMaster = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [visibleAdd, setVisibleAdd] = useState(false);
  const [visibleView, setVisibleView] = useState(false);
  const [visibleEdit, setVisibleEdit] = useState(false);
  const [, setEditID] = useState(null);
  const [popUpAction] = useState(null);
  const [EmptyTable, setEmptyTable] = useState(false);
  const items = [
    {
      label: t("financeMasters.accountCategory"),
      url: "/master/finance/accountcategory",
    },
  ];
  const home = { label: t("financeMasters.master") };
  const handleSave = (values) => {
    setEmptyTable(true);
  };
  const handleEdit = (values) => {
  };
  const handleViewAction = (data) => {
    dispatch(getAccountCategoryDetailViewMiddleWare(data));
    setVisibleView(true);
  };
  const handleEditAction = (data) => {
    dispatch(getAccountCategoryDetailEditMiddleWare(data));
    setVisibleEdit(true);
  };
  const handleAddAction = () => {
    setVisibleAdd(true);
  };

  return (
    <div className="container__account__category__master">
      <div className="grid m-0 top__container">
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="correction__title__reversal">
            {t("financeMasters.accountCategoryMaster")}
          </div>
        </div>
        <div className="col-12 p-0 flex justify-content-end">
          <Button
            icon={
              <div className="pt-1">
                <SvgAdd />
              </div>
            }
            label={t("financeMasters.add")}
            className="correction__btn__reversal"
            onClick={handleAddAction}
          />
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
            handleViewAction={handleViewAction}
            handleEditAction={handleEditAction}
            EmptyTable={EmptyTable}
          />
        </div>
      </div>

      <ModalAddData
        visible={visibleAdd}
        setVisible={setVisibleAdd}
        handleSave={handleSave}
        setEditID={setEditID}
        handleEdit={handleEdit}
        popUpAction={popUpAction}
      />
      <ModalEditData
        visible={visibleEdit}
        setVisible={setVisibleEdit}
        handleSave={handleSave}
        setEditID={setEditID}
        handleEdit={handleEdit}
        popUpAction={popUpAction}
      />
      <ModalViewData
        visible={visibleView}
        setVisible={setVisibleView}
        handleSave={handleSave}
        setEditID={setEditID}
        handleEdit={handleEdit}
        popUpAction={popUpAction}
      />
    </div>
  );
};

export default AccountCategoryMaster;
