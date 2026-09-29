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
import SvgEditicon from "../../../../assets/icons/SvgEdit";
function BankAccountdetails() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  
  const items = [{ label: t("financeMasters.bankAccount") }, { label: t("financeMasters.bankAccountDetails") }];
  const item = [
    { name: "New York", code: "NY" },
    { name: "Rome", code: "RM" },
    { name: "London", code: "LDN" },
    { name: "Istanbul", code: "IST" },
    { name: "Paris", code: "PRS" },
  ];
  const home = { label: "Master" };

  return (
    <div className="overall_bankaccountdetail_container">
        
        <div className="bankaccountedit_container">
        <div>
      <label className="label_header">{t("financeMasters.bankAccountDetails")}</label>
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
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label="Account Number"
                placeholder={"Enter"}
              />
            </div>
          </div>
          <div class="sm-col-12  md:col-6 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label="Account Name"
                placeholder={"Enter"}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
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
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Account Type"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
          <InputField
                classNames="field__container"
                label="Account Type description"
                placeholder={"Enter"}
              />
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
          <DropDowns
              className="dropdown__container"
              label="Currency Code"
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
              label="Currency Description"
              placeholder={"Enter"}
            />
          </div>
        </div>
        <div class="grid">

          <div class="sm-col-12  md:col-3 lg-col-4">
            <InputField
              classNames="field__container"
              label="Maximum Transaction Limit"
              placeholder={"Enter"}
            />
          </div>
        </div>
      </Card>

      <div className="next_container">
        <div className="exit_print_buttons">
          <Button label="Save & Exit" className="print" />
        </div>
        <div>
          
        </div>
      </div>
    </div>
  );
}

export default BankAccountdetails;
