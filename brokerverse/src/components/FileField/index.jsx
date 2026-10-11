/**
 * A file picker in the theme: an outlined "Choose file" button, the name and size of the chosen file (or what may be
 * chosen) and a button that clears it, in place of the browser's own "Choose File / No file chosen" control.
 *
 *   <FileField id="br-imp-file" accept=".csv,.xlsx" value={file} onChange={setFile} invalid={!!errors.file} />
 *
 * `value` is the chosen File (null when none); setting it back to null clears the picker, so the same file can be
 * chosen again. `hint` replaces the default text naming the accepted types.
 */
import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import "./fileField.scss";

const sizeText = (bytes) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileField = ({ id, accept, value, onChange, disabled, invalid, hint, chooseLabel, className }) => {
  const { t } = useTranslation();
  const input = useRef(null);

  useEffect(() => {
    if (!value && input.current) input.current.value = "";
  }, [value]);

  const types = accept ? accept.split(",").map((x) => x.trim().replace(/^\./, "").toUpperCase()).filter(Boolean).join(", ") : "";
  const empty = hint || (types ? t("fileField.accepted", { types }) : t("fileField.none"));

  return (
    <div className={["bv-file", invalid && "bv-file--invalid", disabled && "bv-file--disabled", className].filter(Boolean).join(" ")}>
      <input id={id} ref={input} type="file" accept={accept || undefined} className="bv-file__input" disabled={disabled} tabIndex={-1} aria-hidden="true"
        onChange={(e) => onChange(e.target.files?.[0] || null)} />
      <Button type="button" icon="pi pi-paperclip" label={chooseLabel || t("fileField.choose")} outlined size="small" disabled={disabled}
        onClick={() => input.current?.click()} aria-controls={id} />
      <span className={value ? "bv-file__name" : "bv-file__empty"} title={value?.name || undefined}>
        {value ? value.name : empty}
        {value ? <span className="bv-file__size">{sizeText(value.size)}</span> : null}
      </span>
      {value && !disabled ? (
        <Button type="button" icon="pi pi-times" text rounded size="small" className="bv-file__clear" aria-label={t("fileField.clear")} onClick={() => onChange(null)} />
      ) : null}
    </div>
  );
};

FileField.propTypes = {
  id: PropTypes.string,
  accept: PropTypes.string,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  invalid: PropTypes.bool,
  hint: PropTypes.string,
  chooseLabel: PropTypes.string,
  className: PropTypes.string,
};

FileField.defaultProps = { id: undefined, accept: null, value: null, disabled: false, invalid: false, hint: null, chooseLabel: null, className: null };

export default FileField;
