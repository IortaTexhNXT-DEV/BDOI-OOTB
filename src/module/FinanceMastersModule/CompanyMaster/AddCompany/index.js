import React, { useState } from "react";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import InputField from "../../../../components/InputField";
import DropDowns from "../../../../components/DropDowns";
import { Card } from "primereact/card";
import "../index.scss";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";

const AddCompany = () => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [checked, setChecked] = useState(false);

  const item = [
    { label: "Initiate" },
    { label: "Request" },
    { label: "Disbursement" },
    { label: "Disbursement" },
    { label: "Replenish" },
    
  ];
  const items = [
    { label: "Company", url: "/master/finance/company" },
    { label: "Add Company", url: "/master/finance/company/addcompany" },
  ];
  const Initiate = { label: "Master" };

  return (
    <div style={{ color: "black" }} className="company__container">
      <div className="grid  m-0">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="pettycash__title">Add Company</div>
          <div>
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
      </div>
      <Card>
        <div class="grid">
          <div class="col-12 sm:col-12  md:col-3 lg-col-4 col-offset-9">
            <DropDowns
              className="input__view__request__1"
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
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Company Code"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Company Name"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="License Number"
              placeholder="Enter here"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Accounting Period"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Description"
              placeholder="00123"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Short Description"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <DropDowns
              className="input__view__request__1"
              label="Currency Code"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Email ID"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Address Line 1"
              placeholder="Enter here"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Address Line 2"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <DropDowns
              className="input__view__request__1"
              label="City"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-3 input__view">
            <DropDowns
              className="input__view__request__1"
              label="State"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-3 input__view">
            <DropDowns
              className="input__view__request__1"
              label="Country"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.value)}
              options={item}
              optionLabel="name"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Phone Number"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <div className="title__uploade">Logo</div>
            <div className="uploade__btn">
              <Button label="Upload" className="upload__btn" />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-9 input__view">
            <InputField
              classNames="input__filed"
              label="Website link"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div
            className="col-12 md:col-12 lg:col-12"
            style={{ display: "flex" }}
          >
            <Checkbox
              onChange={(e) => setChecked(e.checked)}
              checked={checked}
            ></Checkbox>
            <div style={{ marginLeft: "1%" }}>Add Additional Fields</div>
          </div>
        </div>
        <div className="hiden__input grid mt-2" >
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Company Code"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>

          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Company Name"
              placeholder="Enter"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
            />
          </div>
        </div>
      </Card>
      <div className="grid mt-2">
        <div
          className="col-12 md:col-12 lg:col-12"
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <Button label="Save" className="save__btn" />
        </div>
      </div>
    </div>
  );
};

export default AddCompany;
