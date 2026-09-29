import React, { useState, useEffect } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SubmitButton from "../../../components/SubmitButton";
import SvgEdit from "../../../assets/icons/SvgEdit";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProductService } from "./mock";
import SvgDot from "../../../assets/icons/SvgDot";
import { Paginator } from "primereact/paginator";

function SpecificVoucher() {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    ProductService.getProductsMini().then((data) => setProducts(data));
  }, []);

  const items = [{ label: "Accounts" }, { label: "Payment Voucher" }];
  const home = { label: "Dashboard" };

  return (
    <div className="overall__payall__container">
      <label className="label_header">Payment Voucher</label>

      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <div class="grid">
        <div class="sm-col-12 col-12 md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Branch" />
          </div>
        </div>
        <div class="sm-col-12  md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Department" />
          </div>
        </div>
        <div class="sm-col-12  md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Document Date" />
          </div>
        </div>
        <div class="col-12 md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Document Number" />
          </div>
        </div>
        <div class="col-12 md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Criteria" />
          </div>
        </div>

        <div class="col-12 md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Criteria" />
          </div>
        </div>
        <div class="col-12 md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Criteria" />
          </div>
        </div>
        <div class="col-12 md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Criteria" />
          </div>
        </div>
        <div class="col-12 md:col-3 lg-col-2-5">
          <div>
            <InputField classNames="field__container" label="Criteria" />
          </div>
        </div>
      </div>

      <div className="next_container">
        {/* <label className='label_subheader'>Payment Voucher History</label> */}
        <Button label="Edit" icon={<SvgEdit />} className="submit_button" />
      </div>

      <div className="card">
        <DataTable
          value={products}
          tableStyle={{ minWidth: "50rem" }}
          paginator
          rows={5}
          rowsPerPageOptions={[5, 10, 25, 50]}
          paginatorTemplate=" FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          scrollable={true}
          scrollHeight="40vh"
        >
          <Column
            selectionMode="multiple"
            headerStyle={{ width: "3rem" }}
          ></Column>
          <Column field="code" header="Trans.code"></Column>
          <Column field="name" header="Document No"></Column>
          <Column field="category" header="O/s Amount"></Column>
          <Column
            field="quantity"
            header="Payment Adjusted
FC Amount"
          ></Column>
          <Column
            field="code"
            header="Payment Adjusted
LC Amount"
          ></Column>
          <Column
            field="name"
            header="Advance Adjusted
Amount"
          ></Column>
          <Column
            field="category"
            header="Balance Adjusted
Amount"
          ></Column>
          <Column field="quantity" header="VAT%"></Column>
          <Column field="code" header="WHT%"></Column>
          <Column field="name" header="Exp Amount"></Column>
        </DataTable>
      </div>

      <div className="buttonheader_container">
        <Button
          type="button"
          label="Back"
          outlined
          className="Back_container"
        />
        <Button type="button" label="Next" className="submit_button" />
      </div>
    </div>
  );
}

export default SpecificVoucher;
