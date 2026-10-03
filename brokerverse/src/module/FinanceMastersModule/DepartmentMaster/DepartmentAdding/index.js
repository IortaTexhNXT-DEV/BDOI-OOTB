import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../components/InputField";
import SvgDot from "../../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import DropDowns from "../../../../components/DropDowns";
import { Card } from "primereact/card";
import SuccessIcon from "../../../../assets/icons/SuccessIcon";

function DepartmentAdding() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  const [visiblePopup, setVisiblePopup] = useState(false);
  const showPopup = () => {
    setVisiblePopup(true);
    setTimeout(() => {
      setVisiblePopup(false);
    }, 1000);
  };
  const items = [{ label: t("financeMasters.department") }, { label: t("financeMasters.addDepartment") }];
  const item = [
    { name: "New York", code: "NY" },
    { name: "Rome", code: "RM" },
    { name: "London", code: "LDN" },
    { name: "Istanbul", code: "IST" },
    { name: "Paris", code: "PRS" },
  ];
  const home = { label: t("financeMasters.master") };

  return (
    <div className="overall_department-adding_container">
      <label className="label_header">{t("financeMasters.addDepartment")}</label>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />
      <Card>
        <div class="grid">
          <div class="sm-col-12  md:col-3 lg-col-4 col-offset-9">
            <DropDowns
              className="dropdown__container"
              label={t("common.status")}
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label="Department Code"
                placeholder={"Enter"}
              />
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="col-6 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.description")}
                placeholder={t("financeMasters.enter")}
              />
            </div>
          </div>
          <div class="col-6 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.shortDescription")}
                placeholder={t("financeMasters.enter")}
              />
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Company Code"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div class="col-3 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.companyDescription")}
                placeholder={t("financeMasters.enter")}
              />
            </div>
          </div>

          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Branch Code"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.branchDescription")}
              placeholder={t("financeMasters.enter")}
            />
          </div>
        </div>
      </Card>

      <div className="next_container">
        <div className="exit_print_buttons">
          <Button label={t("financeMasters.save")} className="print" onClick={showPopup} />
        </div>
        <div>
          {visiblePopup && (
            <div className="grid custom-modal-overlay">
              <div className="col-10 md:col-2 lg:col-2 custom-modal">
                <div className="popup__text">
                  {t("financeMasters.departmentCodeAdded")}
                </div>
                <div className="popup__icon">
                  <SuccessIcon />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DepartmentAdding;
