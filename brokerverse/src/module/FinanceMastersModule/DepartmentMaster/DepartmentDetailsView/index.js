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
import SvgEdit from "../../../../assets/icons/SvgEdit";

function DepartmentDetailsView() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState({
    name: "Active",
    code: "AC",
  });
  const [selected2, setSelected2] = useState({ name: "Comp012", code: "CM" });
  const [selected3, setSelected3] = useState({
    name: "Branch Code",
    code: "BC",
  });
  const [visiblePopup, setVisiblePopup] = useState(false);
  const showPopup = () => {
    setVisiblePopup(true);
    setTimeout(() => {
      setVisiblePopup(false);
    }, 1000);
  };
  const items = [{ label: t("financeMasters.department") }, { label: t("financeMasters.departmentDetails") }];
  const item = [
    { name: "Active", code: "AC" },
    { name: "Comp012", code: "CM" },
    { name: "Branch Code", code: "BC" },
  ];
  const home = { label: t("financeMasters.master") };

  return (
    <div className="overall_department_details_view_container">
      <label className="label_header">Department Details</label>
      <div className="next_container">
        <div className="exit_print_buttons">
          <Button className={"buttons__edit"}>
            <div className={"edit__icon"}>
              <SvgEdit />
            </div>
            <div className={"exit__text"}>{t("financeMasters.edit")}</div>
          </Button>
        </div>
      </div>
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
                label={t("financeMasters.departmentCode")}
                value={"Depart0012"}
              />
            </div>
          </div>
          <div class="col-6 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.description")}
                value={"Lorem ipsum"}
              />
            </div>
          </div>
          <div class="sm-col-12  md:col-3 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label="Short Description"
                value={"Lorem ipsum"}
              />
            </div>
          </div>
        </div>

        <div class="grid" style={{ marginTop: "10px" }}>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label={t("financeMasters.companyCode")}
              value={selected2}
              onChange={(e) => setSelected2(e.value)}
              options={item}
              optionLabel="name"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label={t("financeMasters.companyDescription")}
              value={"Lorem Ipsum"}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Branch Code"
              value={selected3}
              onChange={(e) => setSelected3(e.value)}
              options={item}
              optionLabel="name"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div class="sm-col-12  md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label={t("financeMasters.branchDescription")}
              value={"Lorem ipsum"}
            />
          </div>
        </div>
      </Card>

      <div className="next_container">
        <Button label={t("financeMasters.saveAndExit")} className="print" onClick={showPopup} />
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
  );
}

export default DepartmentDetailsView;
