import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { RadioButton } from "primereact/radiobutton";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import clientService from "../../../services/clientService";
import ProductPicker from "../../../module/Sales/ProductPicker";
import { productOf, useProductLines } from "../../../module/Sales/salesProducts";

const MIN_SEARCH = 3;

/**
 * Create prospect: first whether the customer is new or already a client. For an existing customer the user finds the
 * client by name, mobile number or e-mail, and the prospect is created linked to that client (its details pre-filled,
 * no second client when the quotation converts). Then the line of business and the product, which opens the matching
 * prospect form, or Skip - tag product later (unless leads.product_required), which opens the prospect form without a
 * product.
 */
const CreateProspectDialog = ({ visible, onHide, onProduct, onSkip, productRequired = false }) => {
  const { t } = useTranslation();
  const lines = useProductLines({ enabled: visible });
  const [choice, setChoice] = useState({ lob: null, productId: null });
  const [kind, setKind] = useState("new");
  const [step, setStep] = useState("kind");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!visible) {
      setKind("new");
      setStep("kind");
      setTerm("");
      setResults([]);
      setClient(null);
      setSearchError("");
      setChoice({ lob: null, productId: null });
    }
  }, [visible]);

  // search as the user types, once there is enough to search on
  useEffect(() => {
    if (step !== "search" || term.trim().length < MIN_SEARCH) {
      setResults([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      const r = await clientService.searchClients(term.trim());
      if (!active) return;
      setSearching(false);
      setSearchError(r.success ? "" : r.error);
      setResults(r.success ? r.data : []);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, step]);

  const next = () => setStep(kind === "existing" ? "search" : "product");
  const back = () => setStep(step === "product" && kind === "existing" ? "search" : "kind");
  const product = productOf(lines, choice.productId);

  const footer = (
    <div className="flex justify-content-between w-full">
      <Button type="button" label={step === "kind" ? t("prospectChooser.cancel") : t("prospectChooser.back")} text onClick={step === "kind" ? onHide : back} />
      {step === "kind" && <Button type="button" label={t("prospectChooser.continue")} onClick={next} />}
      {step === "search" && <Button type="button" label={t("prospectChooser.useClient")} onClick={() => setStep("product")} disabled={!client} />}
      {step === "product" && (
        <div className="flex gap-2">
          {!productRequired && <Button type="button" label={t("productPicker.skip")} icon="pi pi-clock" outlined onClick={() => onSkip(client)} />}
          <Button type="button" label={t("prospectChooser.continue")} icon="pi pi-check" onClick={() => onProduct(product, client)} disabled={!product} />
        </div>
      )}
    </div>
  );

  return (
    <Dialog header={t("prospectChooser.title")} visible={visible} onHide={onHide} style={{ width: "42rem" }} footer={footer} className="prospect-chooser">
      {step === "kind" && (
        <div className="flex flex-column gap-3">
          <p className="m-0 text-color-secondary">{t("prospectChooser.kindQuestion")}</p>
          {["new", "existing"].map((k) => (
            <label key={k} htmlFor={`kind-${k}`} className="flex align-items-start gap-2 cursor-pointer">
              <RadioButton inputId={`kind-${k}`} name="kind" value={k} checked={kind === k} onChange={(e) => setKind(e.value)} />
              <span>
                <strong className="block">{t(`prospectChooser.${k}`)}</strong>
                <small className="text-color-secondary">{t(`prospectChooser.${k}Hint`)}</small>
              </span>
            </label>
          ))}
        </div>
      )}

      {step === "search" && (
        <div className="flex flex-column gap-2">
          <label htmlFor="client-search">{t("prospectChooser.searchLabel")}</label>
          <span className="p-input-icon-left w-full">
            <i className={searching ? "pi pi-spin pi-spinner" : "pi pi-search"} />
            <InputText id="client-search" value={term} onChange={(e) => setTerm(e.target.value)} className="w-full" placeholder={t("prospectChooser.searchPlaceholder")} autoFocus />
          </span>
          {searchError && <small className="p-error">{searchError}</small>}
          <DataTable
            value={results}
            size="small"
            dataKey="clientId"
            selectionMode="single"
            selection={client}
            onSelectionChange={(e) => setClient(e.value)}
            emptyMessage={term.trim().length < MIN_SEARCH ? t("prospectChooser.typeMore") : t("prospectChooser.noMatch")}
            scrollable
            scrollHeight="16rem"
          >
            <Column field="generatedClientId" header={t("prospectChooser.clientCode")} style={{ width: "9rem" }} />
            <Column field="displayName" header={t("prospectChooser.name")} />
            <Column field="contactNumber" header={t("prospectChooser.mobile")} />
            <Column field="emailId" header={t("prospectChooser.email")} />
          </DataTable>
        </div>
      )}

      {step === "product" && (
        <div className="flex flex-column gap-2">
          {client && (
            <p className="m-0 mb-2">
              {t("prospectChooser.linkedTo", { name: client.displayName, code: client.generatedClientId })}
            </p>
          )}
          <p className="m-0 mb-2 text-color-secondary">{t("prospectChooser.productQuestion")}</p>
          <ProductPicker value={choice} onChange={setChoice} lines={lines} idPrefix="create-prospect" required={productRequired} autoFocus />
          {!productRequired && <small className="text-color-secondary mt-2">{t("productPicker.skipHint")}</small>}
        </div>
      )}
    </Dialog>
  );
};

CreateProspectDialog.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  /** (product, client|null): the product chosen opens its prospect form */
  onProduct: PropTypes.func.isRequired,
  /** (client|null): the prospect form without a product */
  onSkip: PropTypes.func.isRequired,
  /** leads.product_required: no Skip */
  productRequired: PropTypes.bool,
};

export default CreateProspectDialog;
