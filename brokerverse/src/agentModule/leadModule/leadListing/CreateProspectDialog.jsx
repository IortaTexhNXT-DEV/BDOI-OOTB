import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { RadioButton } from "primereact/radiobutton";
import clientService from "../../../services/clientService";
import ProductPicker from "../../../module/Sales/ProductPicker";
import { productOf, useProductLines } from "../../../module/Sales/salesProducts";
import "./CreateProspectDialog.scss";

const MIN_SEARCH = 3;
const PAGE = 10;

const clientName = (c) => c.displayName || c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.companyName || "";
const clientKey = (c) => c.clientId || c.id;

/**
 * Clients found by the search, as a list with one row per client: client code, name (with the city), mobile number and
 * e-mail in fixed columns, long values cut with the full value as a tooltip. A click or the arrow keys select a row
 * (radio and highlight); Enter or a double click uses the client. No match offers to create a new customer instead.
 */
export const ClientResults = ({ results, selected, onSelect, onUse, onCreateNew, term, searching, listRef }) => {
  const { t } = useTranslation();
  if (term.trim().length < MIN_SEARCH) return <p className="client-results__state">{t("prospectChooser.typeMore")}</p>;
  if (searching && !results.length) return <p className="client-results__state">{t("prospectChooser.searching")}</p>;
  if (!results.length) {
    return (
      <div className="client-results__state client-results__state--empty">
        <i className="pi pi-search" aria-hidden="true" />
        <p className="m-0">{t("prospectChooser.noMatch", { term: term.trim() })}</p>
        <Button type="button" label={t("prospectChooser.createNew")} icon="pi pi-user-plus" outlined size="small" onClick={onCreateNew} />
      </div>
    );
  }
  const index = results.findIndex((c) => selected && clientKey(c) === clientKey(selected));
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? Math.min(results.length - 1, index + 1) : Math.max(0, index - 1);
      onSelect(results[next]);
      listRef.current?.querySelectorAll("[role=option]")[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && selected) {
      e.preventDefault();
      onUse(selected);
    }
  };
  const cell = (value, className) => (
    <span className={`client-results__cell ${className}`} title={value || undefined}>{value || "-"}</span>
  );
  return (
    <div className="client-results">
      <div className="client-results__head" aria-hidden="true">
        <span className="client-results__cell client-results__radio" />
        <span className="client-results__cell client-results__code">{t("prospectChooser.clientCode")}</span>
        <span className="client-results__cell client-results__name">{t("prospectChooser.name")}</span>
        <span className="client-results__cell client-results__mobile">{t("prospectChooser.mobile")}</span>
        <span className="client-results__cell client-results__email">{t("prospectChooser.email")}</span>
      </div>
      <ul className="client-results__list" role="listbox" aria-label={t("prospectChooser.resultsLabel")} tabIndex={0} ref={listRef} onKeyDown={onKeyDown}
        aria-activedescendant={index >= 0 ? `client-option-${index}` : undefined}>
        {results.map((c, i) => {
          const on = i === index;
          const where = [c.city, c.province].filter(Boolean).join(", ");
          return (
            <li key={clientKey(c)} id={`client-option-${i}`} role="option" aria-selected={on} className={`client-results__row${on ? " is-selected" : ""}`}
              onClick={() => onSelect(c)} onDoubleClick={() => onUse(c)}>
              <span className="client-results__cell client-results__radio">
                <RadioButton inputId={`client-radio-${i}`} name="client" value={clientKey(c)} checked={on} onChange={() => onSelect(c)} tabIndex={-1}
                  aria-label={clientName(c)} />
              </span>
              {cell(c.generatedClientId || c.clientCode, "client-results__code")}
              <span className="client-results__cell client-results__name" title={[clientName(c), where].filter(Boolean).join(" - ")}>
                <span className="client-results__primary">{clientName(c)}</span>
                {where ? <span className="client-results__secondary">{where}</span> : null}
              </span>
              {cell(c.contactNumber || c.phone, "client-results__mobile")}
              {cell(c.emailId || c.email, "client-results__email")}
            </li>
          );
        })}
      </ul>
      <small className="client-results__count">
        {results.length >= PAGE ? t("prospectChooser.moreResults", { count: results.length }) : t("prospectChooser.resultCount", { count: results.length })}
      </small>
    </div>
  );
};

ClientResults.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
  selected: PropTypes.object,
  onSelect: PropTypes.func.isRequired,
  onUse: PropTypes.func.isRequired,
  onCreateNew: PropTypes.func.isRequired,
  term: PropTypes.string.isRequired,
  searching: PropTypes.bool,
  listRef: PropTypes.object,
};

/**
 * Create prospect: first whether the customer is new or already a client. For an existing customer the user finds the
 * client by name, mobile number or e-mail, and the prospect is created linked to that client (its details pre-filled,
 * no second client when the quotation converts); no match offers a new customer instead. Then the line of business and
 * the product, which opens the matching prospect form, or Skip - tag product later (unless leads.product_required),
 * which opens the prospect form without a product.
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
  const listRef = useRef(null);

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
      setSearching(false);
      return undefined;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const r = await clientService.searchClients(term.trim());
      if (!active) return;
      setSearching(false);
      setSearchError(r.success ? "" : r.error);
      const found = r.success ? r.data : [];
      setResults(found);
      // keep the selection only while the client is still in the results
      setClient((c) => (c && found.some((x) => clientKey(x) === clientKey(c)) ? c : null));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, step]);

  const next = () => setStep(kind === "existing" ? "search" : "product");
  const back = () => setStep(step === "product" && kind === "existing" ? "search" : "kind");
  const pickClient = (c) => {
    setClient(c);
    setStep("product");
  };
  const createNew = () => {
    setKind("new");
    setClient(null);
    setStep("product");
  };
  const onSearchKey = (e) => {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setClient(client || results[0]);
      listRef.current?.focus();
    } else if (e.key === "Enter" && client) {
      e.preventDefault();
      pickClient(client);
    }
  };
  const product = productOf(lines, choice.productId);

  const footer = (
    <div className="flex justify-content-between w-full">
      <Button type="button" label={step === "kind" ? t("prospectChooser.cancel") : t("prospectChooser.back")} text onClick={step === "kind" ? onHide : back} />
      {step === "kind" && <Button type="button" label={t("prospectChooser.continue")} onClick={next} />}
      {step === "search" && <Button type="button" label={t("prospectChooser.useClient")} icon="pi pi-check" onClick={() => pickClient(client)} disabled={!client} />}
      {step === "product" && (
        <div className="flex gap-2">
          {!productRequired && <Button type="button" label={t("productPicker.skip")} icon="pi pi-clock" outlined onClick={() => onSkip(kind === "existing" ? client : null)} />}
          <Button type="button" label={t("prospectChooser.continue")} icon="pi pi-check" onClick={() => onProduct(product, kind === "existing" ? client : null)} disabled={!product} />
        </div>
      )}
    </div>
  );

  return (
    <Dialog header={t("prospectChooser.title")} visible={visible} onHide={onHide} style={{ width: "46rem" }} breakpoints={{ "768px": "96vw" }} footer={footer} className="prospect-chooser">
      {step === "kind" && (
        <div className="flex flex-column gap-3">
          <p className="m-0 text-color-secondary">{t("prospectChooser.kindQuestion")}</p>
          {["new", "existing"].map((k) => (
            <label key={k} htmlFor={`kind-${k}`} className={`prospect-chooser__kind${kind === k ? " is-selected" : ""}`}>
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
          <label htmlFor="client-search" className="font-semibold">{t("prospectChooser.searchLabel")}</label>
          <span className="p-input-icon-left w-full">
            <i className={searching ? "pi pi-spin pi-spinner" : "pi pi-search"} />
            <InputText id="client-search" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={onSearchKey} className="w-full"
              placeholder={t("prospectChooser.searchPlaceholder")} autoFocus autoComplete="off" />
          </span>
          {searchError && <small className="p-error">{searchError}</small>}
          <ClientResults results={results} selected={client} onSelect={setClient} onUse={pickClient} onCreateNew={createNew} term={term} searching={searching} listRef={listRef} />
        </div>
      )}

      {step === "product" && (
        <div className="flex flex-column gap-2">
          {kind === "existing" && client && (
            <p className="m-0 mb-2">
              {t("prospectChooser.linkedTo", { name: clientName(client), code: client.generatedClientId || client.clientCode })}
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
