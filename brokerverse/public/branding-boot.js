// First paint in the branding of this environment: the copy of the last branding this browser received (kept by
// src/theme/runtime/BrandingProvider.jsx) is applied before the application loads, so the screens do not show the
// default colours, title and icon first. A first visit has no copy; the sign-in page then waits for GET /api/branding.
(function () {
  try {
    var saved = JSON.parse(window.localStorage.getItem("bv.branding.boot") || "null");
    if (!saved || typeof saved !== "object") return;
    var root = document.documentElement;
    var vars = saved.vars || {};
    var attrs = saved.attrs || {};
    Object.keys(vars).forEach(function (name) {
      if (/^--bv-[a-z0-9-]+$/.test(name) && /^[#(),.%\w\s"'-]*$/.test(String(vars[name]))) root.style.setProperty(name, String(vars[name]));
    });
    Object.keys(attrs).forEach(function (name) {
      if (/^data-bv-[a-z]+$/.test(name) && /^[a-z0-9-]+$/.test(String(attrs[name]))) root.setAttribute(name, String(attrs[name]));
    });
    if (typeof saved.title === "string" && saved.title) document.title = saved.title;
    var icon = document.querySelector("link[rel='icon']");
    if (icon && typeof saved.faviconUrl === "string" && /^(\/|https?:\/\/)/.test(saved.faviconUrl)) icon.href = saved.faviconUrl;
    var themeColor = document.querySelector("meta[name='theme-color']");
    if (themeColor && vars["--bv-header-bg"]) themeColor.setAttribute("content", String(vars["--bv-header-bg"]));
  } catch (e) {
    // storage unavailable or the copy unreadable: the application applies the branding when it loads
  }
})();
