import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "../index.scss";
import { Card } from "primereact/card";
import DropdownField from "../../../component/DropdwonField";
import InputTextField from "../../../component/inputText";
import { RadioButton } from "primereact/radiobutton";
import DatepickerField from "../../../component/datePicker";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";

const LeadEditCrad = ({ flow }) => {
  const { t } = useTranslation();
  const [ingredient, setIngredient] = useState();
  const navigate = useNavigate();
  const handleclick = () => {
    navigate("/agent/leadlisting");
  };

  const handlecancel = () => {
    navigate("/agent/leadlisting");
  };

  return (
    <div className="edit__card_overall_container mt-5">
      <Card title={flow === "lead" ? t("leadEdit.editLead") : t("leadEdit.editClient")}>
        <div className="category__container mt-4">
          <div className="category__text">{t("leadCreation.categoryColon")}</div>
          <div className="category__id">{t("leadEdit.individual")}</div>
        </div>
        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.firstName")} />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.lastName")} />
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.preferredName")} />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <DatepickerField label={t("leadEdit.dateOfBirth")} />
          </div>
        </div>

        <div className="subheadinglabel_txt mt-3">{t("leadEdit.selectGender")}</div>
        <div className="flex flex-wrap gap-3  mt-3">
          <div className="flex align-items-center">
            <RadioButton
              inputId="ingredient1"
              name="pizza"
              value="Cheese"
              onChange={(e) => setIngredient(e.value)}
              checked={ingredient === "Cheese"}
            />
            <label htmlFor="ingredient1" className="labeltxt_container">
              {t("leadCreation.male")}
            </label>
          </div>
          <div className="flex align-items-center">
            <RadioButton
              inputId="ingredient2"
              name="pizza"
              value="Mushroom"
              onChange={(e) => setIngredient(e.value)}
              checked={ingredient === "Mushroom"}
            />
            <label htmlFor="ingredient2" className="labeltxt_container">
              {t("leadCreation.female")}
            </label>
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.emailId")} />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.contactNumber")} />
          </div>
        </div>
        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.houseNoStreet")} />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.barangaySubd")} />
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <DropdownField label={t("leadEdit.country")} />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <DropdownField label={t("leadEdit.province")} />
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <DropdownField label={t("leadEdit.city")} />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("leadEdit.zipCode")} />
          </div>
        </div>

        <div className="save_continue_conatiner">
          <Button
            label={t("common.cancel")}
            onClick={() => {
              handlecancel();
            }}
            text
            className="btn_lable_container"
          />
          <div className="btn_lable_save_container">
            <Button
              onClick={() => {
                handleclick();
              }}
              label={t("leadEdit.update")}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LeadEditCrad;
