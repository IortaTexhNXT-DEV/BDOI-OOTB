/**
 * The picture panel of the sign-in page, from the branding (Theme and Branding > Sign-in page): a picture of the
 * library (shown over the theme's colour gradient), an uploaded picture (with its focal point), or the colour gradient
 * only; an optional dark overlay; shown or hidden on phones.
 */
import React from "react";
import "./branding.scss";

export const DEFAULT_LOGIN_ART = "/brand/login-panel.svg";

export function loginPanelProps(theme = {}, fallback = {}) {
  const login = theme.login || {};
  const colors = theme.colors || {};
  const from = login.colorFrom || colors.primary || fallback.primaryColor || "#0072d8";
  const to = login.colorTo || colors.secondary || fallback.secondaryColor || "#004ea8";
  const mode = ["library", "image", "color"].includes(login.panel) ? login.panel : "library";
  const src = mode === "image" ? login.panelImageUrl : mode === "library" ? login.libraryUrl || DEFAULT_LOGIN_ART : null;
  return {
    mode,
    src: src || (mode === "image" ? login.libraryUrl || DEFAULT_LOGIN_ART : null),
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    objectPosition: `${Number(login.focalX ?? 50)}% ${Number(login.focalY ?? 50)}%`,
    overlay: Math.max(0, Math.min(80, Number(login.overlay) || 0)) / 100,
    showOnMobile: !!login.showOnMobile,
  };
}

const LoginArt = ({ theme, fallback, className = "", preview = false }) => {
  const p = loginPanelProps(theme || {}, fallback);
  return (
    <div
      className={`bv-auth__art bv-login-art bv-login-art--${p.mode}${p.showOnMobile ? " bv-auth__art--mobile" : ""}${preview ? " bv-login-art--preview" : ""} ${className}`}
      aria-hidden="true"
      data-testid="login-art"
      style={{ background: p.background }}
    >
      {p.src && <img src={p.src} alt="" className="bv-auth__art-image" data-testid="login-art-image" style={{ objectPosition: p.objectPosition }} />}
      {p.overlay > 0 && <div className="bv-login-art__overlay" data-testid="login-art-overlay" style={{ background: `rgba(0, 0, 0, ${p.overlay})` }} />}
    </div>
  );
};

export default LoginArt;
