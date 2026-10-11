import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import authService from "../../../services/authService";
import TwoFactorCodeForm from "./TwoFactorCodeForm";
import { apiError } from "./passwordRules";
import "./security.scss";
import { copyText } from "../../../utility/clipboard";
import QRCode from "qrcode";

/** "JBSWY3DP..." -> "JBSW Y3DP ..." (easier to type into an authenticator app). */
const grouped = (secret) => String(secret || "").replace(/(.{4})/g, "$1 ").trim();

/** The otpauth:// URI as an SVG QR code (data URI for an <img>); null when it cannot be drawn. */
export const qrImage = async (uri) => {
  if (!uri) return null;
  try {
    const svg = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "var(--text-color)", light: "#ffffff" } });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
};

/**
 * Two-factor enrolment: a new secret from POST /auth/2fa/setup, shown as a QR code of its otpauth:// URI for the
 * authenticator app to scan, with the setup key below for typing in when scanning is not possible, then confirmed
 * with a code. `token` is the restricted token of a forced enrolment at sign-in. onEnabled receives the authService
 * result ({ step, data }).
 */
const TwoFactorEnrolment = ({ token, onEnabled, onCancel, intro }) => {
  const { t } = useTranslation();
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let live = true;
    authService
      .twoFactorSetup(token)
      .then((data) => live && setSetup(data))
      .catch((err) => live && setError(apiError(err, t("security.setupFailed"))));
    return () => {
      live = false;
    };
  }, [token, t]);

  useEffect(() => {
    let live = true;
    qrImage(setup?.otpauthUrl).then((src) => live && setQr(src));
    return () => {
      live = false;
    };
  }, [setup]);

  const copy = async () => {
    if (await copyText(setup.secret)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
    }
  };

  if (error) {
    return (
      <div className="bv-security__form">
        <div className="bv-security__alert" role="alert">
          {error}
        </div>
        {onCancel && (
          <div className="bv-security__actions">
            <Button type="button" label={t("security.back")} className="p-button-text" onClick={onCancel} />
          </div>
        )}
      </div>
    );
  }
  if (!setup) return <p className="bv-security__intro">{t("security.preparing")}</p>;

  return (
    <div className="bv-security__enrol">
      {intro && <p className="bv-security__intro">{intro}</p>}
      <ol className="bv-security__steps">
        <li>{t("security.enrolStep1")}</li>
        <li>
          {qr ? t("security.enrolStep2Scan") : t("security.enrolStep2")}
          {qr && (
            <div className="bv-security__qr">
              <img src={qr} alt={t("security.qrAlt", { issuer: setup.issuer, account: setup.account })} width="176" height="176" />
            </div>
          )}
          <div className="bv-security__manual">
            {qr && <div className="bv-security__manual-title">{t("security.cantScan")}</div>}
            <div className="bv-security__secret">
              <code aria-label={t("security.setupKey")}>{grouped(setup.secret)}</code>
              <Button
                type="button"
                icon={copied ? "pi pi-check" : "pi pi-copy"}
                className="p-button-text p-button-sm"
                aria-label={t("security.copyKey")}
                tooltip={copied ? t("security.copied") : t("security.copyKey")}
                onClick={copy}
              />
            </div>
            <small className="bv-security__help">
              {t("security.accountLabel", { issuer: setup.issuer, account: setup.account })}{" "}
              <a href={setup.otpauthUrl}>{t("security.openInApp")}</a>
            </small>
          </div>
        </li>
        <li>{t("security.enrolStep3")}</li>
      </ol>
      <TwoFactorCodeForm
        onSubmit={async (code) => {
          const result = await authService.twoFactorEnable(code, token);
          onEnabled?.(result);
        }}
        onBack={onCancel}
        backLabel={t("security.cancel")}
        submitLabel={t("security.turnOn")}
      />
    </div>
  );
};

export default TwoFactorEnrolment;
