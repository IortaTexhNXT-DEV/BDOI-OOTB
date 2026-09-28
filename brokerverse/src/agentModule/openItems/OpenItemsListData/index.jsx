import React from "react";
import { useTranslation } from "react-i18next";
import "../OpenItemsListData/index.scss";
import SvgGoBack from "../../../assets/agentIcon/SvgGoBack";
import SvgArrow from "../../../assets/agentIcon/SvgArrow";
import SvgMotorTable from "../../../assets/agentIcon/SvgMotorTable";
import { data } from "./data";
import { useNavigate } from "react-router-dom";
import { mock } from "./mock";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDots from "../../../assets/agentIcon/SvgDots";

const OpenItemsListData = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = [{ label: t("openItems.openItems") }];
  const Initiate = { label: t("openItems.home") };
  const handleNavigate = (data) => {
    if (data === "Pending Payments") {
      navigate("/agent/payments");
    } else if (data === "Quote Pending") {
      navigate("/agent/openitems/quotepending");
    } else if (data === "Renewal Request") {
      navigate("/agent/openitems/renewalrequest");
    } else {
      navigate("/agent/openitems/expiringpolicy");
    }
  };

  return (
    <div className="grid mt-3 open_item_container">
      <div className="col-12">
        <label className="open_item_title">{t("openItems.openItems")}</label>
      </div>
      <div className="col-12 pt-0 open__item__goBack">
        <BreadCrumb
          model={items}
          home={Initiate}
          className="breadCrums"
          separatorIcon={<SvgDots color={"#000"} />}
        />
      </div>
      <div className="col-6 open__item__card__view">
        {data.map((val, index) => {
          return (
            <div className="grid m-0" key={index}>
              <div className="col-12 md:col-12 lg:col-12 xl:col-12 open__item__sub__data">
                <div className="item_header">
                  <div className="item_status">
                    <div className="svg_icon">{val.icon}</div>
                    {val.status}
                  </div>
                  <div className="item_count">{val.count}</div>
                </div>
                <div className="body__card__view">
                  <div>
                    <div className="item__name">{val.name}</div>
                    <div className="item__client__id">
                      {t("openItems.clientId")}: {val.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.policyNo}</div>
                  </div>
                </div>
                <div className="body__card__view">
                  <div>
                    <div className="item__name">{val.name}</div>
                    <div className="item__client__id">
                      {t("openItems.clientId")}: {val.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.policyNo}</div>
                  </div>
                </div>
                <div className="bottom__view__card ">
                  <div
                    onClick={() => handleNavigate(val.status)}
                    className="cursor-pointer arrow__controller"
                  >
                    {t("openItems.seeMore")}
                    <SvgArrow />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="col-6 open__item__card__view">
        {mock.map((val, index) => {
          return (
            <div className="grid m-0" key={index}>
              <div className="col-12 md:col-12 lg:col-12 xl:col-12 open__item__sub__data">
                <div className="item_header">
                  <div className="item_status">
                    <div className="svg_icon">{val.icon}</div>
                    {val.status}
                  </div>
                  <div className="item_count">{val.count}</div>
                </div>
                <div className="body__card__view">
                  <div>
                    <div className="item__name">{val.name}</div>
                    <div className="item__client__id">
                      Client ID: {val.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.policyNo}</div>
                  </div>
                </div>
                <div className="body__card__view">
                  <div>
                    <div className="item__name">{val.name}</div>
                    <div className="item__client__id">
                      Client ID: {val.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.policyNo}</div>
                  </div>
                </div>
                <div className="bottom__view__card">
                  <div
                    onClick={() => handleNavigate(val.status)}
                    className="cursor-pointer arrow__controller"
                  >
                    See More
                    <SvgArrow />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OpenItemsListData;
