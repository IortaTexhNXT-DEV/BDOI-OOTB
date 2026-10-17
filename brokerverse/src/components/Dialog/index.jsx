/**
 * PrimeReact Dialog with the footer of the UI standard.
 *
 * `import { Dialog } from "primereact/dialog"` resolves to this module (craco.config.js aliases it, like the DataTable),
 * so every dialog footer of buttons is put in the standard order (components/DialogFooter/arrange.jsx): Close / Cancel
 * on the left, destructive actions set apart, one primary, three or more secondary actions in a "More actions" menu.
 * The wrapper imports the PrimeReact module by its file name, which the alias does not match.
 */
import React, { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog as PrimeDialog } from "primereact/dialog/dialog.esm.js";
import { arrangeFooter } from "../DialogFooter/arrange";
import "../DialogFooter/index.scss";

export const Dialog = forwardRef(function Dialog(props, ref) {
  const { t } = useTranslation();
  const footer = typeof props.footer === "function" ? props.footer : arrangeFooter(props.footer, t("common.moreActions", "More actions"));
  return <PrimeDialog ref={ref} {...props} footer={footer} />;
});

export default Dialog;
