import { BreadCrumb } from "primereact/breadcrumb";
import { useState, useRef, useEffect } from "react";
import SvgDot from "../../../assets/icons/SvgDot";
import "../Commission/index.scss";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import { TieredMenu } from "primereact/tieredmenu";
import CommissionTabel from "./CommissionTabel";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { getCommission, getCommissionSearchList } from "./store/commissionMiddleWare";
import { useTranslation } from "react-i18next";

const Commission = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [newDataTable] = useState([]);

  const navigate = useNavigate();
  const items = [
    { id: 1, label: t("sidebar.Commission"), url: "/master/generals/commission" },
  ];
  const home = { label: t("sidebar.Master") };

  const handleEdit = () => {
    setVisible(true);
  };
  const handlePolicy = () => {
    navigate("/master/generals/commission/addcommission");
  };

  const menu = useRef(null);
  const menuitems = [
    { label: t("common.name") },
    { label: t("common.date") },
    { label: t("accounts.voucherNumber") },
  ];
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(getCommission());
  }, [dispatch]);
  const handleSubmit = (values) => {
    dispatch(getCommissionSearchList({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(getCommissionSearchList({ textSearch: formik.values.search }));
    }
  }, [formik.values.search]);

  const { commissionList, commissionSearchList, getCommissionEdit } =
    useSelector(({ commissionMianReducers }) => {
      return {
        loading: commissionMianReducers?.loading,
        commissionList: commissionMianReducers?.commissionList,
        commissionSearchList: commissionMianReducers?.commissionSearchList,
        getCommissionEdit: commissionMianReducers?.getCommissionEdit,
      };
    });
  return (
    <div className="grid  container__commission">
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__Journal__Voture">
          {t("generalMasters.commissionsMaster")}
        </div>
        <div style={{margin:"20px 0px"}}>
          <BreadCrumb
            home={home}
            className={items.map((val) => {
              return val.label === "/subaccount"
                ? "breadCrums__view__reversal__Journal__Voture"
                : "item__color__Journal__Voture";
            })}
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="menu-container">
        <TieredMenu
          className="mt-2"
          model={menuitems}
          popup
          ref={menu}
          breakpoint="767px"
        />
      </div>
      <div className="col-12 md:col-6 lg:col-6 add__icon__alighn__Journal__Voture mb-3">
        <button type="button" className="add__icon__view__petty bv-add-button" onClick={handlePolicy}>
          <div className="add__icon__petty">
            <SvgAdd color={"#fff"} />
          </div>
          <div className="add__text__petty">{t("generalMasters.add")}</div>
        </button>
      </div>
      <div className="col-12 m-0 ">
        <div className="sub__container__Journal__Voture">
          <form
            onSubmit={formik.handleSubmit}
            className="col-12 search__filter__view__Journal__Voture"
          >
            <div className="col-12 md:col-12 lg:col-12">
              <div className="searchIcon__view__input__Journal__Voture">
                <span className="pl-2">
                  {" "}
                  <SvgSearchIcon />
                </span>
                <InputText
                  style={{ width: "100%" }}
                  classNames="input__sub__account__Journal__Voture"
                  placeholder={t("generalMasters.searchByCommissionCode")}
                  value={formik.values.search}
                  onChange={formik.handleChange("search")}
                />
              </div>
            </div>
          </form>
          <div className="col-12 ">
            <div className="main__tabel__title__Journal__Voture p-2">
              {t("generalMasters.commissionsList")}
            </div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%" }}
          >
            <div className="card p-1">
              <CommissionTabel
                handleEdit={handleEdit}
                newDataTable={newDataTable}
                visible={visible}
                getCommissionEdit={getCommissionEdit}
                commissionList={
                  formik.values.search !== ""
                    ? commissionSearchList
                    : commissionList
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Commission;
