/**
 * Puts the buttons of any dialog footer in the order of the UI standard (docs/developer-guide/ui-standard.md), so the
 * footers written before DialogFooter existed follow it without changing each screen:
 *  - Close / Cancel (and Back, No) as a text button on the left;
 *  - destructive actions (severity danger) red outlined and set apart on the right;
 *  - one primary (filled) button, the last filled one; any other filled button becomes outlined;
 *  - three or more secondary actions collapse into the "More actions" menu.
 * A footer that holds anything other than PrimeReact buttons (a checkbox, a component of its own, DialogFooter itself)
 * is left as it is.
 */
import React from "react";
import { Button } from "primereact/button";
import { MORE_AT } from "./constants";
import MoreActions from "./MoreActions";

const CLOSE = /^(close|cancel|back|no|not now|done|keep editing|discard changes)$/i;

const has = (props, cls) => String(props.className || "").split(/\s+/).includes(cls);
const isText = (p) => p.text || p.link || has(p, "p-button-text") || has(p, "p-button-link");
const isOutlined = (p) => p.outlined || has(p, "p-button-outlined");
const isDanger = (p) => p.severity === "danger" || has(p, "p-button-danger");
const isSecondaryStyle = (p) => p.severity === "secondary" || has(p, "p-button-secondary");
const labelOf = (p) => (typeof p.label === "string" ? p.label.trim() : "");

/** The elements of a footer, through fragments and a single wrapping div or span; null when it is not only buttons. */
export const footerButtons = (footer) => {
  const out = [];
  let ok = true;
  const visit = (node, depth) => {
    if (node === null || node === undefined || node === false || node === true || node === "") return;
    if (Array.isArray(node)) { node.forEach((n) => visit(n, depth)); return; }
    if (!React.isValidElement(node)) { ok = false; return; }
    if (node.type === React.Fragment) { visit(node.props.children, depth); return; }
    if ((node.type === "div" || node.type === "span") && depth === 0) { visit(node.props.children, depth + 1); return; }
    if (node.type === Button) { out.push(node); return; }
    ok = false;
  };
  visit(footer, 0);
  return ok ? out : null;
};

const strip = (cls, names) => String(cls || "").split(/\s+/).filter((c) => c && !names.includes(c)).join(" ") || undefined;
const STYLE_CLASSES = ["p-button-outlined", "p-button-text", "p-button-link", "p-button-secondary", "ml-2", "mr-2", "ml-auto", "mr-auto"];

/** The footer in the standard order, or the footer itself when it cannot be read as buttons. */
export const arrangeFooter = (footer, moreLabel = "More actions") => {
  const buttons = footerButtons(footer);
  if (!buttons || buttons.length < 2) return footer;
  const visible = buttons.filter((b) => b.props.visible !== false);
  const close = [];
  const danger = [];
  const filled = [];
  const others = [];
  visible.forEach((b) => {
    const p = b.props;
    if (CLOSE.test(labelOf(p)) && !isDanger(p)) close.push(b);
    else if (isDanger(p)) danger.push(b);
    else if (!isText(p) && !isOutlined(p) && !isSecondaryStyle(p) && labelOf(p)) filled.push(b);
    else others.push(b);
  });
  const primary = filled.length ? filled[filled.length - 1] : null;
  const secondary = [...filled.slice(0, -1), ...others];
  const key = (b, i, group) => b.key || `${group}-${labelOf(b.props) || i}`;

  const asClose = (b, i) => React.cloneElement(b, { key: key(b, i, "close"), text: true, outlined: false, severity: undefined, className: strip(b.props.className, STYLE_CLASSES) });
  const asDanger = (b, i) => React.cloneElement(b, { key: key(b, i, "danger"), outlined: !isText(b.props), severity: "danger", className: strip(b.props.className, ["ml-2", "mr-2", "ml-auto", "mr-auto"]) });
  const asSecondary = (b, i) => React.cloneElement(b, {
    key: key(b, i, "secondary"), outlined: !isText(b.props), severity: undefined, className: strip(b.props.className, ["p-button-secondary", "ml-2", "mr-2", "ml-auto", "mr-auto"]),
  });

  const menu = secondary.length >= MORE_AT && secondary.every((b) => labelOf(b.props));
  return (
    <div className="bv-dialog-footer">
      <div className="bv-dialog-footer__start">{close.map(asClose)}</div>
      <div className="bv-dialog-footer__end">
        {danger.length ? <span className="bv-dialog-footer__danger">{danger.map(asDanger)}</span> : null}
        {menu ? (
          <MoreActions label={moreLabel} actions={secondary.map((b) => ({ label: labelOf(b.props), disabled: !!b.props.disabled, tooltip: b.props.tooltip, onClick: b.props.onClick }))} />
        ) : secondary.map(asSecondary)}
        {primary ? React.cloneElement(primary, { key: key(primary, 0, "primary"), className: strip(primary.props.className, ["ml-2", "mr-2", "ml-auto", "mr-auto"]) }) : null}
      </div>
    </div>
  );
};
