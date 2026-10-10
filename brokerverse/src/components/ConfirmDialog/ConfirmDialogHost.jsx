import React, { useEffect, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { settle, subscribe } from "./confirmQueue";

/**
 * Shows the confirmations asked with openConfirm(), one at a time. Mounted once with the application dialogs
 * (components/AppDialogs); openConfirm mounts one of its own when none is.
 */
const ConfirmDialogHost = () => {
  const [request, setRequest] = useState(null);
  // the last request stays rendered while its dialog closes
  const [shown, setShown] = useState(null);

  useEffect(
    () =>
      subscribe((next) => {
        setRequest(next);
        if (next) setShown(next);
      }),
    []
  );

  const current = request || shown;
  if (!current) return null;
  return <ConfirmDialog key={current.id} {...current.options} visible={!!request} onHide={(result) => settle(current, result)} />;
};

export default ConfirmDialogHost;
