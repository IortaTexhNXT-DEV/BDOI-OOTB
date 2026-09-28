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
import SvgEdit from '../../../../assets/icons/SvgEdit';
import NavBar from "../../../../components/NavBar";

function BranchDetailsView() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState({name:'Active',code: "AC"});
  const [selected2, setSelected2] = useState({name:'Design',code: "DS"});
  const [selected3, setSelected3] = useState({name:'John doe',code: "JD"});
  const [selected4, setSelected4] = useState({name:'Madurai',code: "MD"});
  const [selected5, setSelected5] = useState({name:'Tamil Nadu',code: "TN"});
  const [selected6, setSelected6] = useState({name:'Thailand',code: "TH"});
  const [visiblePopup, setVisiblePopup] = useState(false);
  const showPopup = () => {
    setVisiblePopup(true);
    setTimeout(() => {
      setVisiblePopup(false);
    }, 1000);
  };
  const items = [{ label: "Branch" }, { label: "Add Branch" }];
  const item = [
    { name: "Active", code: "AC" },
    { name: "Design", code: "DS" },
    { name: "John doe", code: "JD" },
    { name: "Madurai", code: "MD" },
    { name: "Tamil Nadu", code: "TN" },
    { name: "Thailand", code: "TH" },
  ];
  const home = { label: t("financeMasters.master") };

  return (
    <div className="overall_branch_details_view_container">
      
      <label className="label_header">Branch Details</label>
      <div className="next_container">
        <div className="exit_print_buttons">
          <Button className={'buttons__edit'}>
          <div className={'edit__icon'}>
                        <SvgEdit />
                    </div>
                    <div className={'exit__text'}>{t("financeMasters.edit")}</div>
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
                label="Branch Code"
                placeholder={"Enter"}
              />
            </div>
          </div>
          <div class="sm-col-12  md:col-3 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label="Email ID (Branch Email ID)"
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

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Company Name"
              value={selected2}
              onChange={(e) => setSelected2(e.value)}
              options={item}
              optionLabel="name"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Manager"
              value={selected3}
              onChange={(e) => setSelected3(e.value)}
              options={item}
              optionLabel="name"
             
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label="Address Line 1"
              placeholder={"Enter"}
            />
          </div>
          <div class="sm-col-12  md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label="Address Line 2"
              placeholder={"Enter"}
            />
          </div>
        </div>
        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="City"
              value={selected4}
              onChange={(e) => setSelected4(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="State"
              value={selected5}
              onChange={(e) => setSelected5(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Country"
              value={selected6}
              onChange={(e) => setSelected6(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Enter"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div class="sm-col-12  md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label="Phone Number"
              placeholder={"Enter"}
            />
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
                  Branch code Branch00123 is Successfully added
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

export default BranchDetailsView;
