import React from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import "./index.scss";
import AgentProfileCard from "./agentProfileCard";
import { useNavigate } from "react-router-dom";
import InitialsAvatar from "../../component/InitialsAvatar";
const AgentViewProfile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const handleHomeNavigation = () => {
    navigate("/");
  };
  return (
    <div className="agent__view__profile__container">
      <div
        onClick={handleHomeNavigation}
        className="back__btn__container cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="back__btn__text">{t("agentProfile.home")}</div>
      </div>
      <div className="agent__profile__detail__container mt-5">
        <InitialsAvatar size="65px" className="mt-2" />
        <div>
          <div className="agent__profile__name">{localStorage.getItem("USER_NAME")}</div>
          <div className="agent__profile__id">{t("agentProfile.agentId")} : {localStorage.getItem("USERNAME")}</div>
        </div>
      </div>
      <AgentProfileCard />
    </div>
  );
};

export default AgentViewProfile;
