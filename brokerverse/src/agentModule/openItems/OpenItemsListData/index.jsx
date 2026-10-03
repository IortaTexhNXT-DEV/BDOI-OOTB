import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { getOpenItemsListMiddleware } from "../store/openItemsMiddleware";
import SvgDots from "../../../assets/agentIcon/SvgDots";
import "./index.scss";

// card order: what needs attention first on the left, then what is waiting on the client
const CARDS = [
  { type: "expiring", icon: "pi pi-calendar-times", to: "/agent/openitems/expiringpolicy" },
  { type: "payment", icon: "pi pi-wallet", to: "/agent/payments" },
  { type: "quote", icon: "pi pi-file", to: "/agent/openitems/quotepending" },
  { type: "renewal", icon: "pi pi-refresh", to: "/agent/openitems/renewalrequest" },
];

/** Operations > Open Items: one card per kind of open item with its count and the two most recent items. */
const OpenItemsListData = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { summary, openItems, loaded } = useSelector(({ openitemsReducers }) => ({
    summary: openitemsReducers?.summary || [],
    openItems: openitemsReducers?.items || [],
    loaded: Array.isArray(openitemsReducers?.summary) && openitemsReducers.summary.length > 0,
  }));
  useEffect(() => {
    dispatch(getOpenItemsListMiddleware());
  }, [dispatch]);

  const cards = CARDS.map((card) => {
    const entry = summary.find((s) => s.type === card.type) || {};
    return { ...card, title: entry.status || t(`openItems.type.${card.type}`), count: entry.count, items: openItems.filter((i) => i.type === card.type).slice(0, 2) };
  });

  return (
    <div className="open_item_container">
      <div className="open_item_title">{t("openItems.openItems")}</div>
      <BreadCrumb model={[{ label: t("openItems.openItems") }]} home={{ label: t("sidebar.Operations") }} className="breadCrums" separatorIcon={<SvgDots color={"#000"} />} />
      <div className="open-items-grid">
        {cards.map((card) => (
          <section key={card.type} className="open-items-card" aria-label={card.title}>
            <header className="open-items-card__head">
              <span className="open-items-card__title"><i className={card.icon} aria-hidden="true" />{card.title}</span>
              <span className="open-items-card__count">{loaded ? card.count || 0 : "-"}</span>
            </header>
            <ul className="open-items-card__rows">
              {card.items.map((item, i) => (
                <li key={`${item.policyNo || item.quoteId || i}`}>
                  <span className="open-items-card__who">
                    <span className="open-items-card__name">{item.name || "-"}</span>
                    <span className="bv-cell-sub">{t("openItems.clientId")}: {item.clientId || "-"}</span>
                  </span>
                  <span className="open-items-card__ref">{item.policyNo || item.quoteId || ""}</span>
                </li>
              ))}
              {loaded && !card.items.length && <li className="open-items-card__empty">{t("openItems.none", { defaultValue: "Nothing open" })}</li>}
            </ul>
            <footer className="open-items-card__foot">
              <Button label={t("openItems.seeMore")} icon="pi pi-arrow-right" iconPos="right" text size="small" onClick={() => navigate(card.to)} />
            </footer>
          </section>
        ))}
      </div>
    </div>
  );
};

export default OpenItemsListData;
