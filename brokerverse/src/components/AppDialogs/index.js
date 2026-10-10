import React, { useEffect, useRef } from "react";
import { ConfirmDialog } from "primereact/confirmdialog";
import CustomToast from "../Toast";
import { ConfirmDialogHost } from "../ConfirmDialog";
import { APP_DIALOG_TAG, registerAppToast } from "../../utility/dialogs";

/**
 * The application's shared toast and confirmation dialogs, mounted once in App.js. utility/dialogs (notify*, confirmAction)
 * shows messages and confirmations through them instead of the browser's native alert / confirm boxes;
 * components/ConfirmDialog openConfirm() shows its confirmations in the ConfirmDialogHost.
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
      <ConfirmDialog tagKey={APP_DIALOG_TAG} />
      <ConfirmDialogHost />
    </>
  );
};

export default AppDialogs;
