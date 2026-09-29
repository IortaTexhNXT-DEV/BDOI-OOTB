/** {{name}} placeholders in e-mail, notice and letter templates kept in settings. */

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Replace {{name}} placeholders with vars[name] (empty when missing). Values are HTML-escaped for an HTML body; pass
 * { html: false } for plain text such as an e-mail subject, so "Cruz & Sons" does not arrive as "Cruz &amp; Sons".
 */
export function renderTemplate(template, vars, { html = true } = {}) {
  return String(template ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    if (v === undefined || v === null) return '';
    return html ? escHtml(v) : String(v);
  });
}
