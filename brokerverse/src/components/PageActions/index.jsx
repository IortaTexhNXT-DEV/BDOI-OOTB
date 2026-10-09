import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import "./index.scss";

/**
 * The actions at the top right of a list screen (Upload, Add, and any other given as children):
 * buttons of one height, padding and icon size on every master list, outlined for the secondary actions and filled
 * for Add, whatever the button rules of the screen around them.
 */
const PageActions = ({ onUpload, onAdd, uploadLabel, addLabel, children }) => {
  const { t } = useTranslation();
  return (
    <div className="bv-page-actions">
      {children}
      {onUpload ? <Button type="button" icon="pi pi-upload" label={uploadLabel || t("common.upload", "Upload")} outlined onClick={onUpload} /> : null}
      {onAdd ? <Button type="button" icon="pi pi-plus" label={addLabel || t("common.add", "Add")} onClick={onAdd} /> : null}
    </div>
  );
};

export default PageActions;
