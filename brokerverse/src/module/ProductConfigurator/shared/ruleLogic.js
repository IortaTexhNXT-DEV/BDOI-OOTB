/**
 * Screen logic of the Product Configurator kept out of the components (tested in ruleLogic.test.js): the readable
 * condition and outcome of an acceptance rule, the checks made before a rule is saved (the API makes the same ones),
 * the authority and insurer shown for a rule, and the checks of an uploaded document layout.
 */

export const RULE_ACTIONS = ["Auto-Accept", "Refer", "Decline", "Apply Loading"];
export const RULE_TYPES = ["Acceptance", "Validation", "Referral", "Loading"];
export const OPERATORS = ["<=", "<", ">=", ">", "=", "!="];
export const LAYOUT_EXTENSIONS = [".txt", ".md"];
export const LAYOUT_MAX = 20000;

/** Tag severity of a rule action (status colour scheme: success / warning / danger / info). */
export const actionSeverity = (action) => ({ "Auto-Accept": "success", Refer: "warning", Decline: "danger", "Apply Loading": "info" }[action] || "info");

const fieldLabel = (fields, key) => fields.find((f) => f.value === key)?.label || key;

/** "Vehicle age (years) <= 15", "Sum insured > Fair market value x 1.1", "Vehicle has modifications". */
export const conditionText = (rule, fields = []) => {
  if (!rule?.field) return rule?.condition || "";
  const f = fields.find((x) => x.value === rule.field);
  if (f?.type === "boolean") return rule.value === false || rule.value === "false" ? `Not: ${f.label.toLowerCase()}` : f.label;
  const rhs = rule.valueField
    ? `${fieldLabel(fields, rule.valueField)}${rule.valueFactor && Number(rule.valueFactor) !== 1 ? ` x ${rule.valueFactor}` : ""}`
    : String(rule.value ?? "");
  return `${fieldLabel(fields, rule.field)} ${rule.operator || "="} ${rhs}`;
};

/**
 * What happens when the rule applies, in words: "Accept automatically; otherwise refer", "Refer", "Decline",
 * "Add 15% loading".
 */
export const outcomeText = (rule, t) => {
  switch (rule?.action) {
    case "Auto-Accept":
      return t("underwritingRules.outcome.autoAccept", { otherwise: t(`underwritingRules.outcome.otherwise${rule.otherwiseAction === "Decline" ? "Decline" : "Refer"}`) });
    case "Refer":
      return t("underwritingRules.outcome.refer");
    case "Decline":
      return t("underwritingRules.outcome.decline");
    case "Apply Loading":
      return t("underwritingRules.outcome.loading", { percent: rule.loadingPercent ?? 0 });
    default:
      return rule?.action || "";
  }
};

/** Whether the rule can send a quotation to referral (and therefore needs an authority role). */
export const refers = (rule) => rule?.action === "Refer" || (rule?.action === "Auto-Accept" && (rule?.otherwiseAction || "Refer") === "Refer");

/** Who may approve a referral: the role's name; rules that never refer have none. */
export const authorityText = (rule, roles = [], t) => {
  if (!refers(rule)) return t("underwritingRules.noReferral");
  if (!rule.authorityRole) return t("underwritingRules.authorityMissing");
  return roles.find((r) => r.value === rule.authorityRole)?.label || rule.authorityRole;
};

/** The insurer a rule applies to: one insurer, or every insurer on the product's market. */
export const insurerText = (rule, t) => rule?.insurerName || t("underwritingRules.allInsurers");

/** Checks before saving a rule: { field: message } (empty when the rule can be saved). */
export const ruleErrors = (rule, fields = [], t) => {
  const e = {};
  const required = (k, label) => {
    if (rule?.[k] === undefined || rule?.[k] === null || String(rule[k]).trim() === "") e[k] = t("productConfigurator.fieldRequired", { field: label });
  };
  if (!rule?.id) required("productId", t("productConfigurator.template"));
  required("ruleCode", t("underwritingRules.ruleCode"));
  required("ruleName", t("underwritingRules.ruleName"));
  required("type", t("underwritingRules.type"));
  required("field", t("underwritingRules.field"));
  required("operator", t("underwritingRules.operator"));
  required("action", t("underwritingRules.action"));
  const f = fields.find((x) => x.value === rule?.field);
  if (f && f.type !== "boolean" && !rule.valueField) {
    required("value", t("underwritingRules.value"));
    if (f.type === "number" && rule.value !== undefined && rule.value !== null && rule.value !== "" && !Number.isFinite(Number(rule.value))) e.value = t("underwritingRules.valueNumber");
  }
  if (rule?.action === "Apply Loading" && !(Number(rule.loadingPercent) > 0)) e.loadingPercent = t("underwritingRules.loadingRequired");
  if (refers(rule) && !rule.authorityRole) e.authorityRole = t("underwritingRules.authorityRequired");
  return e;
};

/** Merge fields used by a layout and the unknown ones: { used, unknown }. */
export const layoutPlaceholders = (text, fields = [], blocks = []) => {
  const known = new Set(fields.map((f) => f.name));
  const knownBlocks = new Set(blocks.map((b) => b.name));
  const used = [];
  const unknown = [];
  for (const m of String(text || "").matchAll(/\{\{\s*(#?)([A-Za-z][A-Za-z0-9]*)\s*\}\}/g)) {
    const name = `${m[1]}${m[2]}`;
    const ok = m[1] ? knownBlocks.has(m[2]) : known.has(m[2]);
    (ok ? used : unknown).push(name);
  }
  return { used: [...new Set(used)], unknown: [...new Set(unknown)] };
};

/** Checks of a layout file before it is uploaded: an error message, or null. */
export const layoutFileError = (file, text, fields, blocks, t) => {
  const name = String(file?.name || "").toLowerCase();
  if (!LAYOUT_EXTENSIONS.some((x) => name.endsWith(x))) return t("documentManager.onlyText", { extensions: LAYOUT_EXTENSIONS.join(", ") });
  if (!String(text || "").trim()) return t("documentManager.emptyLayout");
  if (String(text).length > LAYOUT_MAX) return t("documentManager.layoutTooLong", { max: LAYOUT_MAX });
  const p = layoutPlaceholders(text, fields, blocks);
  if (p.unknown.length) return t("documentManager.unknownFields", { fields: p.unknown.join(", ") });
  if (!p.used.length) return t("documentManager.noFields");
  return null;
};
