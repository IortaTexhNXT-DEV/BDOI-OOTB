import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Breadcrumb items declared with a `url` render as plain links, which reload the whole application (blank page,
 * every reference list fetched again). This turns a plain click on such a link into an in-app navigation, so going
 * back up the breadcrumb is as quick as using the menu. Ctrl / Cmd / middle clicks still open a new tab.
 */
const InAppLinks = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest && e.target.closest(".p-breadcrumb a[href]");
      if (!link || link.target === "_blank") return;
      const href = link.getAttribute("href");
      if (!href || href === "#" || !href.startsWith("/") || href.startsWith("//")) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);
  return null;
};

export default InAppLinks;
