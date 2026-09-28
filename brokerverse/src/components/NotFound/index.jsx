import React from "react";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import "../ErrorBoundary/index.scss";

/** Shown for any address that is not a screen of the system. */
const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="bv-state" role="alert">
      <i className="pi pi-compass bv-state__icon" aria-hidden="true" />
      <h2>Page not found</h2>
      <p>This address is not a screen of the system. Check the link, or go back to the dashboard.</p>
      <Button label="Go to dashboard" icon="pi pi-home" onClick={() => navigate("/")} />
    </div>
  );
};

export default NotFound;
