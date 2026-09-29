import React from "react";

/** Field-level validation message shown under an input (PrimeReact p-error styling). */
const FieldError = ({ error, id }) =>
  error ? (
    <small id={id} className="p-error block mt-1" role="alert">
      {error}
    </small>
  ) : null;

export default FieldError;
