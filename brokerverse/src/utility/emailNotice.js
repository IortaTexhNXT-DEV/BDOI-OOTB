import { useEffect, useState } from "react";
import i18n from "../i18n";
import emailService from "../services/emailService";
import { notifySuccess, notifyWarn } from "./dialogs";

/** True only when the server said e-mail sending is off (unknown counts as working, as before). */
export const isSendingOff = (status) => status?.active === false;

/** The "queued, not sent" notice shown instead of a success message while e-mail sending is not configured. */
export const queuedNotice = () => i18n.t("emailOutbox.queuedNotConfigured");

/**
 * Report an e-mail action: the success text when e-mail goes out, else a warning that the message only waits in
 * the outbox (Master > E-mail Outbox) because e-mail sending is not configured.
 */
export async function notifyEmailOutcome(sentText) {
  if (isSendingOff(await emailService.sendingStatus())) notifyWarn(queuedNotice());
  else notifySuccess(sentText);
}

/** A success text with the queued notice added while e-mail sending is not configured. */
export const withQueuedNotice = (text, status) => (isSendingOff(status) ? `${text}. ${queuedNotice()}` : text);

/** E-mail sending status for a screen ({ enabled, smtpConfigured, active } or null until known). */
export function useEmailSending() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let active = true;
    emailService.sendingStatus().then((s) => active && setStatus(s));
    return () => {
      active = false;
    };
  }, []);
  return status;
}
