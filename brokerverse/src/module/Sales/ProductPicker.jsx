import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { lineOf, narrowLines, productOf, useProductLines } from "./salesProducts";
import "./index.scss";

/** The value a line gives when it is chosen: its single product, if it has only one. */
const lineSelection = (line) => {
  const only = line?.products.length === 1 ? line.products[0] : null;
  return { lob: line ? line.code : null, productId: only ? only.id : null, product: only };
};

/**
 * The product picker of every screen where a product is chosen for a prospect, a quotation or a placement: first the
 * line of business (active lines that have active products), then the active products of that line. A line with a
 * single product selects it. value { lob, productId }; onChange({ lob, productId, product }) with the line code and the
 * product chosen (null while none). lines (from useProductLines, null while loading) may be given by a screen that
 * already loads them.
 */
const ProductPicker = ({ value = null, onChange, lines: given, businessType, keep, idPrefix = "product-picker", required = false, disabled = false,
  stacked = false, autoFocus = false, emptyText }) => {
  const { t } = useTranslation();
  const loaded = useProductLines({ businessType, enabled: given === undefined });
  const source = given === undefined ? loaded : given;
  const lines = narrowLines(source, keep);
  // nothing active at all, or nothing this screen offers
  const empty = emptyText || (source?.length ? t("productPicker.noneOffered") : t("productPicker.none"));
  const [lineCode, setLineCode] = useState(null);
  const valueLine = lineOf(lines, value || {})?.code || null;

  useEffect(() => {
    if (valueLine) setLineCode(valueLine);
  }, [valueLine]);

  const line = (lines || []).find((l) => l.code === lineCode) || null;
  const products = line?.products || [];

  const chooseLine = (code) => {
    setLineCode(code || null);
    onChange(lineSelection((lines || []).find((l) => l.code === code)));
  };

  // a screen with a single line offers it at once
  const single = lines?.length === 1 && !lineCode && !value?.lob && !value?.productId ? lines[0] : null;
  useEffect(() => {
    if (!single) return;
    setLineCode(single.code);
    onChange(lineSelection(single));
  }, [single, onChange]);

  const chooseProduct = (id) => {
    const product = productOf([line].filter(Boolean), id);
    onChange({ lob: lineCode, productId: product ? product.id : null, product });
  };

  const lineId = `${idPrefix}-line`;
  const productId = `${idPrefix}-product`;
  return (
    <div className={`product-picker${stacked ? " product-picker--stacked" : ""}`}>
      <div className="product-picker__field">
        <label htmlFor={lineId}>
          {t("productPicker.line")}
          {required && " *"}
        </label>
        <Dropdown
          inputId={lineId}
          value={lineCode}
          options={(lines || []).map((l) => ({ label: l.name, value: l.code }))}
          onChange={(e) => chooseLine(e.value)}
          placeholder={lines ? t("productPicker.chooseLine") : t("productPicker.loading")}
          emptyMessage={empty}
          disabled={disabled || !lines}
          showClear={!required && Boolean(lineCode)}
          filter={(lines || []).length > 8}
          autoFocus={autoFocus}
          aria-required={required || undefined}
          className="w-full"
        />
      </div>
      <div className="product-picker__field">
        <label htmlFor={productId}>
          {t("productPicker.product")}
          {required && " *"}
        </label>
        <Dropdown
          inputId={productId}
          value={line ? value?.productId ?? null : null}
          options={products.map((p) => ({ label: p.name, value: p.id }))}
          onChange={(e) => chooseProduct(e.value)}
          placeholder={line ? t("productPicker.chooseProduct") : t("productPicker.chooseLineFirst")}
          emptyMessage={t("productPicker.noProducts")}
          disabled={disabled || !line}
          filter={products.length > 8}
          aria-required={required || undefined}
          className="w-full"
        />
      </div>
      {lines && !lines.length && <small className="product-picker__empty">{empty}</small>}
    </div>
  );
};

ProductPicker.propTypes = {
  value: PropTypes.shape({ lob: PropTypes.string, productId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]) }),
  onChange: PropTypes.func.isRequired,
  lines: PropTypes.arrayOf(PropTypes.object),
  businessType: PropTypes.oneOf(["package", "non_package"]),
  /** (product) => whether the screen offers it */
  keep: PropTypes.func,
  idPrefix: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  /** line above product instead of side by side */
  stacked: PropTypes.bool,
  autoFocus: PropTypes.bool,
  /** what to say when no line can be offered */
  emptyText: PropTypes.string,
};

/**
 * The product picker in a dialog: tag a prospect's product, or choose the product a new quotation or prospect is for.
 * onSelect(product, lineCode) on confirm; onSkip (optional) adds "Skip - tag product later".
 */
export const ProductPickerDialog = ({ visible = false, onHide, onSelect, onSkip, header, hint, confirmLabel, value = null, businessType, keep, busy = false }) => {
  const { t } = useTranslation();
  const lines = useProductLines({ businessType, enabled: visible });
  const [choice, setChoice] = useState({ lob: null, productId: null });

  useEffect(() => {
    if (visible) setChoice({ lob: value?.lob || null, productId: value?.productId ?? null });
  }, [visible, value?.lob, value?.productId]);

  const product = productOf(narrowLines(lines, keep), choice.productId);
  const footer = (
    <div className="product-picker-dialog__footer">
      {onSkip ? <Button type="button" label={t("productPicker.skip")} icon="pi pi-clock" text onClick={onSkip} disabled={busy} /> : <span />}
      <div className="flex gap-2">
        <Button type="button" label={t("productPicker.cancel")} outlined onClick={onHide} disabled={busy} />
        <Button type="button" label={confirmLabel || t("productPicker.continue")} icon="pi pi-check" onClick={() => onSelect(product, choice.lob)}
          disabled={!product || busy} loading={busy} />
      </div>
    </div>
  );
  return (
    <Dialog header={header || t("productPicker.title")} visible={visible} onHide={onHide} footer={footer} style={{ width: "40rem" }} breakpoints={{ "640px": "95vw" }}
      className="product-picker-dialog bv-centered" modal>
      {hint && <p className="product-picker-dialog__hint">{hint}</p>}
      {visible && <ProductPicker value={choice} onChange={setChoice} lines={lines} keep={keep} idPrefix="product-picker-dialog" required autoFocus />}
      {onSkip && <small className="product-picker-dialog__skip-hint">{t("productPicker.skipHint")}</small>}
    </Dialog>
  );
};

ProductPickerDialog.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  onSkip: PropTypes.func,
  header: PropTypes.string,
  hint: PropTypes.string,
  confirmLabel: PropTypes.string,
  value: PropTypes.shape({ lob: PropTypes.string, productId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]) }),
  businessType: PropTypes.oneOf(["package", "non_package"]),
  keep: PropTypes.func,
  busy: PropTypes.bool,
};

export default ProductPicker;
