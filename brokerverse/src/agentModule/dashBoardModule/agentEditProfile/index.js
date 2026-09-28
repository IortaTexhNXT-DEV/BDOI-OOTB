import React from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import "./index.scss";
import AgentProfileEditCard from "./agentProfileEditCard";
import InitialsAvatar from "../../component/InitialsAvatar";

const AgentEditProfile = () => {
  const { t } = useTranslation();
  return (
    <div className="agent__edit__profile__container">
      <div className="back__btn__container">
        <SvgLeftArrow />
        <div className="back__btn__text">{t("agentProfile.profile")}</div>
      </div>
      <div className="agent__profile__detail__container mt-5">
        <InitialsAvatar size="65px" className="mt-2" />
        <div>
        <div className="agent__profile__name">
        {localStorage.getItem("USER_NAME")}
        </div>
        <div className="agent__profile__id">{t("agentProfile.agentId")} : {localStorage.getItem("USERNAME")}</div>
        </div>
      </div>
      <AgentProfileEditCard/>
    </div>
  )
}

export default AgentEditProfile
