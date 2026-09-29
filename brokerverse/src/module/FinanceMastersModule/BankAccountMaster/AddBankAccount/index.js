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
import useMasterOptions from "../../../GeneralMasters/common/useMasterOptions";

function AddBankAccount() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  const [accounttype, setAccountType] = useState(null);
  const [currencycode, setCurrencyCode] = useState(null);


  const [visiblePopup, setVisiblePopup] = useState(false);
  const showPopup = () => {
    setVisiblePopup(true);
    setTimeout(() => {
      setVisiblePopup(false);
    }, 4000);
  };
  
  const items = [{ label: t("financeMasters.bankAccount") }, { label: t("financeMasters.addBankAccount") }];
  const status = [
    { name: "Active", code: "NY" },
    { name: "Deactive", code: "RM" },
  ];

  const acctype = [
    { name: "Savings Account", code: "NY" },
    { name: "Profite Account", code: "RM" },
  ];

  // Currency codes from the Currency master (Master > Finance > Currency)
  const code = useMasterOptions("currency", { valueKey: "code", labelKey: "code" });

  const home = { label: t("financeMasters.master") };

  return (
    <div className="overall_addbankaccount_container">
        
      <label className="label_header">{t("financeMasters.addBankAccount")}</label>
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
              options={status}
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
            <InputField
                classNames="field__container"
                label="Bank Name"
                placeholder={"Enter"}
              />
            </div>
          </div>
        </div>

        

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <DropDowns
              className="dropdown__container"
              label="Account Type"
              value={accounttype}
              onChange={(e) => setAccountType(e.value)}
              options={acctype}
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
              value={currencycode}
              onChange={(e) => setCurrencyCode(e.value)}
              options={code}
              optionLabel="label"
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
          <Button label="Save" className="print" onClick={showPopup} />
        </div>
        <div>
          {visiblePopup && (
            <div className="grid custom-modal-overlay">
              <div className="col-10 md:col-2 lg:col-2 custom-modal">
                <div className="popup__text">
                Account  Number 
                <span className="accountnum_text">
                     265478932107 
                    </span>
is Successfully added
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

export default AddBankAccount;
