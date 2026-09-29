import { Card } from "primereact/card";
import React from "react";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText/index";
import { Button } from "primereact/button";

const AgentProfileEditCard = () => {
  const { t } = useTranslation();
  return (
    <div>
    <Card className="mt-5">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.firstName")} />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.lastName")} />
        </div>
      </div>
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.preferredName")} />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.dateOfBirth")} />
        </div>
      </div>
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.gender")} />
        </div>
      </div>
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.emailId")} />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.contactNumber")} />
        </div>
      </div>
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.houseNoStreet")} />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.barangaySubd")} />
        </div>
      </div>
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.country")} />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.province")} />
        </div>
      </div>
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.city")} />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField label={t("agentProfile.zipCode")} />
        </div>
      </div>
      <div className="profile__container__btn mt-2">
          <Button
            label={t("agentProfile.editProfile")}
            className="profile__container__add__btn"
            aria-controls="popup_menu_right"
            aria-haspopup
          />
        </div>
    </Card>
  </div>
  )
}

export default AgentProfileEditCard
