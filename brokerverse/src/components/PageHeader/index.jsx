import React, { useId } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Tooltip } from "primereact/tooltip";
import SvgDot from "../../assets/icons/SvgDot";
import "./index.scss";

const label = (item) => (item && typeof item === "object" ? item.label : item);
const hasLabel = (item) => label(item) !== undefined && label(item) !== null && label(item) !== "";

/** Breadcrumb items: the first one is the home item, the others follow it with a dot between them. */
const Crumbs = ({ items, navigate }) => {
  const model = items.map((item) => {
    const to = typeof item === "object" ? item.to : null;
    return to && navigate ? { label: item.label, command: () => navigate(to), className: "bv-crumb-link" } : { label: label(item) };
  });
  return <BreadCrumb home={model[0]} model={model.slice(1)} separatorIcon={<SvgDot color="currentColor" />} className="bv-page-header__crumbs" />;
};

/** Breadcrumb with items that open another screen (needs the router). */
const LinkedCrumbs = ({ items }) => {
  const navigate = useNavigate();
  return <Crumbs items={items} navigate={navigate} />;
};

/**
 * Small info icon after a title: the help text appears on hover and on keyboard focus, and is read by screen readers
 * as the description of the icon.
 */
export const HelpTip = ({ text, label: ariaLabel }) => {
  const { t } = useTranslation();
  const id = `bv-help-${useId().replace(/:/g, "")}`;
  return (
    <>
      <Button type="button" id={`${id}-icon`} icon="pi pi-info-circle" text rounded className="bv-help-tip" aria-label={ariaLabel || t("pageHeader.help", "About this page")}
        aria-describedby={id} />
      <Tooltip target={`#${id}-icon`} position="bottom" event="both" className="bv-help-tip__tooltip">{text}</Tooltip>
      <span id={id} className="p-hidden-accessible">{text}</span>
    </>
  );
};

HelpTip.propTypes = {
  text: PropTypes.node.isRequired,
  label: PropTypes.string,
};

/**
 * The header of a page: the title (with an optional back arrow and help icon), the breadcrumb under it and the page
 * actions on the right; on a narrow screen the actions wrap under the title.
 *
 * The props of the module headers are accepted as they are, so a module header can render through this one without
 * changing its screens: `subtitle`, `intro` and `description` are the help text, and `children` are the actions.
 */
const PageHeader = ({ title, home, section, trail = [], help, subtitle, intro, description, actions, children, onBack, className = "" }) => {
  const { t } = useTranslation();
  const items = [home, section, ...trail].filter(hasLabel);
  const helpText = help ?? subtitle ?? intro ?? description;
  const buttons = actions ?? children;
  const linked = items.some((item) => typeof item === "object" && item.to);
  return (
    <header className={`bv-page-header ${className}`.trim()}>
      <div className="bv-page-header__main">
        <div className="bv-page-header__title-row">
          {onBack && <Button type="button" icon="pi pi-arrow-left" text rounded className="bv-page-header__back" onClick={onBack} aria-label={t("pageHeader.back", "Back")} />}
          <h1 className="bv-page-header__title">{title}</h1>
          {helpText ? <HelpTip text={helpText} /> : null}
        </div>
        {items.length > 0 && (linked ? <LinkedCrumbs items={items} /> : <Crumbs items={items} />)}
      </div>
      {buttons ? <div className="bv-page-header__actions">{buttons}</div> : null}
    </header>
  );
};

const crumb = PropTypes.oneOfType([PropTypes.string, PropTypes.shape({ label: PropTypes.string.isRequired, to: PropTypes.string })]);

PageHeader.propTypes = {
  /** page title */
  title: PropTypes.node.isRequired,
  /** first breadcrumb item: the top menu ("Accounts", "Master") */
  home: crumb,
  /** second breadcrumb item: the menu of the screen ("Period End", "Tax") */
  section: crumb,
  /** further breadcrumb items, usually ending with the screen name; { label, to } opens that screen */
  trail: PropTypes.arrayOf(crumb),
  /** one or two short sentences about the page, behind the info icon */
  help: PropTypes.node,
  /** same as help (the name the module headers use) */
  subtitle: PropTypes.node,
  /** same as help */
  intro: PropTypes.node,
  /** same as help */
  description: PropTypes.node,
  /** page actions on the right (children are used when left out) */
  actions: PropTypes.node,
  children: PropTypes.node,
  /** shows a back arrow before the title */
  onBack: PropTypes.func,
  className: PropTypes.string,
};

export default PageHeader;
