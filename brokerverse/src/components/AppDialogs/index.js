import React, { useEffect, useRef } from "react";
import { ConfirmDialog } from "primereact/confirmdialog";
import CustomToast from "../Toast";
import { APP_DIALOG_TAG, registerAppToast } from "../../utility/dialogs";

/**
 * The application's shared toast and confirmation dialog, mounted once in App.js. utility/dialogs (notify*, confirmAction)
 * shows messages and confirmations through them instead of the browser's native alert / confirm boxes (D44).
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
    </>
  );
};

export default AppDialogs;
