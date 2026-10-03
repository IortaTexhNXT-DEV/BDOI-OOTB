import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import authService from "../../../services/authService";
import { notifySuccess } from "../../../utility/dialogs";
import ChangePasswordForm from "./ChangePasswordForm";
import TwoFactorEnrolment from "./TwoFactorEnrolment";
import TwoFactorCodeForm from "./TwoFactorCodeForm";
import { apiError } from "./passwordRules";
import "./security.scss";

/** Profile / top-bar menu > Change password. The server ends the other sessions and renews this one. */
export const ChangePasswordDialog = ({ visible, onHide }) => {
  const { t } = useTranslation();
  return (
    <Dialog header={t("security.changePassword")} visible={visible} onHide={onHide} style={{ width: "30rem" }} breakpoints={{ "640px": "95vw" }} modal dismissableMask={false}>
      {visible && (
        <ChangePasswordForm
          intro={t("security.changeIntro")}
          onCancel={onHide}
          onDone={() => {
            notifySuccess(t("security.passwordChanged"));
            onHide();
          }}
        />
      )}
    </Dialog>
  );
};

/** Profile / top-bar menu > Two-factor authentication: status, turn on (enrolment) or off (with a current code). */
export const TwoFactorDialog = ({ visible, onHide }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState("status");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    setMode("status");
    setError("");
    setStatus(null);
    authService
      .twoFactorStatus()
      .then((s) => live && setStatus(s))
      .catch((err) => live && setError(apiError(err, t("security.requestFailed"))));
    return () => {
      live = false;
    };
  }, [visible, t]);

  const done = (message, enabled) => {
    notifySuccess(message);
    setStatus((s) => ({ ...(s || {}), enabled }));
    setMode("status");
  };

  let body;
  if (error) {
    body = (
      <div className="bv-security__alert" role="alert">
        {error}
      </div>
    );
  } else if (!status) {
    body = <p className="bv-security__intro">{t("security.preparing")}</p>;
  } else if (mode === "enrol") {
    body = <TwoFactorEnrolment onEnabled={() => done(t("security.twoFactorOn"), true)} onCancel={() => setMode("status")} />;
  } else if (mode === "disable") {
    body = (
      <TwoFactorCodeForm
        intro={t("security.disableIntro")}
        submitLabel={t("security.turnOff")}
        onBack={() => setMode("status")}
        onSubmit={async (code) => {
          await authService.twoFactorDisable(code);
          done(t("security.twoFactorOff"), false);
        }}
      />
    );
  } else {
    body = (
      <div className="bv-security__form">
        <div className={`bv-security__status ${status.enabled ? "is-on" : ""}`}>
          <i className={`pi ${status.enabled ? "pi-shield" : "pi-lock-open"}`} aria-hidden="true" />
          <span>{status.enabled ? t("security.statusOn") : t("security.statusOff")}</span>
        </div>
        {status.required && <p className="bv-security__help">{t("security.requiredForRole")}</p>}
        <div className="bv-security__actions">
          <Button type="button" label={t("security.close")} className="p-button-text" onClick={onHide} />
          {status.enabled ? (
            !status.required && <Button type="button" label={t("security.turnOff")} className="p-button-danger p-button-outlined" onClick={() => setMode("disable")} />
          ) : (
            <Button type="button" label={t("security.turnOn")} onClick={() => setMode("enrol")} />
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog header={t("security.twoFactor")} visible={visible} onHide={onHide} style={{ width: "32rem" }} breakpoints={{ "640px": "95vw" }} modal>
      {body}
    </Dialog>
  );
};
