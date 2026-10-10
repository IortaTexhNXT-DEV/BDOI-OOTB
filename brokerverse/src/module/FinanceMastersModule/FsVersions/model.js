/** Financial statement version lines: blank line, ordering and the checks the server applies again. */

export const STATEMENTS = ["bs", "is"];
export const BALANCES = ["debit", "credit"];

const pad = (v, fill) => String(v || "").trim().padEnd(12, fill);

/** A new line numbered 10 after the last one, on the statement of the last line. */
export const blankLine = (lines, scope) => {
  const last = lines[lines.length - 1];
  const lineNo = (lines.reduce((m, l) => Math.max(m, Number(l.lineNo) || 0), 0) || 0) + 10;
  return { lineNo, statement: scope === "income" ? "is" : last?.statement || "bs", section: last?.section || "", caption: "", glFrom: "", glTo: "", normalBalance: last?.normalBalance || "debit" };
};

/** { "<index>.<field>": message key } of the lines; empty when they can be saved. */
export const lineErrors = (lines, scope) => {
  const errors = {};
  const seen = new Set();
  lines.forEach((l, i) => {
    const no = Number(l.lineNo);
    if (!Number.isInteger(no) || no < 1) errors[`${i}.lineNo`] = "lineNo";
    else if (seen.has(no)) errors[`${i}.lineNo`] = "lineNoTwice";
    seen.add(no);
    if (scope === "income" && l.statement !== "is") errors[`${i}.statement`] = "incomeOnly";
    if (!String(l.section || "").trim()) errors[`${i}.section`] = "required";
    if (!String(l.caption || "").trim()) errors[`${i}.caption`] = "required";
    if (!/^[0-9A-Za-z]{1,12}$/.test(String(l.glFrom || "").trim())) errors[`${i}.glFrom`] = "glCode";
    if (!/^[0-9A-Za-z]{1,12}$/.test(String(l.glTo || "").trim())) errors[`${i}.glTo`] = "glCode";
    else if (!errors[`${i}.glFrom`] && pad(l.glFrom, "0") > pad(l.glTo, "9")) errors[`${i}.glTo`] = "glOrder";
  });
  if (!lines.length) errors.lines = "noLines";
  return errors;
};

/** The lines as the API takes them, in line order. */
export const linesPayload = (lines) => [...lines].sort((a, b) => Number(a.lineNo) - Number(b.lineNo)).map((l) => ({
  lineNo: Number(l.lineNo), statement: l.statement, section: String(l.section).trim(), caption: String(l.caption).trim(), glFrom: String(l.glFrom).trim(),
  glTo: String(l.glTo).trim(), normalBalance: l.normalBalance,
}));
