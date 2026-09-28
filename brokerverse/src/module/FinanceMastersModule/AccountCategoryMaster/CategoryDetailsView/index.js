import React, { useState } from "react";
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
import NavBar from "../../../../components/NavBar";

function DepartmentDetailsView() {
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
  const items = [
    { label: "Account Category" },
    { label: "Account Category Details" },
  ];
  const item = [
    { name: "Active", code: "AC" },
    { name: "Comp012", code: "CM" },
    { name: "Branch Code", code: "BC" },
  ];
  const home = { label: "Master" };

  return (
    <div className="overall_category_details_view_container">
      <label className="label_header">Account Category Details</label>
      <div className="next_container">
        <div className="exit_print_buttons">
          <Button className={"buttons__edit"}>
            <div className={"edit__icon"}>
              <SvgEdit />
            </div>
            <div className={"exit__text"}>Edit</div>
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
                value={
                  "A description is a detailed and informative explanation or portrayal of something"
                }
              />
            </div>
          </div>
          <div class="col-6 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Short Description"
                value={"Informative explanation"}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="next_container">
        <Button label="Save & Exit" className="print" onClick={showPopup} />
      </div>
      <div>
        {visiblePopup && (
          <div className="grid custom-modal-overlay">
            <div className="col-10 md:col-2 lg:col-2 custom-modal">
              <div className="popup__text">
                Department code Depart00123 is Successfully added
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
