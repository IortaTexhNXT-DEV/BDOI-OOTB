import React from "react";
import SvgCalendertracker from "../../../assets/agentIcon/SvgCalendertracker";
import moment from "moment";
import "./index.scss";

const UpcommingEventCard = ({ data }) => {
  return (
    <div className="grid mt-3">
      <div className="col-2 md:col-2 lg:col-2">
        <div className="date__number__container">
          <div className="month__text">
            {moment(data?.date, "DD/MM/YYYY").format("MMM")}
          </div>
          <div className="month__date">
            {moment(data?.date, "DD/MM/YYYY").format("DD")}
          </div>
        </div>
      </div>
      <div className="col-8 md:col-8 lg:col-8">
        <div className="date__text__container">
          <div className="event__name">{data?.description}</div>
          <div className="event__time">
            {data?.from} to {data?.to}
          </div>
        </div>
      </div>
      <div className="date__svg__main__container col-2 md:col-2 lg:col-2">
        <div className="date__svg__container">
          <SvgCalendertracker />
        </div>
      </div>
    </div>
  );
};

export default UpcommingEventCard;
