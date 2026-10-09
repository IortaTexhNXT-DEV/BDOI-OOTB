import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { promptText } from "../../utility/dialogs";
import "./index.scss";

/** Whether an HTML body has no text (an editor left with an empty paragraph or line break counts as empty). */
export const htmlIsEmpty = (html) => !String(html || "").replace(/<(?!img)[^>]*>/gi, "").replace(/&nbsp;/g, " ").trim() && !/<img/i.test(String(html || ""));

const TOOLS = [
  { command: "bold", icon: "pi pi-bold", key: "bold", label: "Bold" },
  { command: "italic", icon: "pi pi-italic", key: "italic", label: "Italic" },
  { command: "underline", icon: "pi pi-underline", key: "underline", label: "Underline" },
  { command: "insertUnorderedList", icon: "pi pi-list", key: "bullets", label: "Bulleted list" },
  { command: "insertOrderedList", icon: "pi pi-sort-numeric-down", key: "numbers", label: "Numbered list" },
  { command: "removeFormat", icon: "pi pi-eraser", key: "clear", label: "Clear formatting" },
];

/**
 * Formatted text editor of an HTML body (e-mail templates): bold, italic, underline, lists and links from the toolbar,
 * buttons that insert a placeholder at the cursor ({ name, label, html? }: html inserts markup, such as a link), and a
 * switch to the HTML source. Pasted text arrives as plain text, so formatting from other programs is not carried over.
 */
const RichTextEditor = ({ value, onChange, placeholders = [], invalid = false, id, ariaLabel }) => {
  const { t } = useTranslation();
  const editor = useRef(null);
  const source = useRef(null);
  const range = useRef(null);
  const shown = useRef(null);
  const [html, setHtml] = useState(false);

  // the editor's content follows the value when it changes from outside (not after each keystroke: the caret would jump)
  useEffect(() => {
    if (html || !editor.current || value === shown.current) return;
    editor.current.innerHTML = value || "";
    shown.current = value;
  }, [value, html]);

  const emit = () => {
    shown.current = editor.current.innerHTML;
    onChange(shown.current);
  };
  const remember = () => {
    const sel = window.getSelection();
    if (sel?.rangeCount && editor.current?.contains(sel.anchorNode)) range.current = sel.getRangeAt(0).cloneRange();
  };
  // back to the last cursor position in the editor (its end when it had none), so a command applies there
  const restore = () => {
    editor.current.focus();
    const sel = window.getSelection();
    if (!sel) return;
    let r = range.current;
    if (!r) {
      r = document.createRange();
      r.selectNodeContents(editor.current);
      r.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(r);
  };
  const exec = (command, arg) => {
    restore();
    if (typeof document.execCommand === "function") document.execCommand(command, false, arg);
    remember();
    emit();
  };

  const addLink = async () => {
    const saved = range.current;
    const url = await promptText(t("editor.linkUrl", "Address of the link (https://...)"), "https://", { multiline: false, header: t("editor.link", "Link") });
    range.current = saved;
    if (!url || url === "https://") return;
    if (saved && !saved.collapsed) exec("createLink", url);
    else exec("insertHTML", `<a href="${url.replace(/"/g, "&quot;")}">${url.replace(/[<>&]/g, "")}</a>`);
  };

  const insert = (p) => {
    const text = p.html || `{{${p.name}}}`;
    if (html) {
      const el = source.current;
      const start = el?.selectionStart ?? String(value || "").length;
      const end = el?.selectionEnd ?? start;
      const next = `${String(value || "").slice(0, start)}${text}${String(value || "").slice(end)}`;
      onChange(next);
      return;
    }
    exec(p.html ? "insertHTML" : "insertText", text);
  };

  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") || "";
    if (typeof document.execCommand === "function") document.execCommand("insertText", false, text);
    emit();
  };

  // toolbar buttons keep the cursor in the editor (mousedown would move the focus to the button)
  const keep = (e) => e.preventDefault();

  return (
    <div className={`bv-rte${invalid ? " bv-rte--invalid" : ""}`}>
      <div className="bv-rte__toolbar" role="toolbar" aria-label={t("editor.toolbar", "Formatting")}>
        {TOOLS.map((tool) => (
          <Button key={tool.key} type="button" icon={tool.icon} text size="small" disabled={html} onMouseDown={keep} onClick={() => exec(tool.command)}
            tooltip={t(`editor.${tool.key}`, tool.label)} tooltipOptions={{ position: "top" }} aria-label={t(`editor.${tool.key}`, tool.label)} />
        ))}
        <Button type="button" icon="pi pi-link" text size="small" disabled={html} onMouseDown={keep} onClick={addLink}
          tooltip={t("editor.link", "Link")} tooltipOptions={{ position: "top" }} aria-label={t("editor.link", "Link")} />
        <Button type="button" icon="pi pi-code" text size="small" className={html ? "bv-rte__on" : ""} onMouseDown={keep} onClick={() => setHtml(!html)}
          tooltip={html ? t("editor.formatted", "Formatted text") : t("editor.source", "HTML source")} tooltipOptions={{ position: "top" }}
          aria-label={t("editor.source", "HTML source")} aria-pressed={html} />
        {placeholders.length ? (
          <span className="bv-rte__placeholders">
            <span className="bv-rte__insert">{t("editor.insert", "Insert")}</span>
            {placeholders.map((p) => (
              <Button key={p.name} type="button" label={p.label} outlined size="small" onMouseDown={keep} onClick={() => insert(p)} />
            ))}
          </span>
        ) : null}
      </div>
      {html ? (
        <InputTextarea ref={source} id={id} className="bv-rte__source" value={value || ""} rows={12} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div ref={editor} id={id} className="bv-rte__content" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={ariaLabel}
          onInput={emit} onKeyUp={remember} onMouseUp={remember} onBlur={remember} onPaste={onPaste}
          onFocus={() => typeof document.execCommand === "function" && document.execCommand("defaultParagraphSeparator", false, "p")} />
      )}
    </div>
  );
};

export default RichTextEditor;
