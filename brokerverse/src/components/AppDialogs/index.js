import React, { useEffect, useRef } from "react";
import CustomToast from "../Toast";
import { ConfirmDialogHost } from "../ConfirmDialog";
import { registerAppToast } from "../../utility/dialogs";

/**
 * The application's shared toast and confirmation dialog, mounted once in App.js. utility/dialogs (notify*, confirmAction,
 * promptText) and components/ConfirmDialog openConfirm() show their messages and confirmations here instead of the
 * browser's native alert / confirm / prompt boxes.
 */
const AppDialogs = () => {
  const toastRef = useRef(null);

  useEffect(() => {
    registerAppToast(toastRef);
    return () => registerAppToast(null);
  }, []);

  return (
    <>
      <CustomToast ref={toastRef} />
      <ConfirmDialogHost />
    </>
  );
};

export default AppDialogs;
