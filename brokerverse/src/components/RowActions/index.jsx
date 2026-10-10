/**
 * The row menu of a list: one kebab button, labelled for screen readers ("Actions for TIS-WEEKLY"), opening a menu of
 * text items built from the row's actions[] (server contract §3.2). Only allowed actions are listed, View first. An
 * action the user expects but may not take now (allowed false with a blockedReason, e.g. Run now after the week's
 * run) is listed disabled with its reason as visible text; an action without a reason is left out.
 *
 * Keyboard: Enter, Space or Arrow Down open the menu on its first item; Arrow Up / Down, Home and End move; Enter or
 * Space choose; Escape closes it and returns to the button; Tab closes it.
 *
 *   <RowActions label={t("remittance.schedules.actionsFor", { code: row.code })} actions={row.actions}
 *     onAction={(action) => run(action.code, row)} />
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import "./rowActions.scss";

/** The items of the menu: allowed actions, View first, and the blocked ones that carry a reason. */
export const menuItems = (actions = []) => {
  const shown = (actions || []).filter((a) => a && (a.allowed || a.blockedReason));
  return [...shown.filter((a) => a.code === "view"), ...shown.filter((a) => a.code !== "view")];
};

const RowActions = ({ actions, onAction, label, labelOf, className }) => {
  const { t } = useTranslation();
  const menuId = `bv-row-actions-${useId().replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const items = menuItems(actions);

  const itemNodes = () => Array.from(menu.current?.querySelectorAll("[role='menuitem']") || []);
  const focusItem = (index) => {
    const nodes = itemNodes();
    if (!nodes.length) return;
    nodes[(index + nodes.length) % nodes.length].focus();
  };

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  const place = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (r) setPosition({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };

  useLayoutEffect(() => {
    if (open) menu.current?.querySelector("[role='menuitem']")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (!menu.current?.contains(e.target) && !trigger.current?.contains(e.target)) close(false);
    };
    const away = () => close(false);
    document.addEventListener("mousedown", outside);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
    };
  }, [open, close]);

  if (!items.length) return null;

  const show = () => {
    place();
    setOpen(true);
  };

  const onTriggerKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show();
    }
  };

  const choose = (action) => {
    if (!action.allowed) return;
    close();
    onAction(action);
  };

  const onMenuKey = (e) => {
    const nodes = itemNodes();
    const at = nodes.indexOf(document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(at + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(at - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(nodes.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (at >= 0) choose(items[at]);
        break;
      default:
    }
  };

  const text = (a) => (labelOf ? labelOf(a) : a.label);

  return (
    <span className={["bv-row-actions", className].filter(Boolean).join(" ")}>
      <button ref={trigger} type="button" className="bv-row-actions__trigger p-button p-button-text p-button-rounded p-button-icon-only"
        aria-label={label || t("rowActions.label")} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : show())} onKeyDown={onTriggerKey}>
        <i className="pi pi-ellipsis-v" aria-hidden="true" />
      </button>
      {open && position && createPortal(
        <ul ref={menu} id={menuId} role="menu" aria-label={label || t("rowActions.label")} className="bv-row-actions__menu"
          style={{ top: position.top, right: position.right }} onKeyDown={onMenuKey}>
          {items.map((a) => (
            <li key={a.code} role="none">
              <div role="menuitem" tabIndex={-1} aria-disabled={a.allowed ? undefined : true}
                className={`bv-row-actions__item${a.allowed ? "" : " bv-row-actions__item--blocked"}`} onClick={() => choose(a)}>
                <span className="bv-row-actions__label">{text(a)}</span>
                {!a.allowed ? <span className="bv-row-actions__reason">{a.blockedReason}</span> : null}
              </div>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </span>
  );
};

RowActions.propTypes = {
  /** the row's actions: [{ code, label, allowed, blockedCode, blockedReason, link, href }] */
  actions: PropTypes.arrayOf(PropTypes.shape({
    code: PropTypes.string.isRequired,
    label: PropTypes.string,
    allowed: PropTypes.bool,
    blockedReason: PropTypes.string,
  })),
  /** receives the chosen action */
  onAction: PropTypes.func.isRequired,
  /** accessible name of the button, naming the row ("Actions for TIS-WEEKLY") */
  label: PropTypes.string,
  /** the text of an item (a translation by code); the action's label when left out */
  labelOf: PropTypes.func,
  className: PropTypes.string,
};

RowActions.defaultProps = { actions: [], label: null, labelOf: null, className: null };

export default RowActions;
