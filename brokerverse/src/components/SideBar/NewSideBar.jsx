import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EnvironmentBadge from "../EnvironmentBadge";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import { menuList } from "./list";
import "./NewSideBar.scss";
import { filterMenuForRoles, getUserRoles } from "../../utils/menuPermissions";
import { findActiveTrail, keyOf, searchMenu } from "./menuTree";
import { isTyping } from "../HelpPanel/helpEvents";
import {
  COMMISSION_VIEW_MODE_EVENT,
  getCommissionViewMode,
} from "../../module/Commission/utils/commissionViewMode";
import { DEFAULT_SYSTEM_SETTINGS } from "../../utility/systemCurrencies";
import { useBranding } from "../../theme/runtime/BrandingProvider";

// Open groups are remembered in this browser between sessions (a convenience only).
const EXPANDED_KEY = "bv.sidebar.expanded";

const readExpanded = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(EXPANDED_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const writeExpanded = (keys) => {
  try {
    window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(keys));
  } catch {
    // storage unavailable (private window): the menu simply opens on the current screen next time
  }
};

const isTop = (key) => !key.includes("/");

/**
 * A menu label that ends with an ellipsis when it does not fit; the full name is shown as a tooltip when the label
 * is cut or abbreviated (sidebarFull.<name> in en.json).
 */
const NavLabel = ({ text, full }) => {
  const ref = useRef(null);
  const onEnter = () => {
    const el = ref.current;
    if (!el) return;
    const cut = el.scrollWidth > el.clientWidth + 1;
    if (cut || full !== text) el.setAttribute("title", full);
    else el.removeAttribute("title");
  };
  return (
    <span ref={ref} className="bv-nav__label" onMouseEnter={onEnter}>
      {text}
    </span>
  );
};

const NewSideBar = ({ onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Product name and logo of the branding (GET /api/branding), else of the system settings once loaded; nothing is
  // shown before either answers, so the default logo never flashes. The name under the logo is left out when the
  // theme says the logo carries it (logo.showName false).
  const { branding } = useBranding();
  const settings = useSelector((state) => state.systemSettingsReducer);
  const systemName = branding?.systemName || (settings?.loaded && settings.systemName) || "";
  const logoUrl = branding?.logoUrl || (settings?.loaded && settings.logoUrl) || "";
  const showName = !!systemName && branding?.theme?.logo?.showName !== false;
  const brandName = systemName || DEFAULT_SYSTEM_SETTINGS.systemName;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [expanded, setExpanded] = useState(readExpanded);
  const [commissionViewMode, setCommissionViewModeState] = useState(() => getCommissionViewMode());
  const pathname = location?.pathname || "/";

  const label = useCallback((name) => t(`sidebar.${name}`, { defaultValue: name }), [t]);
  const fullLabel = useCallback(
    (name) => t(`sidebarFull.${name}`, { defaultValue: label(name) }),
    [t, label],
  );

  useEffect(() => {
    const onViewModeChange = (event) => setCommissionViewModeState(event?.detail || getCommissionViewMode());
    window.addEventListener(COMMISSION_VIEW_MODE_EVENT, onViewModeChange);
    return () => window.removeEventListener(COMMISSION_VIEW_MODE_EVENT, onViewModeChange);
  }, []);

  // Roles do not change during a session, so read them once.
  const userRoles = useMemo(() => getUserRoles(), []);

  // Deny-by-default role filter shared with the route guard (utils/menuPermissions.js); Agents/Referrer Accounts is
  // hidden when the Commission view is Management.
  const menu = useMemo(() => {
    const base = userRoles.length
      ? filterMenuForRoles(menuList, userRoles)
      : menuList.filter((m) => m.name === "Dashboard");
    if (commissionViewMode !== "management") return base;
    return base.map((m) =>
      m.name === "Commission" && m.submenu
        ? { ...m, submenu: m.submenu.filter((s) => s.name !== "Agents/Referrer Accounts") }
        : m,
    );
  }, [userRoles, commissionViewMode]);

  const activeTrail = useMemo(() => findActiveTrail(menu, pathname), [menu, pathname]);
  const activeKey = keyOf(activeTrail);

  const updateExpanded = useCallback((change) => {
    setExpanded((prev) => {
      const next = change(prev);
      writeExpanded(next);
      return next;
    });
  }, []);

  // The groups above the current screen open when it changes; one top-level group is open at a time.
  useEffect(() => {
    if (activeTrail.length < 2) return;
    const ancestors = activeTrail.slice(0, -1).map((_, i) => keyOf(activeTrail.slice(0, i + 1)));
    updateExpanded((prev) => {
      const kept = prev.filter((k) => !isTop(k) || k === ancestors[0]);
      const next = Array.from(new Set([...kept, ...ancestors]));
      return next.length === prev.length && next.every((k) => prev.includes(k)) ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const toggle = (key) =>
    updateExpanded((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key && !k.startsWith(`${key}/`));
      return [...prev.filter((k) => !isTop(key) || !isTop(k)), key];
    });

  const go = (event, path) => {
    // a modified click (new tab or window) is left to the browser
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1)) return;
    if (event) event.preventDefault();
    navigate(path);
    if (onNavigate) onNavigate();
  };

  // ---------------------------------------------------------------- search
  const results = useMemo(() => searchMenu(menu, searchQuery, label), [menu, searchQuery, label]);
  useEffect(() => setSelectedSearchIndex(results.length ? 0 : -1), [results]);

  const openResult = (leaf) => {
    setSearchQuery("");
    go(null, leaf.item.path);
  };

  // "/" outside a text field goes to the menu search (listed in Help > Keyboard shortcuts)
  const searchRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (!searchRef.current || !searchRef.current.offsetParent) return;
      e.preventDefault();
      searchRef.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSearchIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSearchIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === "Enter" && results[selectedSearchIndex]) {
      e.preventDefault();
      openResult(results[selectedSearchIndex]);
    }
  };

  // ---------------------------------------------------------------- tree
  const renderLeaf = (item, names, level) => {
    const key = keyOf(names);
    const active = key === activeKey;
    return (
      <li key={key} className="bv-nav__item">
        <a
          href={item.path}
          className={`bv-nav__link bv-nav__link--l${level}${active ? " is-active" : ""}`}
          aria-current={active ? "page" : undefined}
          onClick={(e) => go(e, item.path)}
        >
          {level === 1 && <i className={`bv-nav__icon ${item.icon || "pi pi-circle"}`} aria-hidden="true" />}
          <NavLabel text={label(item.name)} full={fullLabel(item.name)} />
        </a>
      </li>
    );
  };

  const renderChildren = (items, parentNames, level) =>
    items.map((child) => {
      const names = [...parentNames, child.name];
      if (child.section && child.submenu) {
        return (
          <li key={keyOf(names)} className="bv-nav__section" role="presentation">
            <div className="bv-nav__section-title" title={fullLabel(child.name)}>
              {label(child.name)}
            </div>
            <ul className="bv-nav__section-list" aria-label={label(child.name)}>
              {renderChildren(child.submenu, names, level)}
            </ul>
          </li>
        );
      }
      return child.submenu ? renderGroup(child, names, level) : renderLeaf(child, names, level);
    });

  const renderGroup = (item, names, level) => {
    const key = keyOf(names);
    const open = expanded.includes(key);
    const containsActive = activeKey.startsWith(`${key}/`);
    const listId = `bv-nav-${key.replace(/[^A-Za-z0-9]+/g, "-")}`;
    return (
      <li key={key} className="bv-nav__item">
        <button
          type="button"
          className={`bv-nav__link bv-nav__link--l${level} bv-nav__group${containsActive ? " has-active" : ""}`}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => toggle(key)}
        >
          {level === 1 && <i className={`bv-nav__icon ${item.icon || "pi pi-folder"}`} aria-hidden="true" />}
          <NavLabel text={label(item.name)} full={fullLabel(item.name)} />
          <i className={`bv-nav__chevron pi pi-chevron-right${open ? " is-open" : ""}`} aria-hidden="true" />
        </button>
        {open && (
          <ul id={listId} className={`bv-nav__list bv-nav__list--l${level + 1}`}>
            {renderChildren(item.submenu, names, level + 1)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="sidebar__overall__container bv-nav">
      <div className="bv-nav__top">
        <a className="bdoi-brand" href="/" aria-label={`${brandName} home`} onClick={(e) => go(e, "/")}>
          <span className="bdoi-brand-logo-row">
            {logoUrl && <img src={logoUrl} alt={`${brandName} logo`} />}
            <EnvironmentBadge />
          </span>
          {showName && <span className="bdoi-brand-product">{systemName}</span>}
        </a>

        <div className="menu-search-container" role="search">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("common.searchMenu")}
              aria-label={t("common.searchMenu")}
              className="menu-search-input"
              autoComplete="off"
            />
          </span>

          {searchQuery.trim() && (
            <div className="search-results-dropdown" role="listbox">
              {results.length === 0 && <div className="search-result-empty">{t("sidebarSearch.noMatch")}</div>}
              {results.map((leaf, index) => (
                <div
                  key={keyOf([...leaf.ancestors.map((a) => a.name), leaf.item.name])}
                  role="option"
                  aria-selected={selectedSearchIndex === index}
                  className={`search-result-item ${selectedSearchIndex === index ? "selected" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    openResult(leaf);
                  }}
                  onMouseEnter={() => setSelectedSearchIndex(index)}
                >
                  <span className="search-result-text">{label(leaf.item.name)}</span>
                  {leaf.ancestors.length > 0 && (
                    <span className="search-result-path">
                      {leaf.ancestors.map((a) => label(a.name)).join(" › ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="bv-nav__scroll" aria-label={t("sidebarSearch.navigation")}>
        <ul className="bv-nav__list bv-nav__list--l1">
          {menu.map((item) =>
            item.submenu ? renderGroup(item, [item.name], 1) : renderLeaf(item, [item.name], 1),
          )}
        </ul>
      </nav>
    </div>
  );
};

export default NewSideBar;
