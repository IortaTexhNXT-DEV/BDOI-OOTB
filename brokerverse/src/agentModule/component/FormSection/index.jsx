import React from "react";
import PropTypes from "prop-types";
import FieldError from "../../../components/FieldError";
import "./index.scss";

/**
 * The form layout of the newer screens (client onboarding, request for quotation): a section heading over a grid of
 * fields, each with its label above a compact input, a required marker, a hint and the inline error under it.
 * FormSection: title, columns (2 or 3 on a wide screen; one column on a phone). FormField: label, htmlFor, required,
 * hint, error, full (the whole row).
 */
export const FormSection = ({ title, columns = 3, children, className = "" }) => (
  <section className={`fs-section ${className}`.trim()}>
    {title ? <h3 className="fs-section__title">{title}</h3> : null}
    <div className={`fs-grid fs-grid--${columns}`}>{children}</div>
  </section>
);

FormSection.propTypes = {
  title: PropTypes.node,
  columns: PropTypes.oneOf([2, 3]),
  children: PropTypes.node,
  className: PropTypes.string,
};

export const FormField = ({ label, htmlFor, required = false, hint, error, full = false, children }) => (
  <div className={`fs-field${full ? " fs-field--full" : ""}${error ? " fs-field--invalid" : ""}`}>
    <label htmlFor={htmlFor}>
      {label}
      {required ? <span className="fs-field__required" aria-hidden="true"> *</span> : null}
    </label>
    {children}
    {hint && !error ? <small className="fs-field__hint" id={htmlFor ? `${htmlFor}-hint` : undefined}>{hint}</small> : null}
    <FieldError error={error} id={htmlFor ? `${htmlFor}-error` : undefined} />
  </div>
);

FormField.propTypes = {
  label: PropTypes.node.isRequired,
  htmlFor: PropTypes.string,
  required: PropTypes.bool,
  hint: PropTypes.node,
  error: PropTypes.node,
  full: PropTypes.bool,
  children: PropTypes.node,
};
