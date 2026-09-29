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

function AddBankCheque() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  const [accountype, setAccountype] = useState(null);
  const [bankname, setBankname] = useState(null);
 
  const [visiblePopup, setVisiblePopup] = useState(false);
  
  
  
  
  const showPopup = () => {
    setVisiblePopup(true);
    setTimeout(() => {
      setVisiblePopup(false);
    }, 4000);
  };
  
  const items = [{ label: t("financeMasters.bankCheque") }, { label: t("financeMasters.addBankCheque") }];
  const status = [
    { name: "Active", code: "NY" },
    { name: "Deactive", code: "RM" },
  ];
  const bank = [
    { name: "MoneyBank", code: "MB" },
    { name: "loanBank", code: "LB" },
  ];
  const account = [
    { name: "265432107", code: "MB" },
    { name: "2654789", code: "LB" },
  ];
  const home = { label: t("financeMasters.master") };

  return (
    <div className="overall_addbankcheque_container">
      
      <label className="label_header">{t("financeMasters.addBankCheque")}</label>
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
              value={bankname}
              onChange={(e) => setBankname(e.value)}
              options={bank}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
          <DropDowns
              className="dropdown__container"
              label="Account Number"
              value={accountype}
              onChange={(e) => setAccountype(e.value)}
              options={account}
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
          <Button label={t("financeMasters.save")} className="print" onClick={showPopup} />
        </div>
        <div>
          {visiblePopup && (
            <div className="grid custom-modal-overlay">
              <div className="col-10 md:col-2 lg:col-2 custom-modal">
                <div className="popup__text">
                Cheque Book Number 
                <div className="accountnum_text">
                     265478932107 
                    </div>
                    
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

export default AddBankCheque;
