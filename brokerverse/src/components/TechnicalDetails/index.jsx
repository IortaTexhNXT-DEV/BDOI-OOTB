import React, { useEffect, useId, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { hasPermission } from "../../utils/canOpen";
import { ADMIN_ROLES, getUserRoles } from "../../utils/menuPermissions";
import { copyText } from "../../utility/clipboard";
import "./index.scss";

/**
 * True when the signed-in user may see technical details: an administrator always; otherwise a user holding one of
 * `roles` or the `permission`. With neither given, administrators only.
 */
export const mayViewTechnical = ({ roles, permission } = {}) => {
  const mine = getUserRoles();
  if (mine.some((role) => ADMIN_ROLES.includes(role))) return true;
  if (roles?.length && mine.some((role) => roles.includes(role))) return true;
  return permission ? hasPermission(permission) : false;
};

const CopyButton = ({ text, label }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const h = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(h);
  }, [copied]);
  const name = copied ? t("technicalDetails.copied", "Copied") : label ? t("technicalDetails.copyNamed", { name: label, defaultValue: `Copy ${label}` }) : t("technicalDetails.copy", "Copy");
  return (
    <Button type="button" icon={copied ? "pi pi-check" : "pi pi-copy"} text size="small" className="bv-tech__copy" aria-label={name} tooltip={name} tooltipOptions={{ position: "top" }}
      onClick={async () => setCopied(await copyText(text))} />
  );
};

/**
 * A collapsed "Technical details" section for raw content that only specialists read (a file record layout, the
 * content of an export file, a message payload), in a monospace block with a copy button. It is not rendered at
 * all for users who may not see it.
 */
const TechnicalDetails = ({ blocks, text, title, roles, permission, defaultOpen = false, className = "" }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `bv-tech-${useId().replace(/:/g, "")}`;
  const list = (blocks || (text !== undefined && text !== null ? [{ text }] : [])).filter((b) => b && b.text !== undefined && b.text !== null);
  if (!list.length || !mayViewTechnical({ roles, permission })) return null;
  return (
    <section className={`bv-tech ${open ? "bv-tech--open" : ""} ${className}`.trim()}>
      <button type="button" className="bv-tech__toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
        <i className={`pi ${open ? "pi-chevron-down" : "pi-chevron-right"}`} aria-hidden="true" />
        {title || t("technicalDetails.title", "Technical details")}
      </button>
      {open && (
        <div id={bodyId} className="bv-tech__body">
          {list.map((b, i) => (
            <div className="bv-tech__block" key={b.label || i}>
              <div className="bv-tech__block-head">
                {b.label ? <span className="bv-tech__label">{b.label}</span> : <span />}
                <CopyButton text={String(b.text)} label={b.label} />
              </div>
              <pre className="bv-tech__pre" tabIndex={0} aria-label={b.label || title || t("technicalDetails.title", "Technical details")}>{String(b.text)}</pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

TechnicalDetails.propTypes = {
  /** the raw contents, each with its own heading and copy button */
  blocks: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, text: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) })),
  /** a single raw content (instead of blocks) */
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** heading of the disclosure ("Technical details" when left out) */
  title: PropTypes.string,
  /** role codes that may see it, besides the administrator */
  roles: PropTypes.arrayOf(PropTypes.string),
  /** an API permission that may see it, besides the administrator (e.g. write:period-end) */
  permission: PropTypes.string,
  /** open from the start */
  defaultOpen: PropTypes.bool,
  className: PropTypes.string,
};

export default TechnicalDetails;
