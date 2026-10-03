import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { Card } from "primereact/card";
import { useDispatch, useSelector } from "react-redux";
import { getOpenItemsListMiddleware } from "../store/openItemsMiddleware";

const Notification = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const events = useSelector(
    ({ openitemsReducers }) => openitemsReducers?.upcommingEventsList || []
  );

  useEffect(() => {
    dispatch(getOpenItemsListMiddleware());
  }, [dispatch]);

  return (
    <div className="overall__upcoming__event__container">
      <div className="grid mt-2">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="today__text mt-2">{t("openItems.today")}</div>
          {events.map((event) => (
            <Card className="mt-4" key={event.id}>
              <div className="grid">
                <div className="col-12 md:col-6 lg:col-6">
                  <div className="card__title">{event.description}</div>
                  <div className="client__name mt-2">{event.date}</div>
                  {event.from && (
                    <div className="client__name mt-2">
                      {t("openItems.timing")} : {event.from}
                      {event.to ? ` - ${event.to}` : ""}
                    </div>
                  )}
                </div>
                <div className="col-12 md:col-6 lg:col-6"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Notification;
