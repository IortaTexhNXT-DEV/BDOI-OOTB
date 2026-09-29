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
import SvgEditicon from "../../../../assets/icons/SvgEdit";
import NavBar from "../../../../components/NavBar";



function BankChequeDetails() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  const [visiblePopup, setVisiblePopup] = useState(false);
  const showPopup = () => {
    setVisiblePopup(true);
    setTimeout(() => {
      setVisiblePopup(false);
    }, 4000);
  };
  
  const items = [{ label: t("financeMasters.bankCheque") }, { label: t("financeMasters.bankChequeDetails") }];
  const item = [
    { name: "New York", code: "NY" },
    { name: "Rome", code: "RM" },
    { name: "London", code: "LDN" },
    { name: "Istanbul", code: "IST" },
    { name: "Paris", code: "PRS" },
  ];
  const home = { label: t("financeMasters.master") };

  return (
    <div className="overall_bankchequedetail_container">
      
      <div className="bankaccountedit_container">
        <div>
      <label className="label_header">{t("financeMasters.bankChequeDetails")}</label>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />
</div>
<div>
<div className="addbutton_container"  >
          <SvgEditicon className="addicon" />
          <p className="addtext">{t("financeMasters.edit")}</p>
             </div>
</div>
</div>
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
          <div class="col-3 md:col-3 lg-col-3">
          <InputField
                classNames="field__container"
                label="Cheque Book Number"
                placeholder={"Enter"}
              />
            
          </div>
          <div class="col-3 md:col-3 lg-col-3">
          <DropDowns
              className="dropdown__container"
              label="Bank Name"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
          <DropDowns
              className="dropdown__container"
              label="Account Number"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="sm-col-12  md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label="Cheque Leaf Begin"
              placeholder={"Enter"}
            />
          </div>
        </div>
        <div class="grid">
          

          <div class="sm-col-12  md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label="Cheque Leaf End"
              placeholder={"Enter"}
            />
          </div>
        </div>
      </Card>

      <div className="next_container">
        <div className="exit_print_buttons">
          <Button label="Save & Exit" className="print" onClick={showPopup} />
        </div>
       
      </div>
    </div>
  );
}

export default BankChequeDetails;
