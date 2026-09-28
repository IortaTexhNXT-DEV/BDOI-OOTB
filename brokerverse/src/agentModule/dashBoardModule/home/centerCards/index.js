import { Card } from "primereact/card";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import BarchartMonthly from "./BarchartMonthly";
import SvgArrow from "../../../../assets/agentIcon/SvgArrow";
import UpcommingEventCard from "../../../openItems/openItems/UpcommingEventCard";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const CenterCard = ({ commission }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSeeMore = () => {
    navigate("/agent/openitems");
  };

  const { upcommingEventsList, loading } = useSelector(
    ({ openitemsReducers }) => {
      return {
        loading: openitemsReducers?.loading,
        upcommingEventsList: openitemsReducers?.upcommingEventsList,
      };
    }
  );

  const [selectedCity, setSelectedCity] = useState("2024");
  const cities = [
    { name: "2024" },
    { name: "2023" },
    { name: "2022" },
    { name: "2021" },
    { name: "2020" },
  ];

  return (
    <div className="center__card__container grid pt-2">
      <div className="col-12 md:col-8 lg:col-8">
        <Card>
          <div className="grid  m-0">
            <div className="col-12 md:col-6 lg:col-6">
              <div className="center__card__container__title">{t("dashboard.commission")}</div>
            </div>
            <div className="center__card__container__tabs col-12 md:col-6 lg:col-6">
              <div className="center__card__container__year__lable">{t("dashboard.year")}</div>
              <Dropdown
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.value)}
                options={cities}
                optionLabel="name"
                className="w-full md:w-8rem"
                optionValue="name"
              />
            </div>
          </div>
          <BarchartMonthly year={selectedCity} data={commission} />
        </Card>
      </div>
      <div className="col-12 md:col-4 lg:col-4">
        <Card>
          <div>
            <div className="center__card__container__calender__title">
              {t("dashboard.upcomingEvents")}
            </div>
            <div className="center__card__container__calender__sub__title">
              {t("dashboard.basedOnActivityMonitor")}
            </div>
            <div style={{ height: "23rem" }}>
              {upcommingEventsList.length > 0 ? (
                <div>
                  {upcommingEventsList &&
                    upcommingEventsList
                      ?.slice(0, 4)
                      .map((singleData, i) => (
                        <UpcommingEventCard key={i} data={singleData} />
                      ))}
                  {upcommingEventsList.length > 4 && (
                    <div className="center__card__container__btn__container mt-3">
                      <div
                        className="center__card__container__btn cursor-pointer"
                        onClick={() => handleSeeMore()}
                      >
                        {t("common.seeMore")} <SvgArrow />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", paddingTop: "40px" }}>
                  {t("dashboard.noDataAvailable")}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CenterCard;
