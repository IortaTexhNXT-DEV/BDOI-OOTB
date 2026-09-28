import React, { useState } from "react";
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
import NavBar from "../../../../components/NavBar";

function CategoryAdding() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  const [visiblePopup, setVisiblePopup] = useState(false);
  const showPopup = () => {
    setVisiblePopup(true);
    setTimeout(() => {
      setVisiblePopup(false);
    }, 1000);
  };
  const items = [
    { label: "Account Category" },
    { label: "Add Account Category" },
  ];
  const item = [
    { name: "New York", code: "NY" },
    { name: "Rome", code: "RM" },
    { name: "London", code: "LDN" },
    { name: "Istanbul", code: "IST" },
    { name: "Paris", code: "PRS" },
  ];
  const home = { label: "Master" };

  return (
    <div className="overall_category-adding_container">
      <label className="label_header">Account Category Master</label>
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
              label="Status"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label="Account Category Code"
                value={"Acc00123"}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label="Account Category Name"
                value={"Income"}
              />
            </div>
          </div>
        </div>

        <div class="grid" style={{ marginTop: "8px" }}>
          <div class="col-6 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Description"
                placeholder={"Enter"}
              />
            </div>
          </div>
          <div class="col-6 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Short Description"
                placeholder={"Enter"}
              />
            </div>
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
                  Account Category code Acc00123 is Successfully added
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

export default CategoryAdding;
