import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../OpenItemsListData/index.scss";
import SvgGoBack from "../../../assets/agentIcon/SvgGoBack";
import SvgArrow from "../../../assets/agentIcon/SvgArrow";
import SvgMotorTable from "../../../assets/agentIcon/SvgMotorTable";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getOpenItemsListMiddleware } from "../store/openItemsMiddleware";
import SvgDocumentIcon from "../../../assets/agentIcon/SvgDocumentIcon";
import SvgGreenDocument from "../../../assets/agentIcon/SvgGreenDocument";
import SvgPaymentIcon from "../../../assets/agentIcon/SvgPaymentIcon";
import SvgRenewalIcon from "../../../assets/agentIcon/SvgRenewalIcon";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDots from "../../../assets/agentIcon/SvgDots";

const ICONS = {
  expiring: <SvgDocumentIcon />,
  quote: <SvgGreenDocument />,
  payment: <SvgPaymentIcon />,
  renewal: <SvgRenewalIcon />,
};
const LEFT_TYPES = ["expiring", "quote"];
const RIGHT_TYPES = ["payment", "renewal"];

/** One card per open-item type: count and the first two items. */
const toCards = (types, summary, items) =>
  types.map((type) => {
    const entry = summary.find((s) => s.type === type) || { status: type, count: 0 };
    const [first = {}, second = {}] = items.filter((item) => item.type === type);
    return { ...entry, icon: ICONS[type], first, second };
  });

const OpenItemsListData = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { summary, items } = useSelector(({ openitemsReducers }) => ({
    summary: openitemsReducers?.summary || [],
    items: openitemsReducers?.items || [],
  }));
  useEffect(() => {
    dispatch(getOpenItemsListMiddleware());
  }, [dispatch]);
  const data = toCards(LEFT_TYPES, summary, items);
  const mock = toCards(RIGHT_TYPES, summary, items);
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
                    <div className="item__name">{val.first.name}</div>
                    <div className="item__client__id">
                      {t("openItems.clientId")}: {val.first.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.first.policyNo || val.first.quoteId}</div>
                  </div>
                </div>
                <div className="body__card__view">
                  <div>
                    <div className="item__name">{val.second.name}</div>
                    <div className="item__client__id">
                      {t("openItems.clientId")}: {val.second.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.second.policyNo || val.second.quoteId}</div>
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
                    <div className="item__name">{val.first.name}</div>
                    <div className="item__client__id">
                      Client ID: {val.first.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.first.policyNo || val.first.quoteId}</div>
                  </div>
                </div>
                <div className="body__card__view">
                  <div>
                    <div className="item__name">{val.second.name}</div>
                    <div className="item__client__id">
                      Client ID: {val.second.clientId}
                    </div>
                  </div>
                  <div className="policy__data__view">
                    <div>
                      <SvgMotorTable />
                    </div>
                    <div className="item_policy_no">{val.second.policyNo || val.second.quoteId}</div>
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
