import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Sidebar } from "primereact/sidebar";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";
import adminService from "../../services/adminService";
import { menuList } from "../SideBar/list";
import { findActiveTrail } from "../SideBar/menuTree";
import { ADMIN_ROLES, getUserRoles } from "../../utils/menuPermissions";
import { currentUser } from "../../utility/userIdentity";
import { DEFAULT_SYSTEM_SETTINGS } from "../../utility/systemCurrencies";
import { helpSectionFor } from "./helpRoutes";
import { OPEN_HELP_EVENT, isTyping } from "./helpEvents";
import "./index.scss";

const HELP_BASE = `${process.env.PUBLIC_URL || ""}/help`;
export const MANUAL_URL = `${HELP_BASE}/user-manual.html`;
const WEB_VERSION = process.env.REACT_APP_VERSION || "";
const BUILD_DATE = process.env.REACT_APP_BUILD_DATE || "";

const text = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** The support settings (support.email, support.phone, support.hours, support.portal_url) as { email, phone, hours, portalUrl }. */
export const supportContacts = (rows) => {
  const by = Object.fromEntries((rows || []).map((r) => [r.key, text(r.value)]));
  const portal = by["support.portal_url"] || "";
  return {
    email: by["support.email"] || "",
    phone: by["support.phone"] || "",
    hours: by["support.hours"] || "",
    // only a web address is offered as a link
    portalUrl: /^https?:\/\//i.test(portal) ? portal : "",
  };
};

/**
 * The chapters of the user manual for the user's roles ([{ code, id, title }]), from the edition record of
 * public/help/sections.json (roles: { code: { id, title } }), in the order of the manual.
 */
export const roleChapters = (manual, roles) => {
  const held = new Set((roles || []).map((r) => String(r).toLowerCase()));
  return Object.entries(manual?.roles || {})
    .filter(([code]) => held.has(code))
    .map(([code, chapter]) => ({ code, id: chapter.id, title: chapter.title }));
};

/** Address of a file of the published manual (the PDF or the Word file named in sections.json), or null. */
export const manualFile = (manual, kind) => (manual?.files?.[kind] ? `${HELP_BASE}/${encodeURIComponent(manual.files[kind])}` : null);

/** The details a support desk needs to look into a problem, as plain text. */
export const ticketDetails = ({ screen, url, user, version, environment, at }) =>
  [
    `Screen: ${screen}`,
    `Address: ${url}`,
    `User: ${user.username || ""}${user.displayName ? ` (${user.displayName})` : ""}`,
    `Roles: ${(user.roles || []).join(", ")}`,
    `Version: ${version}`,
    environment ? `Environment: ${environment}` : null,
    `Time: ${at}`,
  ]
    .filter(Boolean)
    .join("\n");

const formatBuildDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const HelpSection = ({ icon, title, children }) => (
  <section className="bv-help__section">
    <h3 className="bv-help__section-title">
      <i className={`pi ${icon}`} aria-hidden="true" />
      {title}
    </h3>
    {children}
  </section>
);

/**
 * Help panel (avatar menu > Help, F1, or "?" outside a text field): the user manual section of the current screen,
 * the chapter of the user's role, the manual as PDF and Word, the support desk (Master > Configuration, group
 * support), a support ticket with the screen, user, version and time filled in, the keyboard shortcuts, and About.
 * The manual is the edition published in public/help (sections.json names it, its files and its role chapters).
 */
const HelpPanel = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const systemName = useSelector((s) => s.systemSettingsReducer?.systemName || DEFAULT_SYSTEM_SETTINGS.systemName);
  const [visible, setVisible] = useState(false);
  const [manual, setManual] = useState(null);
  const [support, setSupport] = useState(null);
  const [version, setVersion] = useState(null);
  const [copied, setCopied] = useState(false);
  const userRoles = useMemo(() => getUserRoles(), []);
  const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));

  const open = useCallback(() => setVisible(true), []);

  useEffect(() => {
    window.addEventListener(OPEN_HELP_EVENT, open);
    const onKey = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "F1" || (e.key === "?" && !isTyping(e.target))) {
        e.preventDefault();
        setVisible(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_HELP_EVENT, open);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The manual's headings, the support contacts and the version are read the first time the panel opens.
  useEffect(() => {
    if (!visible) return;
    setCopied(false);
    if (!manual) {
      fetch(`${HELP_BASE}/sections.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setManual(d && Array.isArray(d.sections) ? d : { sections: [] }))
        .catch(() => setManual({ sections: [] }));
    }
    if (!support) {
      adminService
        .getSettings("support")
        .then((rows) => setSupport(supportContacts(rows)))
        .catch(() => setSupport(supportContacts([])));
    }
    if (!version) {
      adminService
        .getVersion()
        .then((v) => setVersion(v || {}))
        .catch(() => setVersion({}));
    }
  }, [visible, manual, support, version]);

  // the screen the user is on: its menu label, else the page title
  const screen = useMemo(() => {
    const trail = findActiveTrail(menuList, location.pathname);
    if (trail.length) return t(`sidebar.${trail[trail.length - 1]}`, { defaultValue: trail[trail.length - 1] });
    const heading = document.querySelector(".main__content h1, .main__content h2");
    return heading?.textContent?.trim() || systemName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, visible, t, systemName]);

  const sections = manual?.sections || null;
  const knownIds = useMemo(() => (manual ? new Set(manual.sections.map((s) => s.id)) : null), [manual]);
  const section = helpSectionFor(location.pathname, knownIds);
  const sectionTitle = sections?.find((s) => s.id === section.id)?.title;
  const sectionUrl = `${MANUAL_URL}#${section.id}`;
  const pdfUrl = manualFile(manual, "pdf");
  const wordUrl = manualFile(manual, "word");
  const chapters = roleChapters(manual, userRoles);
  const manualVersion = [manual?.version && `${t("help.version")} ${manual.version}`, manual?.date, manual?.status && manual.status !== "Approved" ? manual.status : null]
    .filter(Boolean)
    .join(" · ");

  const versionText = [
    WEB_VERSION && `${t("help.webApp")} ${WEB_VERSION}`,
    version?.version && `${t("help.api")} ${version.version}${version.commit ? ` (${String(version.commit).slice(0, 7)})` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const details = () =>
    ticketDetails({
      screen,
      url: window.location.href,
      user: currentUser(),
      version: versionText || "-",
      environment: version?.environment,
      at: new Date().toISOString(),
    });

  const mailto = () => {
    const subject = `${systemName} support request: ${screen}`;
    const body = `${t("help.ticketPrompt")}\n\n\n\n---\n${details()}\n`;
    return `mailto:${support.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(details());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const hasContact = !!(support && (support.email || support.phone || support.portalUrl));

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={() => setVisible(false)}
      className="bv-help"
      blockScroll
      header={<span className="bv-help__title">{t("help.title")}</span>}
      aria-label={t("help.title")}
    >
      <HelpSection icon="pi-book" title={t("help.thisScreen")}>
        <p className="bv-help__screen">{screen}</p>
        <p className="bv-help__muted">
          {t("help.manualSection")}{" "}
          {sections === null ? <Skeleton width="10rem" height="0.9rem" className="inline-block" /> : <strong>{sectionTitle || t("help.screenLayout")}</strong>}
        </p>
        <div className="bv-help__actions">
          <a className="p-button p-component bv-help__button" href={sectionUrl} target="_blank" rel="noopener noreferrer">
            <i className="pi pi-external-link" aria-hidden="true" />
            <span>{t("help.openSection")}</span>
          </a>
          {pdfUrl && (
            <a className="p-button p-component p-button-outlined bv-help__button" href={pdfUrl} download>
              <i className="pi pi-download" aria-hidden="true" />
              <span>{t("help.downloadPdf")}</span>
            </a>
          )}
          {wordUrl && (
            <a className="p-button p-component p-button-outlined bv-help__button" href={wordUrl} download>
              <i className="pi pi-download" aria-hidden="true" />
              <span>{t("help.downloadWord")}</span>
            </a>
          )}
        </div>
        <a className="bv-help__link" href={MANUAL_URL} target="_blank" rel="noopener noreferrer">
          {t("help.browseManual")}
        </a>
      </HelpSection>

      {chapters.length > 0 && (
        <HelpSection icon="pi-id-card" title={t("help.yourRole")}>
          <ul className="bv-help__roles">
            {chapters.map((c) => (
              <li key={c.code}>
                <span>{c.title}</span>
                <a className="bv-help__link" href={`${MANUAL_URL}#${c.id}`} target="_blank" rel="noopener noreferrer">
                  {t("help.openRoleChapter")}
                </a>
              </li>
            ))}
          </ul>
        </HelpSection>
      )}

      <HelpSection icon="pi-phone" title={t("help.contactSupport")}>
        {support === null ? (
          <Skeleton width="80%" height="2.5rem" />
        ) : hasContact ? (
          <dl className="bv-help__contacts">
            {support.email && (
              <>
                <dt>{t("help.email")}</dt>
                <dd><a href={`mailto:${support.email}`}>{support.email}</a></dd>
              </>
            )}
            {support.phone && (
              <>
                <dt>{t("help.phone")}</dt>
                <dd><a href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}>{support.phone}</a></dd>
              </>
            )}
            {support.hours && (
              <>
                <dt>{t("help.hours")}</dt>
                <dd>{support.hours}</dd>
              </>
            )}
            {support.portalUrl && (
              <>
                <dt>{t("help.portal")}</dt>
                <dd><a href={support.portalUrl} target="_blank" rel="noopener noreferrer">{support.portalUrl}</a></dd>
              </>
            )}
          </dl>
        ) : (
          <p className="bv-help__muted">
            {t("help.noContacts")}
            {isAdmin && (
              <>
                {" "}
                <Button
                  type="button"
                  link
                  className="p-0 bv-help__inline-link"
                  label={t("help.setContacts")}
                  onClick={() => {
                    setVisible(false);
                    navigate("/master/configuration/settings?area=company");
                  }}
                />
              </>
            )}
          </p>
        )}
      </HelpSection>

      {hasContact && (support.portalUrl || support.email) && (
        <HelpSection icon="pi-ticket" title={t("help.raiseTicket")}>
          <p className="bv-help__muted">{t(support.portalUrl ? "help.ticketPortal" : "help.ticketEmail")}</p>
          <div className="bv-help__actions">
            {support.portalUrl ? (
              <a className="p-button p-component bv-help__button" href={support.portalUrl} target="_blank" rel="noopener noreferrer">
                <i className="pi pi-external-link" aria-hidden="true" />
                <span>{t("help.openPortal")}</span>
              </a>
            ) : (
              <a className="p-button p-component bv-help__button" href={mailto()}>
                <i className="pi pi-envelope" aria-hidden="true" />
                <span>{t("help.emailTicket")}</span>
              </a>
            )}
            <Button
              type="button"
              outlined
              icon={copied ? "pi pi-check" : "pi pi-copy"}
              label={copied ? t("help.copied") : t("help.copyDetails")}
              className="bv-help__button"
              onClick={copyDetails}
            />
          </div>
        </HelpSection>
      )}

      <HelpSection icon="pi-th-large" title={t("help.shortcuts")}>
        <table className="bv-help__keys">
          <tbody>
            <tr><td><kbd>F1</kbd> <span className="bv-help__muted">{t("help.or")}</span> <kbd>?</kbd></td><td>{t("help.keyHelp")}</td></tr>
            <tr><td><kbd>/</kbd></td><td>{t("help.keySearch")}</td></tr>
            <tr><td><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></td><td>{t("help.keySearchResults")}</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>{t("help.keyClose")}</td></tr>
          </tbody>
        </table>
      </HelpSection>

      <HelpSection icon="pi-info-circle" title={t("help.about", { name: systemName })}>
        <dl className="bv-help__about">
          <dt>{t("help.version")}</dt>
          <dd>{versionText || (version === null ? <Skeleton width="8rem" height="0.9rem" /> : "-")}</dd>
          <dt>{t("help.environment")}</dt>
          <dd>{version === null ? <Skeleton width="6rem" height="0.9rem" /> : version.environment || "-"}</dd>
          <dt>{t("help.buildDate")}</dt>
          <dd>{formatBuildDate(BUILD_DATE) || "-"}</dd>
          {manualVersion && (
            <>
              <dt>{t("help.manual")}</dt>
              <dd>{manualVersion}</dd>
            </>
          )}
        </dl>
        {manual && !manual.brandPack && <p className="bv-help__muted bv-help__vendor">{t("help.vendor")}</p>}
      </HelpSection>
    </Sidebar>
  );
};

export default HelpPanel;
